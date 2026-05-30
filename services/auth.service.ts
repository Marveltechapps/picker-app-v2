/**
 * Auth Service
 *
 * Handles send OTP, resend OTP, and verify OTP per backend-workflow.yaml
 * (auth_send_otp, auth_resend_otp, auth_verify_otp).
 */

import { apiPost, ApiClientError } from "@/utils/apiClient";

export interface SendOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
  /** Present in dev mode – use for testing verify flow */
  otp?: string;
  /** Alias for otp in dev mode */
  debugOtp?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token?: string;
  isNewUser?: boolean;
  user?: { phone: string; id: string };
  error?: string;
}

/**
 * Normalize to 10-digit: digits only; strip leading 91 or 0.
 * Same logic as backend so "6556734235", "916556734235", "06556734235" all work.
 */
function normalizePhone(phone: string): string {
  const digits = (phone ?? "").toString().replace(/\D/g, "");
  if (digits.length === 10 && /^[5-9]/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * POST /auth/send-otp – send OTP to phone
 * Body: { phone: string } – 10 digits (e.g. 6556734235)
 */
export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  try {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10 || !/^[5-9]/.test(normalized)) {
      return { success: false, error: "Invalid phone number format. Enter a valid 10-digit mobile number (e.g. 6556734235)." };
    }
    const response = await apiPost<SendOtpResponse>("/auth/send-otp", { phone: normalized });
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * POST /auth/resend-otp – resend OTP to phone (e.g. for Resend button on OTP screen).
 * Body: { phone: string } – 10 digits. Backend may apply resend-specific rate limits.
 */
export async function resendOtp(phone: string): Promise<SendOtpResponse> {
  try {
    const normalized = normalizePhone(phone);
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
export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  try {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length !== 10 || !/^[5-9]/.test(normalizedPhone)) {
      return { success: false, error: "Enter a valid 10-digit mobile number." };
    }
    const normalizedOtp = (otp ?? "").toString().trim();
    
    console.log(`[Auth Service] verifyOtp called - phone: "${phone}" -> normalized: "${normalizedPhone}", otp: "${otp}" -> normalized: "${normalizedOtp}"`);
    
    const response = await apiPost<VerifyOtpResponse>("/auth/verify-otp", {
      phone: normalizedPhone,
      otp: normalizedOtp,
    });
    
    console.log(`[Auth Service] verifyOtp response:`, { success: response.success, hasToken: !!response.token, error: response.error });
    return response;
  } catch (error) {
    console.error(`[Auth Service] verifyOtp error:`, error);
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
