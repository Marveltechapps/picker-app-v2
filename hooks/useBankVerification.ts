/**
 * useBankVerification Hook
 * 
 * React Query hook for bank account verification.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  verifyBankAccount,
  saveBankAccount,
  getBankAccounts,
  getDefaultBankAccount,
  updateBankAccount,
  setDefaultBankAccount,
  deleteBankAccount,
  type BankVerificationRequest,
  type BankAccountDetails,
  type SavedBankAccount,
} from "@/services/bank.service";

const QUERY_KEYS = {
  bankAccounts: ["bank", "accounts"] as const,
  defaultBankAccount: ["bank", "default"] as const,
};

/**
 * Verify bank account mutation
 */
export function useVerifyBankAccount() {
  return useMutation({
    mutationFn: (details: BankVerificationRequest) => verifyBankAccount(details),
  });
}

/**
 * Save bank account mutation
 */
export function useSaveBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (details: BankAccountDetails) => saveBankAccount(details),
    onSuccess: () => {
      // Invalidate bank accounts queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bankAccounts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultBankAccount });
    },
  });
}

/**
 * Get all bank accounts
 */
export function useBankAccounts() {
  return useQuery({
    queryKey: QUERY_KEYS.bankAccounts,
    queryFn: getBankAccounts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get default bank account
 */
export function useDefaultBankAccount() {
  return useQuery({
    queryKey: QUERY_KEYS.defaultBankAccount,
    queryFn: getDefaultBankAccount,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Update bank account mutation
 */
export function useUpdateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, details }: { accountId: string; details: Partial<BankAccountDetails> }) =>
      updateBankAccount(accountId, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bankAccounts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultBankAccount });
    },
  });
}

/**
 * Set default bank account mutation
 */
export function useSetDefaultBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => setDefaultBankAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bankAccounts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultBankAccount });
    },
  });
}

/**
 * Delete bank account mutation
 */
export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => deleteBankAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bankAccounts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultBankAccount });
    },
  });
}
