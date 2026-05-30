/**
 * Presence ping — POST /presence/ping while on shift (foreground).
 */

import { apiPost } from "@/utils/apiClient";

export async function sendPresencePing(): Promise<boolean> {
  try {
    await apiPost<{ success: boolean }>("/presence/ping", {
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[PresencePing] Failed:", error instanceof Error ? error.message : error);
    }
    return false;
  }
}

export function startHeartbeat(intervalMs = 30000) {
  return setInterval(() => {
    void sendPresencePing();
  }, intervalMs);
}

export function stopHeartbeat(intervalId: ReturnType<typeof setInterval>) {
  clearInterval(intervalId);
}
