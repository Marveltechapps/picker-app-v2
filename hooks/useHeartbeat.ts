/**
 * Periodic POST /presence/ping when logged in, shift active, and app is foregrounded.
 */

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { startHeartbeat, stopHeartbeat, sendPresencePing } from "@/services/heartbeat.service";
import { getPickerConfig } from "@/services/config.service";

const DEFAULT_INTERVAL_MS = 30 * 1000;

interface UseHeartbeatOptions {
  /** When true, presence pings run (typically hasCompletedLogin && shiftActive). */
  enabled: boolean;
}

export function useHeartbeat({ enabled }: UseHeartbeatOptions) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalMsRef = useRef<number>(DEFAULT_INTERVAL_MS);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        stopHeartbeat(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const restartInterval = (ms: number) => {
      if (intervalRef.current) {
        stopHeartbeat(intervalRef.current);
        intervalRef.current = null;
      }
      intervalRef.current = startHeartbeat(ms);
    };

    const tick = () => {
      if (appStateRef.current !== "active") return;
      void sendPresencePing();
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        appStateRef.current = "active";
        tick();
        restartInterval(intervalMsRef.current);
      } else {
        appStateRef.current = nextState;
        if (intervalRef.current) {
          stopHeartbeat(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    getPickerConfig()
      .then((config) => {
        if (cancelled) return;
        const ms = config.heartbeatIntervalMs ?? DEFAULT_INTERVAL_MS;
        intervalMsRef.current = ms;
        if (appStateRef.current === "active") {
          tick();
          restartInterval(ms);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (appStateRef.current === "active") {
          tick();
          restartInterval(DEFAULT_INTERVAL_MS);
        }
      });

    if (appStateRef.current === "active") {
      tick();
      restartInterval(DEFAULT_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      subscription.remove();
      if (intervalRef.current) {
        stopHeartbeat(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);
}
