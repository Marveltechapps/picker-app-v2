import { Platform } from "react-native";
import {
  SHIFT_GEOFENCE_RADIUS_M,
  SHIFT_MAX_GPS_ACCURACY_M,
  SHIFT_MAX_GPS_ACCURACY_WEB_M,
  SHIFT_MAX_LOCATION_AGE_MS,
} from "@/constants/locationVerification";
import type { LocationData } from "@/utils/locationService";

export interface GpsValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates GPS quality before darkstore geofence verification.
 */
export function validateGpsForShiftStart(
  location: LocationData | null,
  isWeb: boolean = Platform.OS === "web",
  options?: { distanceToDarkstoreM?: number }
): GpsValidationResult {
  if (!location) {
    return { isValid: false, reason: "No location data available" };
  }

  const { latitude, longitude } = location;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { isValid: false, reason: "Invalid GPS coordinates" };
  }

  if (
    options?.distanceToDarkstoreM != null &&
    options.distanceToDarkstoreM <= SHIFT_GEOFENCE_RADIUS_M
  ) {
    return { isValid: true };
  }

  const maxAccuracy = isWeb ? SHIFT_MAX_GPS_ACCURACY_WEB_M : SHIFT_MAX_GPS_ACCURACY_M;
  if (location.accuracy != null && location.accuracy > maxAccuracy) {
    const reported = Math.round(location.accuracy);
    return {
      isValid: false,
      reason: `Location accuracy too low (${reported}m > ${maxAccuracy}m). Move outdoors or nearer a window and retry.`,
    };
  }

  const age = Date.now() - location.timestamp;
  if (age > SHIFT_MAX_LOCATION_AGE_MS) {
    return {
      isValid: false,
      reason: `Location data is too old (${Math.round(age / 1000)}s). Refresh GPS and retry.`,
    };
  }

  return { isValid: true };
}
