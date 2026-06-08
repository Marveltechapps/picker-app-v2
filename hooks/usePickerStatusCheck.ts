/**
 * Hook to check picker status and redirect appropriately.
 * Uses WebSocket for real-time status updates (no polling).
 * - Under-review: shown ONLY after document upload flow; only when hasCompletedDocuments and PENDING.
 * - Approved (ACTIVE): user enters app; redirect from under-review to verification when applicable.
 * - Rejected/Blocked/Suspended: redirect to respective screens.
 */
import { useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { getProfileApi } from "@/services/user.service";
import { getAuthToken } from "@/utils/apiClient";
import { useAuth } from "@/state/authContext";
import { pickerWebSocketService } from "@/utils/websocket.service";
import { isTokenExpired } from "@/utils/auth";

const STATUS_SCREENS = ["rejection", "under-review", "blocked", "suspended"];

export function usePickerStatusCheck() {
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  const { hasCompletedLogin, logout } = useAuth();
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const checkAndRedirect = useCallback(async () => {
    const token = await getAuthToken();
    
    // Requirement: verify JWT expiry whenever app is opened/foregrounded
    if (token && isTokenExpired(token)) {
      if (__DEV__) console.log("[StatusCheck] Token expired, logging out");
      await logout();
      router.replace("/login");
      return;
    }

    if (!token || !hasCompletedLogin) return;

    const seg0 = segmentsRef.current?.[0];
    if (STATUS_SCREENS.includes(seg0 as string)) {
      // If on under-review, check status: approved -> verification; rejected -> rejection
      if (seg0 === "under-review") {
        try {
          const profileData = await getProfileApi();
          const status = profileData?.status?.toUpperCase?.();
          if (status === "ACTIVE") {
            router.replace("/(tabs)");
            return;
          }
          if (status === "REJECTED") {
            router.replace({
              pathname: "/rejection",
              params: { rejectedReason: profileData?.rejectedReason || "Your application has been rejected." },
            });
            return;
          }
          // PENDING: stay on under-review
        } catch {
          // Ignore; stay on under-review
        }
      }
      return;
    }

    try {
      const profileData = await getProfileApi();
      const status = profileData?.status?.toUpperCase?.();

      if (status === "REJECTED") {
        router.replace({
          pathname: "/rejection",
          params: { rejectedReason: profileData?.rejectedReason || "Your application has been rejected." },
        });
        return;
      }
      if (status === "BLOCKED") {
        await logout();
        router.replace("/blocked");
        return;
      }
      if (status === "SUSPENDED") {
        router.replace("/suspended");
        return;
      }
    } catch {
      // Ignore fetch errors; user stays on current screen
    }
  }, [hasCompletedLogin, router, logout]);

  useEffect(() => {
    if (!hasCompletedLogin) return;
    checkAndRedirect();
  }, [hasCompletedLogin, checkAndRedirect]);

  useEffect(() => {
    if (!hasCompletedLogin) return;
    pickerWebSocketService.connect();
    const handler = () => checkAndRedirect();
    pickerWebSocketService.on("PICKER_STATUS_CHANGED", handler);
    pickerWebSocketService.on("order:updated", handler);
    return () => {
      pickerWebSocketService.off("PICKER_STATUS_CHANGED", handler);
      pickerWebSocketService.off("order:updated", handler);
    };
  }, [hasCompletedLogin, checkAndRedirect]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        appStateRef.current = nextState;
        checkAndRedirect();
      } else {
        appStateRef.current = nextState;
      }
    });
    return () => subscription.remove();
  }, [checkAndRedirect]);
}
