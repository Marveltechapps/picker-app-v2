/**
 * Location service: permission, current position, reverse geocoding, work location (hub).
 * Delegates to utils/locationService; provides a single API for app usage.
 */

import { apiGet, apiPost, ApiClientError } from "@/utils/apiClient";
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
  latitude?: number | null;
  longitude?: number | null;
  coordinatesCapturedAt?: string | Date | null;
  coordinatesSource?: string | null;
}

export interface DarkstoreVerificationAnchor {
  anchored: boolean;
  locationId: string;
  name?: string;
  address?: string;
  verification: {
    latitude: number;
    longitude: number;
    source: string;
    capturedAt?: string | Date | null;
  };
}

/**
 * Get current work location (hub) from backend.
 * Used by home / hub flows for hub name display.
 */
interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Save the assigned darkstore's verification coordinates from device GPS
 * when admin/legacy coordinates are missing or incorrect.
 */
export async function ensureDarkstoreVerificationAnchor(
  payload: {
    latitude: number;
    longitude: number;
    address?: string;
    capturedAt?: string | number;
  }
): Promise<{ success: boolean; data?: DarkstoreVerificationAnchor; error?: string }> {
  try {
    const res = await apiPost<ApiDataResponse<DarkstoreVerificationAnchor>>(
      "/locations/ensure-darkstore-verification",
      {
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        capturedAt: payload.capturedAt ?? Date.now(),
      }
    );
    const data = (res as ApiDataResponse<DarkstoreVerificationAnchor>).data;
    if (
      !data?.verification ||
      !Number.isFinite(data.verification.latitude) ||
      !Number.isFinite(data.verification.longitude)
    ) {
      return { success: false, error: "Dark store verification location was not set" };
    }
    return { success: true, data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function getWorkLocationCurrent(): Promise<WorkLocationCurrent> {
  try {
    const res = await apiGet<ApiDataResponse<WorkLocationCurrent>>("/locations/current");
    return (
      (res as ApiDataResponse<WorkLocationCurrent>).data ?? {
        hubId: null,
        hubName: null,
        address: null,
        locationType: null,
      }
    );
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
