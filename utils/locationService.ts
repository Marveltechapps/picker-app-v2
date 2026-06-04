import * as Location from 'expo-location';
import { Platform, Linking } from 'react-native';
import { appNotify } from '@/utils/appNotify';
import Constants from 'expo-constants';

/** Timeout for getCurrentPositionAsync (expo-location has no built-in timeout). */
// Increased timeout to 30 seconds for better GPS acquisition, especially in Expo Go
export const LOCATION_TIMEOUT_MS = 30000;

/** In-memory cache for last known location + address (avoids redundant fetches). */
let cachedLocation: LocationData | null = null;
let cachedAddress: LocationAddress | null = null;
let cacheTimestamp = 0;
const CACHE_MAX_AGE_MS = 60_000; // 1 minute

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationAddress {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  formattedAddress?: string;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Return cached location if still fresh.
 */
export function getCachedLocation(): { location: LocationData; address: LocationAddress | null } | null {
  if (!cachedLocation) return null;
  if (Date.now() - cacheTimestamp > CACHE_MAX_AGE_MS) return null;
  return { location: cachedLocation, address: cachedAddress };
}

/**
 * Set cached location (used after successful fetch + optional geocode).
 */
export function setCachedLocation(location: LocationData, address: LocationAddress | null): void {
  cachedLocation = location;
  cachedAddress = address;
  cacheTimestamp = Date.now();
}

/**
 * Check current location permission status
 */
export async function checkLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    
    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else if (status === 'undetermined') {
      return 'unavailable';
    } else {
      return 'blocked';
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Error checking location permission:', error);
    }
    return 'unavailable';
  }
}

/**
 * Request foreground location permission
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status === 'granted') {
      return 'granted';
    } else if (status === 'denied') {
      // On iOS or Android, if denied, the user can still be guided to settings
      return 'denied';
    } else if (status === 'undetermined') {
      // Not yet determined (shouldn't happen after request, but just in case)
      return 'denied';
    } else {
      // Blocked - permission disabled at OS level
      return 'blocked';
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Error requesting location permission:', error);
    }
    return 'unavailable';
  }
}

/**
 * Check background location permission status (with retries for Android, smart fallback for Expo Go)
 */
export async function checkBackgroundLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const isExpoGo = Constants?.executionEnvironment === 'storeClient';
    
    // On Android, we might need multiple attempts as permission changes take time to register
    if (Platform.OS === 'android') {
      const apiLevel = Number(Platform.Version);
      
      let bgStatus = undefined;
      let attempts = 0;
      const maxAttempts = 3;
      
      // Try multiple times with small delays (Android takes time to register permission change)
      while (attempts < maxAttempts && bgStatus === undefined) {
        try {
          const result = await Location.getBackgroundPermissionsAsync();
          bgStatus = result.status;
          
          if (__DEV__) {
            console.log(`[LocationService] Android background permission check (attempt ${attempts + 1}): ${bgStatus} (API ${apiLevel})`);
          }
          
          // If we got a definitive answer, break early
          if (bgStatus && bgStatus !== 'undetermined') {
            break;
          }
        } catch (innerErr) {
          if (__DEV__) {
            console.warn(`[LocationService] Attempt ${attempts + 1} to check background permission failed:`, innerErr);
          }
        }
        
        attempts++;
        if (bgStatus === 'undetermined' && attempts < maxAttempts) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      
      if (__DEV__) {
        console.log(`[LocationService] Final Android background permission status after ${attempts} attempts: ${bgStatus}`);
      }
      
      // Android permission status interpretation:
      if (bgStatus === 'granted') {
        return 'granted';
      } else if (bgStatus === 'denied' || bgStatus === 'undetermined' || bgStatus === undefined) {
        // 'undetermined' or undefined = not yet granted (not blocked)
        return 'denied';
      } else if (bgStatus === 'blocked') {
        return 'blocked';
      } else {
        return 'denied';
      }
    }
    
    // iOS (including Expo Go)
    const { status } = await Location.getBackgroundPermissionsAsync();
    
    if (__DEV__) {
      console.log(`[LocationService] iOS background permission status: ${status} (ExpoGo: ${isExpoGo})`);
    }
    
    if (status === 'granted') {
      if (__DEV__) {
        console.log('[LocationService] ✓ iOS background location is GRANTED');
      }
      return 'granted';
    } else if (status === 'denied') {
      return 'denied';
    } else if (status === 'undetermined') {
      // In Expo Go on iOS, the system reports 'undetermined' even after user enables it
      // This is a known limitation of Expo Go
      // We can try a workaround: check if we can get a location (which requires background permission in practice)
      // For now, we return 'unavailable' to indicate it hasn't been explicitly granted via system API
      if (__DEV__) {
        console.log(`[LocationService] iOS background permission is undetermined (ExpoGo: ${isExpoGo})`);
      }
      return 'unavailable';
    } else {
      return 'blocked';
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[LocationService] Error checking background location permission:', error);
    }
    return 'denied'; // Treat errors as denied (user can try again)
  }
}

