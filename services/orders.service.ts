/**
 * Orders Service (Picker app – HHD orders)
 *
 * Handles order status updates and completion for picker/HHD flow.
 * PUT /orders/:orderId/status, POST /orders/:orderId/complete
 * Uses queue-aware API with idempotencyKey for offline support.
 */

import { fetchWithQueue } from "@/utils/queueAwareApi";
import { orderActionIdempotencyKey } from "@/utils/idempotency";
import { getUserIdFromToken } from "@/utils/auth";
import { apiGet, ApiClientError } from "@/utils/apiClient";

/** User identifier for idempotency */
type UserId = string;

interface ApiListResponse<T> {
  success: boolean;
  total?: number;
  count?: number;
  data?: T[];
}

export interface SharedOrdersSummary {
  total: number;
  pending: number;
  picking: number;
  active: number;
}

async function getOrderCount(query = ""): Promise<number | null> {
  try {
    const endpoint = `/orders?limit=1${query ? `&${query}` : ""}`;
    const response = await apiGet<ApiListResponse<Record<string, unknown>>>(endpoint);
    return response.total ?? response.count ?? response.data?.length ?? 0;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null;
    }
    throw error;
  }
}

async function getCompletedOrderCount(): Promise<number | null> {
  try {
    const endpoint = `/orders/completed?limit=1`;
    const response = await apiGet<ApiListResponse<Record<string, unknown>>>(endpoint);
    return response.total ?? response.count ?? response.data?.length ?? 0;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null;
    }
    throw error;
  }
}

export async function getSharedOrdersSummary(): Promise<SharedOrdersSummary | null> {
  const [openTotal, completedTotal, pending, picking] = await Promise.all([
    getOrderCount(),
    getCompletedOrderCount(),
    getOrderCount("status=pending"),
    getOrderCount("status=picking"),
  ]);

  if (openTotal == null || pending == null || picking == null) {
    return null;
  }

  const total = (openTotal ?? 0) + (completedTotal ?? 0);

  return {
    total,
    pending,
    picking,
    active: pending + picking,
  };
}

/**
 * Update order status (e.g. start picking)
 * PUT /orders/:orderId/status
 */
export async function updateOrderStatus(
  orderId: string,
  status: string,
  userId?: UserId
): Promise<{ success: boolean; error?: string; queued?: boolean }> {
  // Derive userId from token when not provided to ensure idempotency keys are user-specific.
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = orderActionIdempotencyKey("update-status", orderId, uid);
  try {
    await fetchWithQueue<{ success: boolean }>(
      `/orders/${orderId}/status`,
      { method: "PUT", body: { status } as Record<string, unknown> },
      { actionType: "order-update-status", idempotencyKey }
    );
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued =
        error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
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
 * Complete order
 * POST /orders/:orderId/complete
 */
export async function completeOrder(
  orderId: string,
  userId?: UserId
): Promise<{ success: boolean; error?: string; queued?: boolean }> {
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = orderActionIdempotencyKey("complete-picking", orderId, uid);
  try {
    await fetchWithQueue<{ success: boolean }>(
      `/orders/${orderId}/complete`,
      { method: "POST", body: {} as Record<string, unknown> },
      { actionType: "order-complete", idempotencyKey }
    );
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued =
        error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
      return {
        success: queued ? true : false,
        error: error.message,
        queued,
      };
    }
    throw error;
  }
}
