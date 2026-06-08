/**
 * useVerifyLocation
 *
 * Fetches device GPS, validates accuracy, and verifies the picker is within
 * 200m of their saved darkstore (client + server).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useLocation } from "@/state/locationContext";
import {
  ensureDarkstoreVerificationAnchor,
  getWorkLocationCurrent,
} from "@/services/location.service";
import { validateLocationGeofence } from "@/services/locations.service";
import { SHIFT_GEOFENCE_RADIUS_M } from "@/constants/locationVerification";
import {
  getCachedLocation,
  getHighAccuracyLocationForVerification,
  LOCATION_TIMEOUT_MS,
  type LocationData,
} from "@/utils/locationService";
import {
  fetchGoogleGeolocation,
  hasValidCoordinates,
  isWithinShiftGeofence,
  pickBestLocationFix,
  distanceMetersToPoint,
} from "@/utils/googleMapsLocation";
import { validateGpsForShiftStart } from "@/utils/shiftLocationVerification";

export type VerificationState = "idle" | "verifying" | "resolved" | "failed";

export interface UseVerifyLocationOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  timeoutMs?: number;
}

export interface UseVerifyLocationResult {
  state: VerificationState;
  error: string | null;
  isVerifying: boolean;
  triggerVerification: () => Promise<void>;
  resetVerification: () => void;
}

const DEFAULT_TIMEOUT_MS = LOCATION_TIMEOUT_MS;
const CONTEXT_SYNC_MAX_ATTEMPTS = 30;
const CONTEXT_SYNC_INTERVAL_MS = 100;
const IS_WEB = Platform.OS === "web";

function pickShiftVerificationFix(
  ...candidates: (LocationData | null | undefined)[]
): LocationData | null {
  const acceptable: LocationData[] = [];
  for (const candidate of candidates) {
    if (!hasValidCoordinates(candidate)) continue;
    if (validateGpsForShiftStart(candidate, IS_WEB).isValid) {
      acceptable.push(candidate);
    }
  }
  if (acceptable.length > 0) {
    return pickBestLocationFix(...acceptable);
  }
  return pickBestLocationFix(...candidates);
}

export function useVerifyLocation({
  onSuccess,
  onError,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseVerifyLocationOptions): UseVerifyLocationResult {
  const { currentLocation, locationPermission, requestPermission, refreshLocation } =
    useLocation();

  const [state, setState] = useState<VerificationState>("idle");
  const [error, setError] = useState<string | null>(null);

  const hasTriggeredRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const mountedRef = useRef(true);
  const latestLocationRef = useRef<LocationData | null>(currentLocation);

  useEffect(() => {
    latestLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const failVerification = useCallback((msg: string) => {
    setError(msg);
    setState("failed");
    hasTriggeredRef.current = false;
    onErrorRef.current?.(msg);
  }, []);

  const succeedVerification = useCallback(() => {
    if (!mountedRef.current) return;
    setState("resolved");
    setError(null);
  }, []);

  const resetVerification = useCallback(() => {
    hasTriggeredRef.current = false;
    setState("idle");
    setError(null);
  }, []);

  const validateAtWorkHub = useCallback(
    async (location: LocationData): Promise<string | null> => {
      const workLocation = await getWorkLocationCurrent();
      const hubId = workLocation?.hubId?.trim();
      if (!hubId) {
        return "No work location assigned. Please select your darkstore first.";
      }

      const anchorResult = await ensureDarkstoreVerificationAnchor({
        latitude: location.latitude,
        longitude: location.longitude,
        capturedAt: location.timestamp,
      });

      if (!anchorResult.success || !anchorResult.data?.verification) {
        return (
          anchorResult.error ||
          "Could not set your dark store verification location. Re-select your darkstore and try again."
        );
      }

      let hubName =
        anchorResult.data.name || workLocation.hubName || "your darkstore";
      const hubLat = anchorResult.data.verification.latitude;
      const hubLng = anchorResult.data.verification.longitude;

      const distanceM = Math.round(
        distanceMetersToPoint(
          location.latitude,
          location.longitude,
          hubLat,
          hubLng
        )
      );

      const gpsError = validateGpsForShiftStart(location, IS_WEB, {
        distanceToDarkstoreM: distanceM,
      });
      if (!gpsError.isValid) {
        return gpsError.reason ?? "GPS accuracy too low";
      }

      if (
        !isWithinShiftGeofence(
          location.latitude,
          location.longitude,
          hubLat,
          hubLng,
          SHIFT_GEOFENCE_RADIUS_M
        )
      ) {
        return `Location verification failed. You are ${distanceM}m from ${hubName} (maximum ${SHIFT_GEOFENCE_RADIUS_M}m). Move closer to your darkstore and retry.`;
      }

      const geofence = await validateLocationGeofence(
        hubId,
        location.latitude,
        location.longitude,
        SHIFT_GEOFENCE_RADIUS_M,
        location.accuracy
      );

      if (!geofence.success || !geofence.data) {
        return geofence.error || "Unable to verify location with server";
      }

      if (geofence.data.valid || geofence.data.withinRange) {
        return null;
      }

      hubName =
        geofence.data.location?.name || workLocation.hubName || hubName;
      const serverDistanceM = geofence.data.distanceMeters;
      const radiusM = geofence.data.geofenceRadius ?? SHIFT_GEOFENCE_RADIUS_M;
      if (typeof serverDistanceM === "number") {
        return `Location verification failed. You are ${serverDistanceM}m from ${hubName} (maximum ${radiusM}m). Move closer to your darkstore and retry.`;
      }
      return `Location verification failed. You must be within ${SHIFT_GEOFENCE_RADIUS_M}m of ${hubName} to start your shift.`;
    },
    []
  );

  const runFullVerification = useCallback(
    async (location: LocationData): Promise<boolean> => {
      if (!hasValidCoordinates(location)) {
        failVerification("Could not read your location. Enable GPS and try again.");
        return false;
      }

      const hubError = await validateAtWorkHub(location);
      if (hubError) {
        failVerification(hubError);
        return false;
      }

      succeedVerification();
      return true;
    },
    [validateAtWorkHub, failVerification, succeedVerification]
  );

  const collectLocationCandidates = useCallback(
    (refreshed?: LocationData | null, googleFix?: LocationData | null): LocationData | null => {
      const cached = getCachedLocation()?.location ?? null;
      return pickShiftVerificationFix(
        refreshed ?? null,
        googleFix ?? null,
        latestLocationRef.current,
        cached
      );
    },
    []
  );

  const resolveWithGoogleIfNeeded = useCallback(
    async (deviceFix: LocationData | null): Promise<LocationData | null> => {
      const acceptable = pickShiftVerificationFix(deviceFix);
      if (acceptable) return acceptable;

      const googleFix = await fetchGoogleGeolocation();
      return pickShiftVerificationFix(deviceFix, googleFix);
    },
    []
  );

  const waitForContextLocationSync = useCallback(async (): Promise<LocationData | null> => {
    for (let attempt = 0; attempt < CONTEXT_SYNC_MAX_ATTEMPTS; attempt += 1) {
      const resolved = collectLocationCandidates();
      if (resolved) return resolved;
      await new Promise((resolve) => setTimeout(resolve, CONTEXT_SYNC_INTERVAL_MS));
    }
    return collectLocationCandidates();
  }, [collectLocationCandidates]);

  const fetchVerificationGps = useCallback(async (): Promise<LocationData | null> => {
    if (!IS_WEB) {
      const highAccuracy = await getHighAccuracyLocationForVerification();
      if (highAccuracy) return highAccuracy;
    }
    return refreshLocation();
  }, [refreshLocation]);

  const resolveLocationForVerification = useCallback(async (): Promise<{
    location: LocationData | null;
    error?: string;
  }> => {
    const existing = collectLocationCandidates();
    if (existing) {
      return { location: existing };
    }

    try {
      const refreshed = await Promise.race([
        fetchVerificationGps(),
        new Promise<null>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Location refresh timed out. Enable GPS, move near a window, and try again."
                )
              ),
            timeoutMs
          )
        ),
      ]);

      let resolved = collectLocationCandidates(refreshed);
      if (!resolved) {
        resolved = await waitForContextLocationSync();
      }
      if (!resolved) {
        resolved = await resolveWithGoogleIfNeeded(null);
      } else {
        resolved = await resolveWithGoogleIfNeeded(resolved);
      }

      if (resolved) {
        const gpsError = validateGpsForShiftStart(resolved, IS_WEB);
        if (!gpsError.isValid) {
          const retryFix = await fetchVerificationGps();
          const retryResolved = pickShiftVerificationFix(retryFix, resolved);
          if (retryResolved) {
            const retryValidation = validateGpsForShiftStart(retryResolved, IS_WEB);
            if (retryValidation.isValid) {
              return { location: retryResolved };
            }
          }
          return {
            location: null,
            error:
              gpsError.reason ??
              "GPS signal is too weak. Move closer to an open area and retry.",
          };
        }
        return { location: resolved };
      }

      return {
        location: null,
        error: "Could not detect your location. Turn on location access and try again.",
      };
    } catch (err) {
      const googleOnly = await resolveWithGoogleIfNeeded(
        collectLocationCandidates() ?? latestLocationRef.current
      );
      if (googleOnly) {
        const gpsError = validateGpsForShiftStart(googleOnly, IS_WEB);
        if (gpsError.isValid) return { location: googleOnly };
        return {
          location: null,
          error:
            gpsError.reason ??
            "Could not detect your location. Turn on location access and try again.",
        };
      }

      return {
        location: null,
        error:
          err instanceof Error
            ? err.message
            : "Failed to refresh location. Enable GPS and try again.",
      };
    }
  }, [
    timeoutMs,
    waitForContextLocationSync,
    collectLocationCandidates,
    resolveWithGoogleIfNeeded,
    fetchVerificationGps,
  ]);

  const triggerVerification = useCallback(async () => {
    if (hasTriggeredRef.current || !mountedRef.current) {
      return;
    }

    hasTriggeredRef.current = true;
    setState("verifying");
    setError(null);

    try {
      if (locationPermission !== "granted") {
        const hasPermission = await requestPermission();
        if (!hasPermission) {
          failVerification(
            "Location access is off. Turn on location in Settings to verify you are at your darkstore."
          );
          return;
        }
      }

      const { location, error: resolveError } = await resolveLocationForVerification();
      if (!location) {
        failVerification(resolveError ?? "No location available for verification");
        return;
      }

      await runFullVerification(location);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Verification failed";
      failVerification(errorMsg);
    }
  }, [
    locationPermission,
    requestPermission,
    resolveLocationForVerification,
    runFullVerification,
    failVerification,
  ]);

  return {
    state,
    error,
    isVerifying: state === "verifying",
    triggerVerification,
    resetVerification,
  };
}