/**
 * Request background location permission
 */
export async function requestBackgroundLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    // On Android 10+ (API 29+), background location must be explicitly requested
    // On Android 11+ (API 30+), the system dialog won't grant it - user must do it in Settings
    if (Platform.OS === 'android') {
      const apiLevel = Number(Platform.Version);
      
      if (__DEV__) {
        console.log(`[LocationService] Requesting background location on Android API level ${apiLevel}`);
      }
      
      // First, verify foreground location is granted
      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        if (__DEV__) console.warn('[LocationService] Foreground location not granted, cannot request background');
        return 'denied';
      }
      
      // Check current background permission status
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      
      if (__DEV__) {
        console.log(`[LocationService] Current background permission status: ${bgStatus}`);
      }
      
      if (bgStatus === 'granted') {
        return 'granted';
      }
      
      // On Android 11+ (API 30+), can't grant via prompt - must use Settings
      if (apiLevel >= 30) {
        // Show alert to open Settings
        appNotify.confirm(
          'Android requires you to enable "Allow all the time" location permission in Settings.\n\n1. Tap "Open Settings"\n2. Select "Location"\n3. Choose "Allow all the time"',
          async () => {
            try {
              if (__DEV__) console.log('[LocationService] Opening app settings for background location');
              await Linking.openSettings();
            } catch (err) {
              if (__DEV__) console.error('[LocationService] Could not open settings:', err);
            }
          },
          'Enable Background Location',
          'Open Settings',
          false
        );
        
        return 'denied';
      }
      
      // Android 10 (API 29): Try to request background location
      if (apiLevel === 29) {
        try {
          const { status: requestedStatus } = await Location.requestBackgroundPermissionsAsync();
          if (__DEV__) {
            console.log(`[LocationService] Background location request result on API 29: ${requestedStatus}`);
          }
          return requestedStatus === 'granted' ? 'granted' : 'denied';
        } catch (err) {
          if (__DEV__) {
            console.error('[LocationService] Error requesting background location on API 29:', err);
          }
          return 'denied';
        }
      }
    }

    // iOS or Android < 10
    const isExpoGo = Constants?.executionEnvironment === 'storeClient';
    
    if (__DEV__) {
      console.log(`[LocationService] Requesting background location (iOS or Android <10, ExpoGo: ${isExpoGo})`);
    }
    
    // Special handling for Expo Go on iOS - guide user to Settings directly
    if (isExpoGo && Platform.OS === 'ios') {
      if (__DEV__) {
        console.log('[LocationService] Expo Go iOS detected - opening Settings directly for background location');
      }
      
      // Expo Go doesn't fully support background location requests
      // Instead, guide the user to enable it in Settings directly
      appNotify.confirm(
        'In Expo Go on iOS, background location must be enabled manually.\n\n1. Tap "Open Settings"\n2. Go to Expo Go app permissions\n3. Choose Location → "Always" option\n4. Return to the app',
        async () => {
          try {
            if (__DEV__) console.log('[LocationService] Opening settings for Expo Go background location');
            await Linking.openSettings();
          } catch (err) {
            if (__DEV__) console.error('[LocationService] Could not open settings:', err);
          }
        },
        'Enable Background Location',
        'Open Settings',
        false
      );
      
      // Return denied, but the watch function in permissions screen will retry checking
      return 'denied';
    }
    
    const { status, canAskAgain } = await Location.requestBackgroundPermissionsAsync();
    
    if (__DEV__) {
      console.log(`[LocationService] iOS/old Android background location request result: status=${status}, canAskAgain=${canAskAgain}`);
    }
    
    if (status === 'granted') {
      if (__DEV__) {
        console.log('[LocationService] ✓ Background location permission GRANTED');
      }
      return 'granted';
    } else if (status === 'denied') {
      if (Platform.OS === 'ios' && canAskAgain === false) {
        // If the user previously selected "Don't Allow", iOS won't show the prompt again.
        appNotify.confirm(
          'To enable Background Location, open Settings → Picker Pro → Location → set to "Always".',
          async () => {
            try {
              await Linking.openSettings();
            } catch (err) {
              if (__DEV__) console.error('[LocationService] Could not open settings:', err);
            }
          },
          'Enable Background Location',
          'Open Settings',
          false
        );
      }
      return 'denied';
    } else {
      if (__DEV__) {
        console.log('[LocationService] Background location permission blocked or unavailable:', status);
      }
      return 'blocked';
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[LocationService] Error requesting background location permission:', error);
    }
    return 'denied';
  }
}

