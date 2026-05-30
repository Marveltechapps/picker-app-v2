/**
 * useTransactionHistory Hook
 * 
 * React Query hook for transaction history.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTransactionHistory,
  getTransaction,
  type TransactionHistoryParams,
  type Transaction,
  type TransactionHistoryResponse,
} from "@/services/wallet.service";

const QUERY_KEYS = {
  transactionHistory: (params?: TransactionHistoryParams) =>
    ["wallet", "history", params] as const,
  transaction: (id: string) => ["wallet", "transaction", id] as const,
};

/**
 * Get transaction history
 */
export function useTransactionHistory(params?: TransactionHistoryParams) {
  return useQuery({
    queryKey: QUERY_KEYS.transactionHistory(params),
    queryFn: () => getTransactionHistory(params),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Get single transaction
 */
export function useTransaction(transactionId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.transaction(transactionId || ""),
    queryFn: () => getTransaction(transactionId!),
    enabled: !!transactionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Refresh transaction history
 */
export function useRefreshTransactionHistory() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["wallet", "history"] });
  };
}
