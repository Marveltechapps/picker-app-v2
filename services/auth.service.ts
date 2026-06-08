/**
 * Auth Service
 *
 * Handles send OTP, resend OTP, and verify OTP per backend-workflow.yaml
 * (auth_send_otp, auth_resend_otp, auth_verify_otp).
 * Supports Mobile / WhatsApp / Email login modes (UI); picker backend currently
 * accepts Indian 10-digit phone OTP only.
 */

import { apiPost, ApiClientError } from "@/utils/apiClient";
import { getPickerApiBaseUrl } from "@/utils/backendUrl";
import { checkHealth } from "@/services/health.service";

export type LoginMode = "mobile" | "email" | "whatsapp";
export type OtpTarget = "phone" | "email";
export type PreferredChannel = "sms" | "whatsapp" | "email";

export interface SendOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
  channel?: string;
  /** Present in dev mode – use for testing verify flow */
  otp?: string;
  /** Alias for otp in dev mode */
  debugOtp?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token?: string;
  isNewUser?: boolean;
  user?: { phone: string; id: string; email?: string; loginMethod?: LoginMode };
  error?: string;
  message?: string;
}

function normalizeSendResponse(response: SendOtpResponse): SendOtpResponse {
  if (response.success === false) {
    return { ...response, error: response.error || response.message || "Failed to send OTP" };
  }
  return { ...response, success: true };
}

function normalizeVerifyResponse(response: VerifyOtpResponse): VerifyOtpResponse {
  const token = typeof response.token === "string" ? response.token.trim() : "";
  if (response.success === false) {
    return {
      ...response,
      error: response.error || response.message || "Verification failed",
    };
  }
  if (token) {
    return { ...response, success: true, token };
  }
  if (response.success !== true) {
    return {
      success: false,
      error: response.error || response.message || "Verification failed",
    };
  }
  return response;
}

function mapAuthApiError(error: unknown, context?: "email"): SendOtpResponse | VerifyOtpResponse {
  if (error instanceof ApiClientError) {
    const msg = error.message || "Request failed";
    if (context === "email" && /phone number is required/i.test(msg)) {
      return {
        success: false,
        error: "Email login is not available on this server. Use Mobile/WhatsApp or update the API.",
      };
    }
    return { success: false, error: msg };
  }
  const msg = error instanceof Error ? error.message : "Request failed";
  return { success: false, error: msg };
}

export interface SendLoginOtpParams {
  loginMode: LoginMode;
  countryCode?: string;
  phone?: string;
  email?: string;
}

export interface VerifyLoginOtpParams {
  otpTarget: OtpTarget;
  otp: string;
  countryCode?: string;
  phone?: string;
  email?: string;
  loginMode?: LoginMode;
}

export interface ResendLoginOtpParams {
  loginMode: LoginMode;
  countryCode?: string;
  phone?: string;
  email?: string;
}

export function getPreferredChannel(loginMode: LoginMode): PreferredChannel {
  if (loginMode === "whatsapp") return "whatsapp";
  if (loginMode === "email") return "email";
  return "sms";
}

export function getChannelLabel(channel?: string, loginMode?: LoginMode): string {
  const normalized = (channel ?? "").toLowerCase();
  if (normalized.includes("whatsapp")) return "WhatsApp";
  if (normalized.includes("email")) return "Email";
  if (loginMode === "whatsapp") return "WhatsApp";
  if (loginMode === "email") return "Email";
  return "SMS";
}

/**
 * Normalize to 10-digit Indian mobile: digits only; strip leading 91 or 0.
 */
function normalizeIndianPhone(phone: string): string {
  const digits = (phone ?? "").toString().replace(/\D/g, "");
  if (digits.length === 10 && /^[5-9]/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizeIndianPhone(phone);
  return normalized.length === 10 && /^[5-9]/.test(normalized);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test((email ?? "").trim());
}

/**
 * Pre-flight API reachability check before send-otp.
 */
export async function probeApiHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await checkHealth();
    return { ok: true };
  } catch {
    const baseUrl = getPickerApiBaseUrl();
    return {
      ok: false,
      error: `Cannot reach API (${baseUrl}). Check your connection and server URL.`,
    };
  }
}

/**
 * POST /auth/send-otp – multi-mode entry (maps to picker phone API for mobile/whatsapp).
 */
export async function sendEmailOtp(email: string): Promise<SendOtpResponse> {
  try {
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !validateEmailFormat(normalized)) {
      return { success: false, error: "Please enter a valid email address" };
    }
    const response = await apiPost<SendOtpResponse>("/auth/send-otp", {
      email: normalized,
      preferredChannel: "email",
    });
    return normalizeSendResponse({ ...response, channel: response.channel ?? "email" });
  } catch (error) {
    return mapAuthApiError(error, "email") as SendOtpResponse;
  }
}

export async function resendEmailOtp(email: string): Promise<SendOtpResponse> {
  try {
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !validateEmailFormat(normalized)) {
      return { success: false, error: "Please enter a valid email address" };
    }
    const response = await apiPost<SendOtpResponse>("/auth/resend-otp", {
      email: normalized,
    });
    return normalizeSendResponse({ ...response, channel: response.channel ?? "email" });
  } catch (error) {
    return mapAuthApiError(error, "email") as SendOtpResponse;
  }
}

