/**
 * useWithdraw Hook
 *
 * React Query hook for wallet withdrawals.
 * Uses queue-aware API; withdrawals are queued when offline.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWalletBalance,
  withdrawAmount,
  checkWithdrawalStatus,
  type WithdrawRequest,
  type WithdrawResponse,
} from "@/services/wallet.service";
import { useAuth } from "@/state/authContext";

const QUERY_KEYS = {
  walletBalance: ["wallet", "balance"] as const,
  withdrawalStatus: (transactionId: string) => ["wallet", "withdrawal", transactionId] as const,
};

/**
 * Get wallet balance
 */
export function useWalletBalance() {
  return useQuery({
    queryKey: QUERY_KEYS.walletBalance,
    queryFn: getWalletBalance,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Withdraw amount mutation
 */
export function useWithdraw() {
  const queryClient = useQueryClient();
  const { phoneNumber } = useAuth();

  return useMutation({
    mutationFn: (request: WithdrawRequest) =>
      withdrawAmount(request, phoneNumber ?? undefined),
    onSuccess: (data) => {
      // Invalidate balance and transaction history
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.walletBalance });
      queryClient.invalidateQueries({ queryKey: ["wallet", "history"] });
      
      // If transaction ID is available, set up status polling
      if (data.transactionId) {
        queryClient.setQueryData(QUERY_KEYS.withdrawalStatus(data.transactionId), data);
      }
    },
  });
}

/**
 * Check withdrawal status
 */
export function useWithdrawalStatus(transactionId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.withdrawalStatus(transactionId || ""),
    queryFn: () => checkWithdrawalStatus(transactionId!),
    enabled: !!transactionId,
    refetchInterval: (query) => {
      const data = query.state.data as WithdrawResponse | undefined;
      // Poll if status is pending or processing
      if (data?.status === "pending" || data?.status === "processing") {
        return 5000; // Poll every 5 seconds
      }
      return false; // Stop polling if completed or failed
    },
  });
}
