/**
 * API Client Utility
 *
 * Centralized HTTP client with authentication, error handling, and request/response interceptors.
 * Uses fetch API (React Native compatible).
 */

import { DeviceEventEmitter } from "react-native";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { getPickerApiBaseUrl } from "@/utils/backendUrl";

const DEFAULT_BASE_URL = getPickerApiBaseUrl();

if (typeof __DEV__ !== "undefined" && __DEV__) {
  console.log("[API] Base URL:", DEFAULT_BASE_URL);
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export class ApiClientError extends Error {
  code?: string;
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Get auth token from storage (exported so screens can skip auth-only API calls when not logged in).
 * Uses SecureStore for encrypted storage.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const SecureStore = await import("expo-secure-store");
    return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    // Fallback to AsyncStorage if SecureStore fails or is unavailable (e.g. web if not configured)
    try {
      const AsyncStorage = await import("@react-native-async-storage/async-storage");
      return await AsyncStorage.default.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch {
      return null;
    }
  }
}

/** Clear stored auth token (no AuthContext import — safe from apiClient). */
export async function clearStoredAuthToken(): Promise<void> {
  try {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    /* ignore */
  }
  try {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    await AsyncStorage.default.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    /* ignore */
  }
}

/**
 * API Client with automatic auth and error handling
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = DEFAULT_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;

  // Get auth token
  const token = await getAuthToken();
  
  // Prepare headers (Record so we can set Authorization; HeadersInit is not string-indexable in TS)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const optHeaders = options.headers;
  if (optHeaders && typeof optHeaders === "object" && !Array.isArray(optHeaders) && !(optHeaders instanceof Headers)) {
    for (const [k, v] of Object.entries(optHeaders as Record<string, string>)) {
      if (v != null) headers[k] = String(v);
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");

    let data: unknown;
    if (isJson) {
      data = await response.json().catch(() => ({}));
    } else {
      data = await response.text().catch(() => "");
    }

    if (!response.ok) {
      const errorData = data as { message?: string; error?: string; code?: string; details?: unknown };
      if (response.status === 401) {
        await clearStoredAuthToken();
        DeviceEventEmitter.emit("auth:logout", { reason: "unauthorized" });
      }
      const fallbackMessage =
        response.status === 502 || response.status === 503 || response.status === 504
          ? "API server is unavailable. If you are developing locally, start the backend (npm run dev in selorg-dashboard-backend-v1.1) and set EXPO_PUBLIC_API_URL to your machine IP on port 3333."
          : `HTTP ${response.status}`;
      throw new ApiClientError(
        errorData.message || errorData.error || fallbackMessage,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    const hint =
      typeof __DEV__ !== "undefined" && __DEV__
        ? " Check that EXPO_PUBLIC_API_URL is set correctly and the backend is running."
        : "";

    throw new ApiClientError(
      (error instanceof Error ? error.message : "Network request failed") + hint,
      0,
      "NETWORK_ERROR"
    );
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "GET" });
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * POST multipart/form-data (e.g. file upload). Do not set Content-Type so fetch sets boundary.
 */
export async function apiPostFormData<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
  const baseUrl = DEFAULT_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const data = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => "");
  if (!response.ok) {
    const err = data as { message?: string; error?: string; code?: string };
    if (response.status === 401) {
      await clearStoredAuthToken();
      DeviceEventEmitter.emit("auth:logout", { reason: "unauthorized" });
    }
    throw new ApiClientError(err.message || err.error || `HTTP ${response.status}`, response.status, err.code);
  }
  return data as T;
}

/**
 * PUT request helper
 */
export async function apiPut<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "DELETE" });
}
