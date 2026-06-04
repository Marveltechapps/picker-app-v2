/**
 * Google Maps Platform — Geolocation API for shift location verification.
 * Used when device GPS accuracy is poor (e.g. indoors) but we still need a position fix.
 */

import Constants from "expo-constants";
import { SHIFT_GEOFENCE_RADIUS_M } from "@/constants/locationVerification";
import { calculateDistance, type LocationData } from "@/utils/locationService";

export { SHIFT_GEOFENCE_RADIUS_M };

export function getGoogleMapsApiKey(): string | null {
  const key =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey;
  const trimmed = typeof key === "string" ? key.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function hasValidCoordinates(location: LocationData | null | undefined): location is LocationData {
  if (!location) return false;
  const { latitude, longitude } = location;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * POST https://www.googleapis.com/geolocation/v1/geolocate
 */
export async function fetchGoogleGeolocation(): Promise<LocationData | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    if (__DEV__) {
      console.warn("[googleMapsLocation] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set");
    }
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ considerIp: true }),
      }
    );

    if (!response.ok) {
      if (__DEV__) {
        console.warn("[googleMapsLocation] Geolocation API error:", response.status);
      }
      return null;
    }

    const data = (await response.json()) as {
      location?: { lat?: number; lng?: number };
      accuracy?: number;
    };

    const lat = data.location?.lat;
    const lng = data.location?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      latitude: lat as number,
      longitude: lng as number,
      accuracy: typeof data.accuracy === "number" ? data.accuracy : null,
      altitude: null,
      heading: null,
      speed: null,
      timestamp: Date.now(),
    };
  } catch (err) {
    if (__DEV__) {
      console.warn("[googleMapsLocation] Geolocation request failed:", err);
    }
    return null;
  }
}

export function distanceMetersToPoint(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number
): number {
  return calculateDistance(userLat, userLng, targetLat, targetLng);
}

export function isWithinShiftGeofence(
  userLat: number,
  userLng: number,
  hubLat: number,
  hubLng: number,
  radiusM = SHIFT_GEOFENCE_RADIUS_M
): boolean {
  return distanceMetersToPoint(userLat, userLng, hubLat, hubLng) <= radiusM;
}

/** Prefer the fix with the lowest reported accuracy (meters). */
export function pickBestLocationFix(
  ...candidates: (LocationData | null | undefined)[]
): LocationData | null {
  let best: LocationData | null = null;
  let bestAccuracy = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!hasValidCoordinates(candidate)) continue;
    const accuracy = candidate.accuracy ?? Number.POSITIVE_INFINITY;
    if (accuracy < bestAccuracy) {
      best = candidate;
      bestAccuracy = accuracy;
    }
  }

  return best;
}
