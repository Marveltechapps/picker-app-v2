import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';
import {
  LocationData,
  LocationAddress,
  getCurrentLocation,
  reverseGeocode,
  checkLocationPermission,
  requestLocationPermission,
  checkBackgroundLocationPermission,
  requestBackgroundLocationPermission,
  formatAccuracy,
  formatCoordsFallback,
  calculateDistance,
  setCachedLocation,
} from '@/utils/locationService';

interface LocationContextType {
  // Location data
  currentLocation: LocationData | null;
  address: LocationAddress | null;
  isLoading: boolean;
  isGeocoding: boolean;
  error: string | null;

  // Permission status
  locationPermission: 'granted' | 'denied' | 'blocked' | 'unavailable';
  backgroundLocationPermission: 'granted' | 'denied' | 'blocked' | 'unavailable';

  // Actions
  requestPermission: () => Promise<boolean>;
  requestBackgroundPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  startWatchingLocation: () => void;
  stopWatchingLocation: () => void;
  isWatching: boolean;

  // Helpers
  getFormattedAddress: () => string;
  getAccuracyDisplay: () => string;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [address, setAddress] = useState<LocationAddress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'blocked' | 'unavailable'>('unavailable');
  const [backgroundLocationPermission, setBackgroundLocationPermission] = useState<'granted' | 'denied' | 'blocked' | 'unavailable'>('unavailable');
  const [isWatching, setIsWatching] = useState(false);

  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastGeocodedLocationRef = useRef<LocationData | null>(null);
  const isWatchingRef = useRef<boolean>(false);
  const refreshLocationRef = useRef<(() => Promise<void>) | null>(null);
  const startWatchingLocationRef = useRef<(() => void) | null>(null);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartWatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoStartedRef = useRef<boolean>(false);

