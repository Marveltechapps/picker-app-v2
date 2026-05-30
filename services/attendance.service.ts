/**
 * Attendance Service
 *
 * Handles attendance summary per backend-workflow.yaml (attendance_summary).
 */

import { apiGet, ApiClientError } from "@/utils/apiClient";

export interface AttendanceDetail {
  date: string;
  punchIn: string;
  punchOut?: string;
  totalHours: number;
  warehouse?: string;
  /** Alternate keys some APIs use for the hub / site name */
  warehouseName?: string;
  warehouse_name?: string;
  hubName?: string;
  locationName?: string;
  storeName?: string;
  orders?: number;
  incentive?: number;
  overtime?: number | null;
  status?: string;
}

export interface AttendanceSummary {
  details: AttendanceDetail[];
  ot: AttendanceDetail[];
  history: AttendanceDetail[];
}

/** Dashboard stats from GET /attendance/stats */
export interface AttendanceStats {
  /** True when there is an active attendance record (punched in and not completed) for today. */
  isShiftActive?: boolean;
  /** Shift start time (ms since epoch) for the active attendance record, if any. */
  activeShiftStartTime?: number | null;
  todayOrders: number;
  todayEarnings: number;
  todayIncentives: number;
  weeklyEarnings: { day: string; value: number }[];
  performance: { accuracy: number; speed: number; topPercent: number };
  hubName: string | null;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/**
 * GET /attendance/summary – query params month, year
 */
export async function getAttendanceSummary(params?: {
  month?: number;
  year?: number;
}): Promise<AttendanceSummary> {
  try {
    const q = new URLSearchParams();
    if (params?.month != null) q.append("month", String(params.month));
    if (params?.year != null) q.append("year", String(params.year));
    const query = q.toString();
    const endpoint = `/attendance/summary${query ? `?${query}` : ""}`;
    const res = await apiGet<ApiDataResponse<AttendanceSummary>>(endpoint);
    const data = (res as ApiDataResponse<AttendanceSummary>).data;
    return data ?? { details: [], ot: [], history: [] };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { details: [], ot: [], history: [] };
    }
    throw error;
  }
}

/**
 * GET /attendance/stats – dashboard stats for home screen (today orders/earnings, weekly chart, performance).
 */
export async function getAttendanceStats(): Promise<AttendanceStats | null> {
  try {
    const res = await apiGet<ApiDataResponse<AttendanceStats>>("/attendance/stats");
    const data = (res as ApiDataResponse<AttendanceStats>).data;
    return data ?? null;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null;
    }
    throw error;
  }
}
