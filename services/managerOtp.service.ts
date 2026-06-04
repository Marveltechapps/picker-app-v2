import { apiPost, ApiClientError } from "@/utils/apiClient";

export interface RequestManagerOtpResponse {
  success?: boolean;
  message?: string;
  maskedPhone?: string;
  devOtp?: string;
  expiresInMinutes?: number;
  error?: string;
}

export interface VerifyManagerOtpResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export async function requestManagerApprovalOtp(): Promise<RequestManagerOtpResponse> {
  return apiPost<RequestManagerOtpResponse>("/manager/request-otp", {});
}

export async function verifyManagerApprovalOtp(
  otp: string
): Promise<VerifyManagerOtpResponse> {
  return apiPost<VerifyManagerOtpResponse>("/manager/verify-otp", { otp });
}

export function getManagerOtpErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