/**
 * Get current device location with timeout and optional cache.
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const permissionStatus = await checkLocationPermission();

    if (permissionStatus !== 'granted') {
      if (__DEV__) {
        console.warn('Location permission not granted');
      }
      return null;
    }

    if (Platform.OS !== 'web') {
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        appNotify.permission('Location Services', 'location services in your device settings to use this feature');
        return null;
      }
    }

    // Check for cached location first (if available and recent)
    const cached = getCachedLocation();
    if (cached && cached.location) {
      const age = Date.now() - cached.location.timestamp;
      // Use cached location if less than 10 seconds old
      if (age < 10000) {
        return cached.location;
      }
    }

    const fetchPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      ...(Platform.OS === 'web' ? {} : { mayShowUserSettingsDialog: true }),
    }).then((location) => ({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    }));

    const location = await withTimeout(
      fetchPromise,
      LOCATION_TIMEOUT_MS,
      'Location request timed out. Please ensure GPS is enabled and try again.'
    );

    return location;
  } catch (error) {
    // Handle timeout errors gracefully - don't log as error, just as warning
    const isTimeoutError = error instanceof Error && 
      error.message.includes('timed out');
    
    if (isTimeoutError) {
      // Try to return cached location if timeout occurs
      const cached = getCachedLocation();
      if (cached && cached.location) {
        if (__DEV__) {
          console.warn('Location request timed out, using cached location');
        }
        return cached.location;
      }
      
      // Only log timeout as warning in dev mode, not as error
      if (__DEV__) {
        console.warn('Location request timed out. GPS may be slow or unavailable.');
      }
    } else {
      // Log other errors only in dev mode
      if (__DEV__) {
        console.error('Error getting current location:', error);
      }
    }
    return null;
  }
}

/**
 * High-accuracy GPS read for shift start / darkstore verification.
 * Skips stale cache so verification uses a fresh fix.
 */
export async function getHighAccuracyLocationForVerification(): Promise<LocationData | null> {
  try {
    const permissionStatus = await checkLocationPermission();
    if (permissionStatus !== 'granted') {
      return null;
    }

    if (Platform.OS !== 'web') {
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        return null;
      }
    }

    const fetchPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      ...(Platform.OS === 'web' ? {} : { mayShowUserSettingsDialog: true }),
    }).then((location) => ({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    }));

    return await withTimeout(
      fetchPromise,
      LOCATION_TIMEOUT_MS,
      'High-accuracy location request timed out. Enable GPS and try again.'
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('[locationService] High-accuracy location failed:', error);
    }
    return null;
  }
}

/**
 * Reverse geocode on web.
 * Nominatim does not allow direct browser requests (CORS + 403), so we return a
 * fallback address from coordinates to avoid console errors and failed fetches.
 */
async function reverseGeocodeWeb(lat: number, lon: number): Promise<LocationAddress | null> {
  // Return fallback immediately on web: Nominatim blocks browser requests (CORS, 403).
  // This avoids "Access to fetch blocked by CORS" and "403 Forbidden" console errors.
  const formattedAddress = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  return {
    formattedAddress,
    city: undefined,
    region: undefined,
    postalCode: undefined,
    country: undefined,
    street: undefined,
  };
}

/**
 * Reverse geocode coordinates to human-readable address.
 * Uses expo-location on native; on web returns coordinates fallback (Nominatim blocks browser CORS).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<LocationAddress | null> {
  if (Platform.OS === 'web') {
    return reverseGeocodeWeb(latitude, longitude);
  }

  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses && addresses.length > 0) {
      const address = addresses[0];

      const street =
        address.street || address.streetNumber
          ? `${address.streetNumber || ''} ${address.street || ''}`.trim()
          : address.district ?? undefined;

      const city = address.city ?? address.subregion ?? address.district;
      const region = address.region;

      return {
        street,
        city: city ?? undefined,
        region: region ?? undefined,
        postalCode: address.postalCode ?? undefined,
        country: address.country ?? undefined,
        formattedAddress: formatAddress(address),
      };
    }

    return null;
  } catch (error) {
    if (__DEV__) {
      console.error('Error reverse geocoding:', error);
    }
    return null;
  }
}

/**
 * Format address object to readable string (Area, City, State format)
 */
