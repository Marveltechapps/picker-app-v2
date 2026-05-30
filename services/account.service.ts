import { apiPost } from "@/utils/apiClient";

export interface AccountDeletionResponse {
  success: boolean;
  message: string;
  alreadyPending?: boolean;
}

export async function requestAccountDeletion(reason?: string): Promise<AccountDeletionResponse> {
  return apiPost<AccountDeletionResponse>("/account/delete-request", { reason: reason ?? "" });
}
