/**
 * Push token registration for order assignment notifications.
 * Registers Expo push token with backend so picker receives push when assigned an order.
 */
import { Platform } from "react-native";
import * as Device from "expo-device";
import { apiPost, getAuthToken } from "@/utils/apiClient";

const PUSH_TOKENS_PATH = "/api/push-tokens";

/**
 * Register push token with backend (for order assignment push notifications).
 * Call after obtaining Expo push token via registerForPushNotifications.
 * Uses authenticated API - backend associates token with logged-in picker.
 */
export async function registerPushToken(expoPushToken: string): Promise<boolean> {
  if (!Device.isDevice) return false;
  const authToken = await getAuthToken();
  if (!authToken) return false;

  try {
    await apiPost<{ registered: boolean }>(PUSH_TOKENS_PATH, {
      token: expoPushToken,
      platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
      deviceId: Device.modelName ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}
