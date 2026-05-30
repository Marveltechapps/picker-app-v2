/**
 * Auth helpers — decode JWT on-device to extract user id (sub).
 * Best-effort only; backend remains authoritative.
 */
import { getAuthToken } from "@/utils/apiClient";

function base64UrlDecode(input: string): string | null {
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    // Try browser atob
    if (typeof atob === "function") {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(padded), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    }
    // Fallback to Buffer (Node / Metro)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Buffer } = require("buffer");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function getUserIdFromToken(): Promise<string | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = base64UrlDecode(parts[1]);
    if (!payload) return null;
    try {
      const parsed = JSON.parse(payload);
      // Common claim names: sub, userId, id
      return (parsed && (parsed.sub || parsed.userId || parsed.id)) ?? null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired.
 * @param token The JWT string.
 * @param bufferSeconds Optional buffer in seconds (default 60s).
 */
export function isTokenExpired(token: string | null, bufferSeconds = 60): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const payloadStr = base64UrlDecode(parts[1]);
    if (!payloadStr) return true;
    const payload = JSON.parse(payloadStr);
    if (!payload.exp) return false; // If no exp claim, assume it doesn't expire
    
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < (currentTime + bufferSeconds);
  } catch {
    return true;
  }
}

