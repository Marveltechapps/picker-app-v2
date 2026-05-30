/**
 * Notifications Service
 *
 * Handles notifications list and mark read per backend-workflow.yaml
 * (notifications_list, notifications_mark_read, notifications_mark_all_read).
 */

import { apiGet, apiPut, ApiClientError } from "@/utils/apiClient";

export type NotificationType =
  | "payout"
  | "order"
  | "shift"
  | "training"
  | "milestone"
  | "bonus"
  | "update";

export interface ApiNotification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  timestamp: string;
  isRead: boolean;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/**
 * GET /notifications – returns { success, data: Notification[] }
 */
export async function getNotifications(): Promise<ApiNotification[]> {
  try {
    const res = await apiGet<ApiDataResponse<ApiNotification[]>>("/notifications");
    const list = (res as ApiDataResponse<ApiNotification[]>).data ?? [];
    return list.map((n) => ({
      ...n,
      timestamp:
        typeof n.timestamp === "string"
          ? n.timestamp
          : formatTimestamp(n.timestamp),
    }));
  } catch (error) {
    if (error instanceof ApiClientError) return [];
    throw error;
  }
}

/**
 * PUT /notifications/:id/read – mark one as read
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await apiPut<{ success: boolean }>(`/notifications/${id}/read`, {});
    return true;
  } catch {
    return false;
  }
}

/**
 * PUT /notifications/read-all – mark all as read
 */
export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    await apiPut<{ success: boolean }>("/notifications/read-all", {});
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(ts: unknown): string {
  if (typeof ts === "string") return ts;
  if (typeof ts === "number" || (ts && typeof (ts as Date).getTime === "function")) {
    const d = new Date(ts as number | Date);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return d.toLocaleDateString();
  }
  return "";
}
