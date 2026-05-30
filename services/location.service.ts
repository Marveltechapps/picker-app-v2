/**
 * Location service: permission, current position, reverse geocoding, work location (hub).
 * Delegates to utils/locationService; provides a single API for app usage.
 */

import { apiGet } from "@/utils/apiClient";
import {
  type LocationData,
  type LocationAddress,
  type LocationPermissionStatus,
  checkLocationPermission,
  requestLocationPermission,
  getCurrentLocation as getCurrentLocationUtil,
  reverseGeocode as reverseGeocodeUtil,
  getCachedLocation,
  setCachedLocation,
} from '@/utils/locationService';

export type { LocationData, LocationAddress, LocationPermissionStatus };

export interface WorkLocationCurrent {
  hubId: string | null;
  hubName: string | null;
  address: string | null;
  locationType: string | null;
}

/**
 * Get current work location (hub) from backend.
 * Used by home / hub flows for hub name display.
 */
export async function getWorkLocationCurrent(): Promise<WorkLocationCurrent> {
  try {
    const res = await apiGet<WorkLocationCurrent>("/locations/current");
    return res ?? { hubId: null, hubName: null, address: null, locationType: null };
  } catch {
    return { hubId: null, hubName: null, address: null, locationType: null };
  }
}

/**
 * Request foreground location permission (Android + iOS).
 */
export async function requestPermission(): Promise<LocationPermissionStatus> {
  return requestLocationPermission();
}

/**
 * Get current device location (real GPS). Uses timeout + cache.
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  const cached = getCachedLocation();
  if (cached) {
    return cached.location;
  }
  const location = await getCurrentLocationUtil();
  if (location) {
    setCachedLocation(location, null);
  }
  return location;
}

/**
 * Reverse geocode lat/lng to human-readable address (Area, City, State).
 * Uses expo-location on native; Nominatim on web.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<LocationAddress | null> {
  return reverseGeocodeUtil(lat, lng);
}
