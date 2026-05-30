/**
 * Support Service
 *
 * Handles support tickets per backend-workflow.yaml
 * (support_tickets_list, support_ticket_create).
 */

import { apiGet, apiPost, ApiClientError } from "@/utils/apiClient";

export interface SupportTicket {
  id: string;
  category?: string;
  subject?: string;
  message?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/**
 * GET /support/tickets – list user tickets
 */
export async function getSupportTickets(): Promise<SupportTicket[]> {
  try {
    const res = await apiGet<ApiDataResponse<SupportTicket[]>>("/support/tickets");
    return (res as ApiDataResponse<SupportTicket[]>).data ?? [];
  } catch (error) {
    if (error instanceof ApiClientError) return [];
    throw error;
  }
}

/**
 * POST /support/tickets – create ticket (category, subject, message)
 */
export async function createSupportTicket(body: {
  category: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const res = await apiPost<ApiDataResponse<SupportTicket>>("/support/tickets", body);
    return { success: true, data: (res as ApiDataResponse<SupportTicket>).data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