function formatAddress(address: Location.LocationGeocodedAddress): string {
  const parts: string[] = [];

  if (address.district) parts.push(address.district);
  if (parts.length === 0 && (address.streetNumber || address.street)) {
    parts.push(`${address.streetNumber || ''} ${address.street || ''}`.trim());
  }

  if (address.city) parts.push(address.city);
  else if (address.subregion) parts.push(address.subregion);
  else if (address.district && parts.length > 0) parts.push(address.district);

  if (address.region) parts.push(address.region);

  // Priority 5: Country (only if we don't have enough info)
  if (parts.length === 0 && address.country) {
    parts.push(address.country);
  }

  return parts.filter(Boolean).join(', ') || 'Unknown Location';
}

/**
 * Fallback when reverse geocode fails: "Lat, Lng" (e.g. "13.0825°, 80.2750°").
 */
export function formatCoordsFallback(lat: number, lon: number): string {
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format accuracy value for display
 */
export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) {
    return 'N/A';
  }

  if (accuracy < 1000) {
    return `±${Math.round(accuracy)}m`;
  } else {
    return `±${(accuracy / 1000).toFixed(1)}km`;
  }
}

/**
 * Verify if a location is valid for verification
 * Checks accuracy, coordinates validity, and timestamp freshness
 * 
 * NOTE: This is the STRICT verification function.
 * Use safeVerifyLocation() for more lenient verification with fallback support.
 */
export function verifyLocation(location: LocationData | null): {
  isValid: boolean;
  reason?: string;
} {
  if (!location) {
    return { isValid: false, reason: 'No location data available' };
  }

  // Check if coordinates are valid
  if (
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    isNaN(location.latitude) ||
    isNaN(location.longitude)
  ) {
    return { isValid: false, reason: 'Invalid coordinates' };
  }

  // Check if coordinates are within valid range
  if (
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    return { isValid: false, reason: 'Coordinates out of valid range' };
  }

  // Check accuracy (should be reasonable for verification)
  // Accept accuracy up to 100 meters (0.1km) for verification
  if (location.accuracy !== null && location.accuracy > 100) {
    return { isValid: false, reason: 'Location accuracy too low' };
  }

  // Check timestamp freshness (location should be recent, within last 30 seconds)
  const age = Date.now() - location.timestamp;
  if (age > 30000) {
    return { isValid: false, reason: 'Location data is too old' };
  }

  return { isValid: true };
}

/**
 * Safe location verification with relaxed requirements for web/fallback scenarios.
 * 
 * This function is more lenient than verifyLocation():
 * - Allows lower accuracy (up to 500m for web, 200m for native)
 * - Allows older timestamps (up to 60 seconds)
 * - Designed to work better across different environments
 * 
 * Use this when you want verification to succeed more often, especially on web.
 */
export function safeVerifyLocation(
  location: LocationData | null,
  isWeb: boolean = false
): {
  isValid: boolean;
  reason?: string;
} {
  if (!location) {
    return { isValid: false, reason: 'No location data available' };
  }

  // Check if coordinates are valid
  if (
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    isNaN(location.latitude) ||
    isNaN(location.longitude)
  ) {
    return { isValid: false, reason: 'Invalid coordinates' };
  }

  // Check if coordinates are within valid range
  if (
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    return { isValid: false, reason: 'Coordinates out of valid range' };
  }

  // Relaxed accuracy check (web is less accurate, so be more lenient)
  const maxAccuracy = isWeb ? 500 : 200; // 500m for web, 200m for native
  if (location.accuracy !== null && location.accuracy > maxAccuracy) {
    return { isValid: false, reason: `Location accuracy too low (${Math.round(location.accuracy)}m > ${maxAccuracy}m)` };
  }

  // Relaxed timestamp check (allow up to 60 seconds for web, 45 seconds for native)
  const maxAge = isWeb ? 60000 : 45000;
  const age = Date.now() - location.timestamp;
  if (age > maxAge) {
    return { isValid: false, reason: `Location data is too old (${Math.round(age / 1000)}s > ${maxAge / 1000}s)` };
  }

  return { isValid: true };
}
