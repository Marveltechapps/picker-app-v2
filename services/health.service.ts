/**
 * Health Service
 *
 * API integration for backend health check (GET /health).
 * Use for optional connectivity checks before login or in settings.
 */

import { apiGet } from "@/utils/apiClient";

export interface HealthResponse {
  ok: boolean;
  db?: boolean;
}

/**
 * GET /health – backend connectivity and DB status.
 * No auth required; apiClient only sends Bearer when token exists.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}
