/**
 * Face Verification Service
 *
 * Calls POST /verify/face on the picker API (multipart or JSON base64).
 * Backend returns demo verification until a real provider is configured — see verify.service.js.
 */

import { getPickerApiBaseUrl } from "@/utils/backendUrl";
import { getAuthToken } from "@/utils/apiClient";

const VERIFY_PATH = "/verify/face";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

export type VerifyFacePayload = { uri: string } | { base64: string };

export interface VerifyFaceResult {
  success: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
  confidence?: number;
  matched?: boolean;
  livenessScore?: number;
  /** True when server uses demo / stub verification (no live KYC vendor). */
  isDemoMode?: boolean;
}

function getBaseUrl(): string {
  return getPickerApiBaseUrl().replace(/\/$/, "");
}

/**
 * Call the verify-face API with retries.
 */
export async function verifyFace(
  payload: VerifyFacePayload,
  options?: { baseUrl?: string; token?: string }
): Promise<VerifyFaceResult> {
  if (payload == null || typeof payload !== "object") {
    return {
      success: false,
      error: "Invalid payload: expected an object with uri or base64",
    };
  }
  const hasUri = "uri" in payload && typeof payload.uri === "string";
  const hasBase64 = "base64" in payload && typeof payload.base64 === "string";
  if (!hasUri && !hasBase64) {
    return {
      success: false,
      error: "Invalid payload: must contain uri or base64",
    };
  }

  const baseUrl = (options?.baseUrl ?? getBaseUrl()).replace(/\/$/, "");
  const url = `${baseUrl}${VERIFY_PATH}`;
  let token = options?.token;
  if (token === undefined) {
    try {
      token = (await getAuthToken()) ?? undefined;
    } catch {
      token = undefined;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let res: Response;

      if (hasUri) {
        const form = new FormData();
        form.append("face", {
          uri: (payload as { uri: string }).uri,
          type: "image/jpeg",
          name: "face.jpg",
        } as unknown as Blob);
        res = await fetch(url, { method: "POST", body: form, headers });
      } else {
        headers["Content-Type"] = "application/json";
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ image: (payload as { base64: string }).base64 }),
        });
      }

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const ok = res.ok;

      if (ok) {
        return {
          success: true,
          verified: data.verified === true,
          message: typeof data.message === "string" ? data.message : undefined,
          confidence: typeof data.confidence === "number" ? data.confidence : undefined,
          matched: data.matched === true,
          livenessScore: typeof data.livenessScore === "number" ? data.livenessScore : undefined,
          isDemoMode: data.isDemoMode === true,
        };
      }

      lastError = new Error(
        typeof data.error === "string" ? data.error : `HTTP ${res.status}`
      );
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  return {
    success: false,
    error: lastError?.message ?? "Verification failed",
  };
}
