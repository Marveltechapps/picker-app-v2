/**
 * Queue-Aware API Layer
 *
 * Wraps critical write API calls. On network failure (fetch throws or NETWORK_ERROR),
 * adds the request to the offline queue. When network is restored, processQueue()
 * retries each item with the same idempotencyKey.
 *
 * Use: apiPostWithQueue, apiPutWithQueue for write operations that must survive offline.
 */

import { getAuthToken } from "./apiClient";
import { ApiClientError } from "./apiClient";
import { getPickerApiBaseUrl } from "@/utils/backendUrl";
import { useOfflineQueueStore, MAX_RETRIES } from "@/store/offlineQueueStore";

const DEFAULT_BASE_URL = getPickerApiBaseUrl();

export interface QueueAwareOptions {
  actionType: string;
  idempotencyKey: string;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    return error.code === "NETWORK_ERROR" || error.status === 0;
  }
  if (error instanceof TypeError && (error.message === "Network request failed" || error.message?.includes("fetch"))) {
    return true;
  }
  return false;
}

/**
 * Execute a fetch and, on network error, add to offline queue.
 * Returns the response data on success; on network error, adds to queue and throws.
 */
export async function fetchWithQueue<T = unknown>(
  endpoint: string,
  options: { method?: string; headers?: HeadersInit; body?: unknown },
  queueOptions: QueueAwareOptions
): Promise<T> {
  const baseUrl = DEFAULT_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}${endpoint}`;
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Idempotency-Key": queueOptions.idempotencyKey,
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const method = options.method ?? "POST";
  const bodyStr =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: bodyStr,
    });

    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const data = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => "");

    if (!response.ok) {
      const errData = data as { message?: string; error?: string; code?: string };
      throw new ApiClientError(
        errData.message || errData.error || `HTTP ${response.status}`,
        response.status,
        errData.code
      );
    }
    return data as T;
  } catch (error) {
    if (isNetworkError(error)) {
      useOfflineQueueStore.getState().addItem({
        actionType: queueOptions.actionType,
        endpoint,
        method,
        body: options.body ?? {},
        idempotencyKey: queueOptions.idempotencyKey,
      });
      throw new ApiClientError("Saved offline, will sync when connected", 0, "NETWORK_ERROR");
    }
    throw error;
  }
}

/**
 * Process the offline queue when network is restored.
 * Retries each item in order; removes on success; keeps on failure (up to MAX_RETRIES).
 */
export async function processQueue(): Promise<{ processed: number; failed: number }> {
  const { items, setProcessing, removeItem, incrementRetries } = useOfflineQueueStore.getState();
  if (items.length === 0) return { processed: 0, failed: 0 };

  setProcessing(true);
  let processed = 0;
  let failed = 0;

  const baseUrl = DEFAULT_BASE_URL.replace(/\/$/, "");
  const token = await getAuthToken();

  for (const item of [...items]) {
    if (item.retries >= MAX_RETRIES) {
      removeItem(item.id);
      failed++;
      continue;
    }

    try {
      const url = `${baseUrl}${item.endpoint}`;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-Idempotency-Key": item.idempotencyKey,
      };
      if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: item.method,
        headers,
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");
      const data = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => "");

      if (response.ok) {
        removeItem(item.id);
        processed++;
      } else {
        // 409/422 could mean duplicate (idempotent) - treat as success
        if (response.status === 409 || response.status === 422) {
          const err = data as { message?: string; code?: string };
          if (err?.code === "DUPLICATE" || err?.message?.toLowerCase().includes("duplicate")) {
            removeItem(item.id);
            processed++;
          } else {
            incrementRetries(item.id);
            failed++;
          }
        } else {
          incrementRetries(item.id);
          failed++;
        }
      }
    } catch {
      incrementRetries(item.id);
      failed++;
    }
  }

  setProcessing(false);
  return { processed, failed };
}
