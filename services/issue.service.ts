/**
 * Picker-reported issues (inventory mismatch, damaged item, etc.) — POST /issues
 */

import { apiPost, ApiClientError } from "@/utils/apiClient";

export type PickerIssueType =
  | "item_damaged"
  | "inventory_mismatch"
  | "shelf_empty"
  | "app_bug"
  | "device_issue";

export interface ReportIssuePayload {
  issueType: PickerIssueType;
  description: string;
  orderId?: string;
  severity?: "low" | "medium" | "high";
}

export interface ReportIssueResult {
  success: boolean;
  data?: { id: string; issueType?: string; status?: string; reportedAt?: string };
  error?: string;
}

export async function reportPickerIssue(payload: ReportIssuePayload): Promise<ReportIssueResult> {
  try {
    const res = await apiPost<{ success: boolean; data?: ReportIssueResult["data"]; error?: string }>(
      "/issues",
      payload
    );
    if (res && typeof res === "object" && "success" in res) {
      return {
        success: !!res.success,
        data: res.data,
        error: !res.success ? res.error || "Request failed" : undefined,
      };
    }
    return { success: true, data: (res as { data?: ReportIssueResult["data"] })?.data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