  const refreshPermissions = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log('[LocationContext] refreshPermissions called');
      }
      
      // On web, check browser geolocation support
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          setLocationPermission('granted');
        } else {
          setLocationPermission('unavailable');
        }
        setBackgroundLocationPermission('unavailable');
        return;
      }

      const foregroundStatus = await checkLocationPermission();
      if (__DEV__) console.log('[LocationContext] Foreground permission status:', foregroundStatus);
      setLocationPermission(foregroundStatus);

      const backgroundStatus = await checkBackgroundLocationPermission();
      if (__DEV__) console.log('[LocationContext] Background permission status:', backgroundStatus);
      setBackgroundLocationPermission(backgroundStatus);
    } catch (err) {
      if (__DEV__) {
        console.error('[LocationContext] Error checking permissions:', err);
      }
    }
  }, []);

  // Check permissions on mount and auto-start watching
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  // Re-check permissions when returning from Settings / app resumes.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (__DEV__) {
          console.log('[LocationContext] App resumed, refreshing permissions after delay...');
        }
        // Add a small delay to ensure OS has fully registered the permission change
        setTimeout(async () => {
          try {
            await refreshPermissions();
            if (__DEV__) {
              console.log('[LocationContext] Permissions refreshed after app resume');
            }
          } catch (err) {
            if (__DEV__) {
              console.error('[LocationContext] Error refreshing permissions on app resume:', err);
            }
          }
        }, 300);
      }
    });

    return () => sub.remove();
  }, [refreshPermissions]);

  // Auto-start location watching when permission is granted (only once)
  useEffect(() => {
    // Reset auto-start flag if permission is revoked
    if (locationPermission !== 'granted') {
      hasAutoStartedRef.current = false;
      return;
    }

    // Only auto-start once per permission grant
    if (hasAutoStartedRef.current || isWatchingRef.current) {
      return;
    }

    // Clear any existing timers
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    if (autoStartWatchTimerRef.current) {
      clearTimeout(autoStartWatchTimerRef.current);
      autoStartWatchTimerRef.current = null;
    }

    // Small delay to ensure functions are initialized via refs
    autoStartTimerRef.current = setTimeout(() => {
      const refreshFn = refreshLocationRef.current;
      const startWatchFn = startWatchingLocationRef.current;
      
      if (refreshFn && startWatchFn && locationPermission === 'granted' && !isWatchingRef.current && !hasAutoStartedRef.current) {
        hasAutoStartedRef.current = true;
        
        // Initial location fetch
        refreshFn().catch(() => {
          // Silently handle errors
        });
        
        // Start real-time watching after a short delay
        autoStartWatchTimerRef.current = setTimeout(() => {
          if (locationPermission === 'granted' && !isWatchingRef.current && startWatchingLocationRef.current) {
            startWatchingLocationRef.current();
          }
          autoStartWatchTimerRef.current = null;
        }, 1000);
      }
      autoStartTimerRef.current = null;
    }, 200); // Small delay to ensure refs are set

    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      if (autoStartWatchTimerRef.current) {
        clearTimeout(autoStartWatchTimerRef.current);
        autoStartWatchTimerRef.current = null;
      }
    };
  }, [locationPermission]); // Only depend on locationPermission

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // On web, check if geolocation is available and request permission
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setLocationPermission('unavailable');
          setError('Geolocation is not supported by this browser');
          return false;
        }

        // On web, we can't directly check permission status, but we can try to get location
        // If it fails, the error will be caught. For now, assume granted if geolocation exists.
        // The actual permission will be requested when getCurrentPosition is called.
        setLocationPermission('granted');
        return true;
      }

      setIsLoading(true);
      setError(null);

      const status = await requestLocationPermission();
      setLocationPermission(status);

      return status === 'granted';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request location permission';
      setError(errorMessage);
      // Error is already handled via setError, no need to log to console
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestBackgroundPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const status = await requestBackgroundLocationPermission();
      setBackgroundLocationPermission(status);

      return status === 'granted';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request background location permission';
      setError(errorMessage);
      // Error is already handled via setError, no need to log to console
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const doReverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<LocationAddress | null> => {
      setIsGeocoding(true);
      try {
        let addr = await reverseGeocode(lat, lng);
        if (!addr) {
          addr = (await reverseGeocode(lat, lng)) ?? null;
        }
        return addr;
      } catch (e) {
        if (__DEV__) console.warn('Reverse geocode error:', e);
        return null;
      } finally {
        setIsGeocoding(false);
      }
    },
    []
  );

  const refreshLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setError('Geolocation is not supported by this browser');
          setIsLoading(false);
          return;
        }

        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                heading: position.coords.heading ?? null,
                speed: position.coords.speed ?? null,
                timestamp: position.timestamp,
              };
              setCurrentLocation(locationData);
              lastGeocodedLocationRef.current = locationData;

              const addr = await doReverseGeocode(
                locationData.latitude,
                locationData.longitude
              );
              if (addr) {
                setAddress(addr);
                setCachedLocation(locationData, addr);
              } else {
                const fallback = {
                  formattedAddress: formatCoordsFallback(
                    locationData.latitude,
                    locationData.longitude
                  ),
                };
                setAddress(fallback);
                setCachedLocation(locationData, fallback);
              }
              resolve();
            },
            (err: GeolocationPositionError) => {
              // Handle different error codes gracefully
              let errorMessage = 'Failed to get location';
              if (err.code === 1) {
                errorMessage = 'Location permission denied';
              } else if (err.code === 2) {
                errorMessage = 'Location unavailable';
              } else if (err.code === 3) {
                errorMessage = 'Location request timeout';
              } else if (err.message) {
                errorMessage = `Location error: ${err.message}`;
              }
              setError(errorMessage);
              // Don't reject on user denial or timeout - just set error
              if (err.code !== 1 && err.code !== 3) {
                reject(err);
              } else {
                resolve(); // Resolve anyway to not block the flow
              }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });
        return;
      }

      if (locationPermission !== 'granted') {
        const hasPermission = await requestPermission();
        if (!hasPermission) {
          setError('Location permission is required');
          setIsLoading(false);
          return;
        }
      }

      const location = await getCurrentLocation();

      if (location) {
        setCurrentLocation(location);
        lastGeocodedLocationRef.current = location;

        const addr = await doReverseGeocode(location.latitude, location.longitude);
        if (addr) {
          setAddress(addr);
          setCachedLocation(location, addr);
        } else {
          const fallback = {
            formattedAddress: formatCoordsFallback(
              location.latitude,
              location.longitude
            ),
          };
          setAddress(fallback);
          setCachedLocation(location, fallback);
        }
      } else {
        setError(
          'Failed to get location. Please ensure location services are enabled.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get location';
      setError(msg);
      if (__DEV__) console.error('Error refreshing location:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locationPermission, requestPermission, doReverseGeocode]);

  const startWatchingLocation = useCallback(() => {
    // Prevent multiple simultaneous watches using ref to avoid dependency issues
    if (isWatchingRef.current || watchSubscriptionRef.current) {
      return;
    }
    
    isWatchingRef.current = true;

    // On web, use browser geolocation watchPosition
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        if (__DEV__) {
          console.warn('Geolocation is not supported by this browser');
        }
        isWatchingRef.current = false;
        setIsWatching(false);
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading || null,
            speed: position.coords.speed || null,
            timestamp: position.timestamp,
          };
          setCurrentLocation(locationData);

            // Reverse geocode on web when location changes significantly
          const lastGeocoded = lastGeocodedLocationRef.current;
          let shouldUpdateAddress = false;

          if (!lastGeocoded) {
            // First time, always geocode
            shouldUpdateAddress = true;
          } else {
            const distance = calculateDistance(
              lastGeocoded.latitude,
              lastGeocoded.longitude,
              locationData.latitude,
              locationData.longitude
            );
            // Update if moved more than 50 meters or periodically (every 10th update ~10%)
            shouldUpdateAddress = distance > 50 || Math.random() < 0.1;
          }

          if (shouldUpdateAddress) {
            lastGeocodedLocationRef.current = locationData;
            reverseGeocode(locationData.latitude, locationData.longitude)
              .then((addr) => {
                if (addr) setAddress(addr);
              })
              .catch((err) => {
                if (__DEV__) console.warn('Geocoding error:', err);
              });
          }
        },
        (error: GeolocationPositionError) => {
          // Handle different error codes gracefully - don't log timeout errors on web
          // Timeout errors are common on web and don't need to be shown to users
          if (error.code === 3) {
            // Timeout error - silently ignore on web (common issue)
            // The watchPosition will continue trying
            return;
          }
          
          let errorMessage = 'Location error';
          if (error.code === 1) {
            errorMessage = 'Location permission denied';
          } else if (error.code === 2) {
            errorMessage = 'Location unavailable';
          } else if (error.message) {
            errorMessage = `Location error: ${error.message}`;
          }
          
          // Only set error for non-permission issues (permission errors are expected)
          if (error.code !== 1) {
            setError(errorMessage);
          }
          
          // Only log non-timeout errors
          if (__DEV__ && error.code !== 1 && error.code !== 3) {
            console.warn('Location watch error:', errorMessage);
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 30000,
          maximumAge: 3000 // Prefer fresh locations (3s) for realtime map
        }
      );

      // Store watchId in ref for cleanup
      (watchSubscriptionRef as any).current = { remove: () => navigator.geolocation.clearWatch(watchId) };
      setIsWatching(true);
      return;
    }

    // Native platforms
    if (locationPermission !== 'granted') {
      if (__DEV__) {
        console.warn('Cannot watch location: permission not granted');
      }
      isWatchingRef.current = false;
      setIsWatching(false);
      return;
    }

    const watchLocation = async () => {
      try {
        watchSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000, // Update every 3 seconds for realtime feel
            distanceInterval: 5, // Update every 5 meters
          },
          (location) => {
            const locationData: LocationData = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              altitude: location.coords.altitude,
              heading: location.coords.heading,
              speed: location.coords.speed,
              timestamp: location.timestamp,
            };

            setCurrentLocation(locationData);

            // Reverse geocode when location changes significantly (more than 50 meters)
            // or periodically (10% chance) to avoid rate limits
            const lastGeocoded = lastGeocodedLocationRef.current;
            let shouldUpdateAddress = false;

            if (!lastGeocoded) {
              // First time, always geocode
              shouldUpdateAddress = true;
            } else {
              // Calculate distance from last geocoded location
              const distance = calculateDistance(
                lastGeocoded.latitude,
                lastGeocoded.longitude,
                locationData.latitude,
                locationData.longitude
              );
              
              // Update if moved more than 50 meters or randomly (10% chance)
              shouldUpdateAddress = distance > 50 || Math.random() < 0.1;
            }

            if (shouldUpdateAddress) {
              lastGeocodedLocationRef.current = locationData;
              // Attempt reverse geocoding to get location name
              reverseGeocode(locationData.latitude, locationData.longitude)
                .then((addr) => {
                  if (addr) {
                    setAddress(addr);
                  }
                })
                .catch((err) => {
                  if (__DEV__) {
                    console.warn('Geocoding error:', err);
                  }
                });
            }
          }
        );

        setIsWatching(true);
      } catch (err) {
        setError('Failed to start location tracking');
        isWatchingRef.current = false;
        setIsWatching(false);
        if (__DEV__) {
          console.error('Error starting location watch:', err);
        }
      }
    };

    watchLocation();
  }, [locationPermission]);

  // Update refs when functions change (after they're defined)
  useEffect(() => {
    refreshLocationRef.current = refreshLocation;
    startWatchingLocationRef.current = startWatchingLocation;
  }, [refreshLocation, startWatchingLocation]);

  const stopWatchingLocation = useCallback(() => {
    if (watchSubscriptionRef.current || isWatchingRef.current) {
      try {
        if (watchSubscriptionRef.current) {
          if (Platform.OS === 'web') {
            // On web, the subscription is a custom object with remove method
            const subscription = watchSubscriptionRef.current as any;
            if (subscription.remove && typeof subscription.remove === 'function') {
              subscription.remove();
            }
          } else {
            // Native platforms
            watchSubscriptionRef.current.remove();
          }
        }
      } catch (err) {
        // Silently handle cleanup errors - ignore DOM errors on web
        if (Platform.OS !== 'web' && __DEV__) {
          console.warn('Error stopping location watch:', err);
        }
      } finally {
        watchSubscriptionRef.current = null;
        isWatchingRef.current = false;
        setIsWatching(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear auto-start timers
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      if (autoStartWatchTimerRef.current) {
        clearTimeout(autoStartWatchTimerRef.current);
        autoStartWatchTimerRef.current = null;
      }
      
      // Stop location watching
      if (watchSubscriptionRef.current || isWatchingRef.current) {
        try {
          if (watchSubscriptionRef.current) {
            if (Platform.OS === 'web') {
              // On web, the subscription is a custom object with remove method
              const subscription = watchSubscriptionRef.current as any;
              if (subscription.remove && typeof subscription.remove === 'function') {
                subscription.remove();
              }
            } else {
              // Native platforms
              watchSubscriptionRef.current.remove();
            }
          }
        } catch (err) {
          // Silently handle cleanup errors - ignore DOM errors on web
          if (Platform.OS !== 'web' && __DEV__) {
            console.warn('Error during location watch cleanup:', err);
          }
        } finally {
          watchSubscriptionRef.current = null;
          isWatchingRef.current = false;
          setIsWatching(false);
        }
      }
    };
  }, []);

  const getFormattedAddress = useCallback((): string => {
    if (address?.formattedAddress) return address.formattedAddress;

    if (address) {
      const parts: string[] = [];
      if (address.street) parts.push(address.street);
      if (address.city) parts.push(address.city);
      if (address.region) parts.push(address.region);
      if (parts.length === 0 && address.country) parts.push(address.country);
      if (parts.length > 0) return parts.join(', ');
    }

    if (currentLocation) {
      if (isGeocoding) return 'Resolving…';
      return formatCoordsFallback(
        currentLocation.latitude,
        currentLocation.longitude
      );
    }

    return 'Location not available';
  }, [address, currentLocation, isGeocoding]);

  const getAccuracyDisplay = useCallback((): string => {
    if (currentLocation?.accuracy !== null && currentLocation?.accuracy !== undefined) {
      return formatAccuracy(currentLocation.accuracy);
    }
    return 'N/A';
  }, [currentLocation]);

  const value: LocationContextType = {
    currentLocation,
    address,
    isLoading,
    isGeocoding,
    error,
    locationPermission,
    backgroundLocationPermission,
    requestPermission,
    requestBackgroundPermission,
    refreshLocation,
    refreshPermissions,
    startWatchingLocation,
    stopWatchingLocation,
    isWatching,
    getFormattedAddress,
    getAccuracyDisplay,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
