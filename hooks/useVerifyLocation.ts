/**
 * useVerifyLocation
 * 
 * Strict location verification hook.
 * - Attempts real verification only
 * - Never falls back to sample/dummy success
 * - Resolves success only when verification truly passes
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useLocation } from "@/state/locationContext";
import { verifyLocation, safeVerifyLocation, type LocationData } from "@/utils/locationService";

export type VerificationState = "idle" | "verifying" | "resolved" | "failed";

export interface UseVerifyLocationOptions {
  /** Called when verification succeeds */
  onSuccess: () => void;
  /** Called when verification fails */
  onError?: (error: string) => void;
  /** Timeout for verification attempt (default: 10 seconds) */
  timeoutMs?: number;
}

export interface UseVerifyLocationResult {
  state: VerificationState;
  error: string | null;
  isVerifying: boolean;
  triggerVerification: () => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 2500;

export function useVerifyLocation({
  onSuccess,
  onError,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseVerifyLocationOptions): UseVerifyLocationResult {
  const { currentLocation, locationPermission, requestPermission, refreshLocation, isLoading } = useLocation();
  
  const [state, setState] = useState<VerificationState>("idle");
  const [error, setError] = useState<string | null>(null);
  
  // Refs to prevent double execution and track state
  const hasTriggeredRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const mountedRef = useRef(true);
  const latestLocationRef = useRef<LocationData | null>(currentLocation);
  
  // Keep location ref updated
  useEffect(() => {
    latestLocationRef.current = currentLocation;
  }, [currentLocation]);

  // Update callback refs
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hasTriggeredRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Attempt real location verification
   */
  const attemptRealVerification = useCallback(async (location: LocationData): Promise<boolean> => {
    try {
      // Use safe verification (with relaxed requirements for web)
      const result = safeVerifyLocation(location, Platform.OS === "web");
      
      if (result.isValid) {
        console.log("[useVerifyLocation] Real verification succeeded");
        return true;
      } else {
        console.log("[useVerifyLocation] Real verification failed:", result.reason);
        if (onErrorRef.current) {
          onErrorRef.current(result.reason || "Location verification failed");
        }
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Verification error";
      console.error("[useVerifyLocation] Verification error:", errorMsg);
      if (onErrorRef.current) {
        onErrorRef.current(errorMsg);
      }
      return false;
    }
  }, []);

  /**
   * Main verification trigger
   */
  const triggerVerification = useCallback(async () => {
    // Prevent double execution
    if (hasTriggeredRef.current || !mountedRef.current) {
      return;
    }

    // Clear any existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    hasTriggeredRef.current = true;
    setState("verifying");
    setError(null);

    // Real verification flow
    try {
      // Step 1: Ensure permission
      if (locationPermission !== "granted") {
        console.log("[useVerifyLocation] Requesting location permission");
        const hasPermission = await requestPermission();
        
        if (!hasPermission) {
          const msg = "Location permission denied";
          console.warn("[useVerifyLocation] Permission denied");
          setError(msg);
          setState("failed");
          hasTriggeredRef.current = false;
          onErrorRef.current?.(msg);
          return;
        }
      }

      // Step 2: Prefer the already-available live location so verification feels instant.
      const currentKnownLocation = latestLocationRef.current;
      if (currentKnownLocation) {
        const verifiedCurrent = await attemptRealVerification(currentKnownLocation);
        if (verifiedCurrent) {
          if (!mountedRef.current) return;
          setState("resolved");
          setTimeout(() => {
            if (mountedRef.current && onSuccessRef.current) {
              onSuccessRef.current();
            }
          }, 250);
          return;
        }
      }

      // Step 3: Refresh only when we do not already have a valid recent location.
      console.log("[useVerifyLocation] Refreshing location for verification");
      try {
        await Promise.race([
          refreshLocation(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Location refresh timed out")), timeoutMs)
          ),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to refresh location";
        console.warn("[useVerifyLocation] Failed to refresh location");
        setError(msg);
        setState("failed");
        hasTriggeredRef.current = false;
        onErrorRef.current?.(msg);
        return;
      }

      // Step 4: Use the refreshed location from ref
      const location = latestLocationRef.current;
      if (!location) {
        const msg = "No location available for verification";
        console.warn("[useVerifyLocation] No location available after refresh");
        setError(msg);
        setState("failed");
        hasTriggeredRef.current = false;
        onErrorRef.current?.(msg);
        return;
      }

      // Step 5: Attempt real verification
      const verified = await attemptRealVerification(location);

      if (verified) {
        // Real verification succeeded
        if (!mountedRef.current) return;
        
        // Clear timeout since we succeeded
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        setState("resolved");
        hasTriggeredRef.current = true;
        
        setTimeout(() => {
          if (mountedRef.current && onSuccessRef.current) {
            onSuccessRef.current();
          }
        }, 250);
      } else {
        const msg = "Location verification failed";
        console.log("[useVerifyLocation] Real verification failed");
        setError(msg);
        setState("failed");
        hasTriggeredRef.current = false;
        onErrorRef.current?.(msg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Verification failed";
      console.error("[useVerifyLocation] Verification error:", errorMsg);
      setError(errorMsg);
      setState("failed");
      hasTriggeredRef.current = false;
      onErrorRef.current?.(errorMsg);
    }

  }, [
    locationPermission,
    currentLocation,
    isLoading,
    requestPermission,
    refreshLocation,
    attemptRealVerification,
    timeoutMs,
  ]);

  // Reset trigger flag when component unmounts or becomes invisible
  // This ensures the hook can be re-triggered on next mount
  useEffect(() => {
    return () => {
      // Reset trigger flag on unmount to allow re-triggering
      hasTriggeredRef.current = false;
    };
  }, []);

  return {
    state,
    error,
    isVerifying: state === "verifying",
    triggerVerification,
  };
}
