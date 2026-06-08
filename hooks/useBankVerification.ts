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

} from "@/services/bank.service";



const QUERY_KEYS = {

  bankAccounts: ["bank", "accounts"] as const,

  defaultBankAccount: ["bank", "default"] as const,

};



function invalidateBankQueries(queryClient: ReturnType<typeof useQueryClient>) {

  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bankAccounts });

  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.defaultBankAccount });

}



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

    onSuccess: () => invalidateBankQueries(queryClient),

  });

}



/**

 * Get all bank accounts

 */

export function useBankAccounts() {

  return useQuery({

    queryKey: QUERY_KEYS.bankAccounts,

    queryFn: getBankAccounts,

    staleTime: 0,

  });

}



/**

 * Get default bank account (used by Payouts screen — not Bank Details)

 */

export function useDefaultBankAccount() {

  return useQuery({

    queryKey: QUERY_KEYS.defaultBankAccount,

    queryFn: getDefaultBankAccount,

    staleTime: 0,

    refetchOnMount: "always",

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

    onSuccess: () => invalidateBankQueries(queryClient),

  });

}



/**

 * Set default bank account mutation

 */

export function useSetDefaultBankAccount() {

  const queryClient = useQueryClient();



  return useMutation({

    mutationFn: (accountId: string) => setDefaultBankAccount(accountId),

    onSuccess: () => invalidateBankQueries(queryClient),

  });

}



/**

 * Delete bank account mutation

 */

export function useDeleteBankAccount() {

  const queryClient = useQueryClient();



  return useMutation({

    mutationFn: (accountId: string) => deleteBankAccount(accountId),

    onSuccess: () => invalidateBankQueries(queryClient),

  });

}


