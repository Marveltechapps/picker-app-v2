/**
 * Shifts Service
 *
 * Handles shifts per backend-workflow.yaml
 * (shifts_available, shifts_select, shift_start, shift_end, start_break, end_break).
 * Uses queue-aware API for punch-in, punch-out, break actions with idempotencyKey.
 */

import { apiGet, apiPost, getAuthToken, ApiClientError } from "@/utils/apiClient";
import { fetchWithQueue } from "@/utils/queueAwareApi";
import {
  punchInIdempotencyKey,
  punchOutIdempotencyKey,
  startBreakIdempotencyKey,
  endBreakIdempotencyKey,
} from "@/utils/idempotency";
import { getUserIdFromToken } from "@/utils/auth";

export interface ShiftItem {
  id: string;
  name: string;
  time: string;
  duration?: string;
  orders?: number;
  basePay?: number;
  color?: string;
  limitedSpots?: boolean;
  locationType?: string;
}

export interface ShiftSelection {
  id: string;
  name: string;
  time: string;
}

export interface ShiftReadinessApiData {
  deviceAssigned: boolean;
  personalInformationComplete: boolean;
  bankAccountComplete: boolean;
  trainingComplete: boolean;
  documentVerificationComplete: boolean;
  canStartShift: boolean;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/** User identifier for idempotency (phoneNumber or profile id) */
type UserId = string;

/**
 * GET /shifts/available – return available shifts
 * When lat/lng provided, shifts are geo-fenced to nearby stores (radiusKm default 3)
 */
export async function getAvailableShifts(params?: { lat?: number; lng?: number; radiusKm?: number }): Promise<ShiftItem[]> {
  try {
    const q = new URLSearchParams();
    if (params?.lat != null) q.set("lat", String(params.lat));
    if (params?.lng != null) q.set("lng", String(params.lng));
    if (params?.radiusKm != null) q.set("radiusKm", String(params.radiusKm));
    const query = q.toString();
    const url = query ? `/shifts/available?${query}` : "/shifts/available";
    const res = await apiGet<ApiDataResponse<ShiftItem[]>>(url);
    return (res as ApiDataResponse<ShiftItem[]>).data ?? [];
  } catch (error) {
    if (error instanceof ApiClientError) return [];
    throw error;
  }
}

/**
 * GET /shifts/readiness – profile prerequisites for starting a shift.
 */
export async function getShiftReadinessApi(): Promise<ShiftReadinessApiData> {
  const res = await apiGet<ApiDataResponse<ShiftReadinessApiData>>("/shifts/readiness");
  return (res as ApiDataResponse<ShiftReadinessApiData>).data;
}

/**
 * POST /shifts/select – persist selected shifts.
 * If user is not logged in (no token), skips API and returns success so flow can continue without 401.
 */
export async function selectShiftsApi(
  selectedShifts: ShiftSelection[]
): Promise<{ success: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) {
    return { success: true };
  }
  try {
    await apiPost<{ success: boolean }>("/shifts/select", { selectedShifts });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * POST /shifts/start – punch in (optional body: location, shiftId)
 * Uses queue-aware API; on network error adds to offline queue.
 */
export async function startShiftApi(
  body?: {
    location?: unknown;
    shiftId?: string;
    locationId?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    accuracyMeters?: number;
  },
  userId?: UserId
): Promise<{ success: boolean; shiftStartTime?: number; error?: string; queued?: boolean }> {
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = punchInIdempotencyKey(uid, body?.shiftId);
  try {
    const res = await fetchWithQueue<ApiDataResponse<{ shiftStartTime?: number }>>(
      "/shifts/start",
      { method: "POST", body: (body ?? {}) as Record<string, unknown> },
      { actionType: "punch-in", idempotencyKey }
    );
    const data = (res as ApiDataResponse<{ shiftStartTime?: number }>).data;
    return { success: true, shiftStartTime: data?.shiftStartTime };
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued = error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
      return {
        success: queued ? true : false,
        error: error.message,
        queued,
      };
    }
    throw error;
  }
}

/**
 * POST /shifts/end – punch out
 * Uses queue-aware API; on network error adds to offline queue.
 */
export async function endShiftApi(userId?: UserId): Promise<{
  success: boolean;
  error?: string;
  queued?: boolean;
}> {
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = punchOutIdempotencyKey(uid);
  try {
    await fetchWithQueue<{ success: boolean }>(
      "/shifts/end",
      { method: "POST", body: {} as Record<string, unknown> },
      { actionType: "punch-out", idempotencyKey }
    );
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued = error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
      return {
        success: queued ? true : false,
        error: error.message,
        queued,
      };
    }
    throw error;
  }
}

/**
 * POST /shifts/start-break – start break
 * Uses queue-aware API with idempotencyKey.
 */
export async function startBreakApi(userId?: UserId): Promise<{
  success: boolean;
  error?: string;
  queued?: boolean;
}> {
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = startBreakIdempotencyKey(uid);
  try {
    await fetchWithQueue<{ success: boolean }>(
      "/shifts/start-break",
      { method: "POST", body: {} as Record<string, unknown> },
      { actionType: "start-break", idempotencyKey }
    );
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued = error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
      return {
        success: queued ? true : false,
        error: error.message,
        queued,
      };
    }
    throw error;
  }
}

/**
 * POST /shifts/end-break – end break
 * Uses queue-aware API with idempotencyKey.
 */
export async function endBreakApi(userId?: UserId): Promise<{
  success: boolean;
  error?: string;
  queued?: boolean;
}> {
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = endBreakIdempotencyKey(uid);
  try {
    await fetchWithQueue<{ success: boolean }>(
      "/shifts/end-break",
      { method: "POST", body: {} as Record<string, unknown> },
      { actionType: "end-break", idempotencyKey }
    );
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued = error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
      return {
        success: queued ? true : false,
        error: error.message,
        queued,
      };
    }
    throw error;
  }
}
