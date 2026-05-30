import { apiGet, apiPost } from './apiClient';

export interface DiditSessionResponse {
  success: boolean;
  sessionId: string;
  verificationUrl: string;
  alreadyVerified: boolean;
}

export interface DiditStatusResponse {
  success: boolean;
  status: 'not_started' | 'created' | 'pending' | 'APPROVED' | 'DECLINED' | 'REVIEW' | 'EXPIRED';
  sessionId: string | null;
}

export async function createDigitSession(): Promise<DiditSessionResponse> {
  return apiPost<DiditSessionResponse>('/didit/session');
}

export async function getDigitStatus(): Promise<DiditStatusResponse> {
  return apiGet<DiditStatusResponse>('/didit/status');
}
