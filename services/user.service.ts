/**
 * User Service
 *
 * Handles user profile and preferences per backend-workflow.yaml
 * (user_profile_upsert, location_type_set, upi_upsert).
 */

import { apiGet, apiPut, ApiClientError } from "@/utils/apiClient";
import { getUserIdFromToken } from "@/utils/auth";
import { getCached, setCached } from "@/utils/asyncStorageCache";

/** Picker status from backend (PENDING, ACTIVE, REJECTED, BLOCKED, SUSPENDED). */
export type PickerStatus = "PENDING" | "ACTIVE" | "REJECTED" | "BLOCKED" | "SUSPENDED";

/** GET /users/profile response (current user profile for display). */
export interface UserProfileApiData {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: "male" | "female";
  photoUri?: string;
  createdAt?: string;
  selectedShifts?: unknown[];
  locationType?: string;
  trainingProgress?: Record<string, unknown>;
  upiId?: string;
  upiName?: string;
  upiPayoutVerificationStatus?: "none" | "pending" | "verified" | "rejected";
  upiPayoutRejectionReason?: string;
  /** Picker approval status. */
  status?: PickerStatus;
  /** Reason when status is REJECTED. */
  rejectedReason?: string;
  /** ISO date when rejected. */
  rejectedAt?: string;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;

function profileCacheKey(userId: string): string {
  return `picker_profile_${userId}`;
}

/**
 * GET /users/profile or GET /me – fetch current user profile (after login).
 * Returns status, rejectedReason, rejectedAt for picker approval flow.
 * Cached 10 minutes per user; on network error returns stale cache if present.
 */
export async function getProfileApi(): Promise<UserProfileApiData | null> {
  const uid = (await getUserIdFromToken()) ?? "anon";
  const cacheKey = profileCacheKey(uid);

  try {
    const res = await apiGet<ApiDataResponse<UserProfileApiData>>("/users/profile");
    const data = (res as ApiDataResponse<UserProfileApiData>).data ?? null;
    if (data) await setCached(cacheKey, data);
    return data;
  } catch (e) {
    const stale = await getCached<UserProfileApiData>(cacheKey, PROFILE_CACHE_TTL_MS);
    if (stale) return stale;
    throw e;
  }
}

export interface UserProfilePayload {
  name: string;
  age: number;
  gender: "male" | "female";
  photoUri?: string;
  email?: string;
  phone?: string;
}

export interface UserProfileApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * PUT /users/profile – update user profile
 * Body: { name, age, gender, photoUri?, email?, phone? }
 */
export async function updateProfileApi(
  profile: UserProfilePayload
): Promise<UserProfileApiResponse> {
  try {
    const body: Record<string, unknown> = {
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
    };
    if (profile.photoUri != null) body.photoUri = profile.photoUri;
    if (profile.email != null) body.email = profile.email;
    if (profile.phone != null) body.phone = profile.phone;
    const response = await apiPut<{ success: boolean; data?: Record<string, unknown> }>(
      "/users/profile",
      body
    );
    return { success: true, data: (response as { data?: Record<string, unknown> }).data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * PUT /users/location-type – set location type (warehouse | darkstore)
 */
export async function setLocationTypeApi(
  locationType: "warehouse" | "darkstore"
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPut<{ success: boolean }>("/users/location-type", { locationType });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * PUT /users/upi – set UPI id and name
 */
export async function setUpiApi(
  upiId: string,
  upiName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPut<{ success: boolean }>("/users/upi", { upiId, upiName });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
