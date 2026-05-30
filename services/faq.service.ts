/**
 * FAQ Service
 *
 * Handles FAQs per backend-workflow.yaml (faqs_list).
 */

import { apiGet, ApiClientError } from "@/utils/apiClient";

export interface FaqItem {
  id: string;
  category?: string;
  question: string;
  answer: string;
  order?: number;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/**
 * GET /faqs – return FAQ list (backend returns { success, data: FAQ[] })
 */
export async function getFaqs(): Promise<FaqItem[]> {
  try {
    const res = await apiGet<ApiDataResponse<FaqItem[]>>("/faqs");
    return (res as ApiDataResponse<FaqItem[]>).data ?? [];
  } catch (error) {
    if (error instanceof ApiClientError) return [];
    throw error;
  }
}