export async function verifyEmailOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
  try {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    if (!normalizedEmail || !validateEmailFormat(normalizedEmail)) {
      return { success: false, error: "Email address is missing or invalid." };
    }
    const normalizedOtp = (otp ?? "").toString().trim();
    const response = await apiPost<VerifyOtpResponse>("/auth/verify-otp", {
      email: normalizedEmail,
      otp: normalizedOtp,
    });
    return normalizeVerifyResponse(response);
  } catch (error) {
    return mapAuthApiError(error, "email") as VerifyOtpResponse;
  }
}

export async function sendLoginOtp(params: SendLoginOtpParams): Promise<SendOtpResponse> {
  if (params.loginMode === "email") {
    const email = (params.email ?? "").trim().toLowerCase();
    if (!email) {
      return { success: false, error: "Enter email address" };
    }
    if (!validateEmailFormat(email)) {
      return { success: false, error: "Please enter a valid email address" };
    }
    return sendEmailOtp(email);
  }

  const nationalDigits = (params.phone ?? "").replace(/\D/g, "");
  if (!nationalDigits) {
    return {
      success: false,
      error: params.loginMode === "whatsapp" ? "Enter WhatsApp number" : "Enter mobile number",
    };
  }

  const dial = params.countryCode ?? "+91";
  if (dial !== "+91") {
    return {
      success: false,
      error: "Only Indian mobile numbers (+91) are supported at this time.",
    };
  }

  if (!isValidIndianPhone(nationalDigits)) {
    return { success: false, error: "Invalid number format" };
  }

  const result = await sendOtp(nationalDigits, getPreferredChannel(params.loginMode));
  if (result.success) {
    return {
      ...result,
      channel: params.loginMode === "whatsapp" ? "whatsapp" : "sms",
    };
  }
  return result;
}

/**
 * POST /auth/resend-otp – multi-mode resend.
 */
export async function resendLoginOtp(params: ResendLoginOtpParams): Promise<SendOtpResponse> {
  if (params.loginMode === "email") {
    return resendEmailOtp(params.email ?? "");
  }
  return sendLoginOtp({
    loginMode: params.loginMode,
    countryCode: params.countryCode,
    phone: params.phone,
    email: params.email,
  });
}

/**
 * POST /auth/verify-otp – multi-mode verify.
 */
export async function verifyLoginOtp(params: VerifyLoginOtpParams): Promise<VerifyOtpResponse> {
  if (params.otpTarget === "email") {
    return verifyEmailOtp(params.email ?? "", params.otp);
  }

  const nationalDigits = (params.phone ?? "").replace(/\D/g, "");
  if (!nationalDigits || !isValidIndianPhone(nationalDigits)) {
    return { success: false, error: "Phone number is missing or invalid." };
  }
  return verifyOtp(nationalDigits, params.otp, params.loginMode);
}

/**
 * POST /auth/send-otp – send OTP to phone
 * Body: { phone: string } – 10 digits (e.g. 6556734235)
 */
export async function sendOtp(
  phone: string,
  preferredChannel: PreferredChannel = "sms"
): Promise<SendOtpResponse> {
  try {
    const normalized = normalizeIndianPhone(phone);
    if (normalized.length !== 10 || !/^[5-9]/.test(normalized)) {
      return {
        success: false,
        error: "Invalid phone number format. Enter a valid 10-digit mobile number (e.g. 6556734235).",
      };
    }
    const response = await apiPost<SendOtpResponse>("/auth/send-otp", {
      phone: normalized,
      preferredChannel,
    });
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * POST /auth/resend-otp – resend OTP to phone.
 */
export async function resendOtp(phone: string): Promise<SendOtpResponse> {
  try {
    const normalized = normalizeIndianPhone(phone);
    if (normalized.length !== 10 || !/^[5-9]/.test(normalized)) {
      return { success: false, error: "Invalid phone number format. Enter a valid 10-digit mobile number." };
    }
    const response = await apiPost<SendOtpResponse>("/auth/resend-otp", { phone: normalized });
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * POST /auth/verify-otp – verify OTP and get JWT
 * Body: { phone: string, otp: string }
 */
/** Server logout hook (picker API has no logout route; local session clear is in authContext). */
export async function logoutApi(): Promise<void> {
  return;
}

export async function verifyOtp(
  phone: string,
  otp: string,
  loginMode?: LoginMode
): Promise<VerifyOtpResponse> {
  try {
    const normalizedPhone = normalizeIndianPhone(phone);
    if (normalizedPhone.length !== 10 || !/^[5-9]/.test(normalizedPhone)) {
      return { success: false, error: "Enter a valid 10-digit mobile number." };
    }
    const normalizedOtp = (otp ?? "").toString().trim();

    const response = await apiPost<VerifyOtpResponse>("/auth/verify-otp", {
      phone: normalizedPhone,
      otp: normalizedOtp,
      ...(loginMode && { preferredChannel: getPreferredChannel(loginMode) }),
    });

    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
