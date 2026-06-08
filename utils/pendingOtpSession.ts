import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LoginMode, OtpTarget } from "@/services/auth.service";

const STORAGE_KEY = "pending_otp_session";

export interface PendingOtpSession {
  loginMode: LoginMode;
  otpTarget: OtpTarget;
  email?: string;
  phone?: string;
  countryCode?: string;
  channel?: string;
  displayTarget?: string;
}

export async function savePendingOtpSession(session: PendingOtpSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function loadPendingOtpSession(): Promise<PendingOtpSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingOtpSession;
  } catch {
    return null;
  }
}

export async function clearPendingOtpSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
