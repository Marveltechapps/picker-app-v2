/**
 * Wallet Service
 *
 * Handles wallet balance, withdrawals, and transaction history.
 * Withdrawals use queue-aware API with idempotencyKey for offline support.
 */

import { apiGet, ApiClientError } from "@/utils/apiClient";
import { fetchWithQueue } from "@/utils/queueAwareApi";
import { withdrawalIdempotencyKey } from "@/utils/idempotency";
import { getUserIdFromToken } from "@/utils/auth";
import { getCached, setCached } from "@/utils/asyncStorageCache";

export interface WalletBalance {
  availableBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  currency: string;
}

export interface WithdrawRequest {
  amount: number;
  bankAccountId: string;
  idempotencyKey?: string; // Prevent duplicate withdrawals
}

export interface WithdrawResponse {
  success: boolean;
  transactionId: string;
  withdrawalRequestId?: string; // When status is pending, use this to poll
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  message?: string;
  error?: string;
  estimatedCompletionTime?: string; // ISO date string
}

export type TransactionType = "credit" | "debit";
export type TransactionStatus = "pending" | "processing" | "completed" | "failed";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  referenceId: string;
  createdAt: string;
  completedAt?: string;
  metadata?: {
    bankAccountId?: string;
    bankName?: string;
    paymentMode?: string;
    failureReason?: string;
  };
}

export interface TransactionHistoryParams {
  page?: number;
  limit?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Backend returns { success: true, data: T } for balance, history, transaction */
interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

/** Current month earnings breakdown from GET /wallet/earnings-breakdown */
export interface EarningsBreakdown {
  basePay: number;
  baseHours: number;
  overtime: number;
  overtimeHours: number;
  performance: number;
  attendance: number;
  accuracy: number;
  referral: number;
  grossPay: number;
  deductions: { tds: number };
  netPayout: number;
  incentives?: { referral: number; bonus: number; total: number };
}

/** Default wallet balance when API returns undefined (TanStack Query disallows undefined) */
const DEFAULT_WALLET_BALANCE: WalletBalance = {
  availableBalance: 0,
  pendingBalance: 0,
  totalEarnings: 0,
  currency: "INR",
};

const WALLET_BALANCE_TTL_MS = 5 * 60 * 1000;

function walletBalanceCacheKey(userId: string): string {
  return `wallet_balance_${userId}`;
}

/**
 * Get wallet balance
 * GET /wallet/balance – returns { success, data: WalletBalance }
 * Cached5 minutes per user; on network error returns stale cache if present.
 */
export async function getWalletBalance(): Promise<WalletBalance> {
  const uid = (await getUserIdFromToken()) ?? "anon";
  const cacheKey = walletBalanceCacheKey(uid);

  try {
    const res = await apiGet<ApiDataResponse<WalletBalance>>("/wallet/balance");
    const data = (res as ApiDataResponse<WalletBalance>)?.data;
    const balance = data ?? DEFAULT_WALLET_BALANCE;
    await setCached(cacheKey, balance);
    return balance;
  } catch (e) {
    const stale = await getCached<WalletBalance>(cacheKey, WALLET_BALANCE_TTL_MS);
    if (stale) return stale;
    if (e instanceof ApiClientError && e.code === "NETWORK_ERROR") {
      return DEFAULT_WALLET_BALANCE;
    }
    throw e;
  }
}

/**
 * Initiate withdrawal
 *
 * Creates a withdrawal request. Uses queue-aware API; on network error adds to offline queue.
 * The backend will: validate balance, create transaction record, process payment.
 */
export async function withdrawAmount(
  request: WithdrawRequest,
  userId?: string
): Promise<WithdrawResponse> {
  const uid = userId ?? (await getUserIdFromToken()) ?? "anon";
  const idempotencyKey = request.idempotencyKey ?? withdrawalIdempotencyKey(uid, request.amount);

  try {
    const response = await fetchWithQueue<WithdrawResponse>(
      "/wallet/withdraw",
      {
        method: "POST",
        body: { ...request, idempotencyKey } as Record<string, unknown>,
      },
      { actionType: "withdrawal", idempotencyKey }
    );
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      const queued =
        error.code === "NETWORK_ERROR" && error.message?.includes("Saved offline");
      if (queued) {
        return {
          success: true,
          transactionId: "queued",
          amount: request.amount,
          status: "pending",
          message: "Saved offline, will sync when connected",
        };
      }
      return {
        success: false,
        transactionId: "",
        amount: request.amount,
        status: "failed",
        error: error.message,
      };
    }
    throw error;
  }
}

/** Build default transaction history (TanStack Query disallows undefined) */
function defaultTransactionHistory(params?: TransactionHistoryParams): TransactionHistoryResponse {
  const limit = params?.limit ?? 50;
  const page = params?.page ?? 1;
  return {
    transactions: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };
}

/**
 * Get transaction history
 * GET /wallet/history – returns { success, data: { transactions, pagination } }
 */
export async function getTransactionHistory(
  params?: TransactionHistoryParams
): Promise<TransactionHistoryResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", params.page.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.type) queryParams.append("type", params.type);
  if (params?.status) queryParams.append("status", params.status);
  if (params?.startDate) queryParams.append("startDate", params.startDate);
  if (params?.endDate) queryParams.append("endDate", params.endDate);
  const queryString = queryParams.toString();
  const endpoint = `/wallet/history${queryString ? `?${queryString}` : ""}`;
  const res = await apiGet<ApiDataResponse<TransactionHistoryResponse>>(endpoint);
  const data = (res as ApiDataResponse<TransactionHistoryResponse>)?.data;
  return data ?? defaultTransactionHistory(params);
}

/**
 * Get transaction by ID
 * GET /wallet/transactions/:transactionId – returns { success, data: Transaction }
 */
export async function getTransaction(transactionId: string): Promise<Transaction> {
  const res = await apiGet<ApiDataResponse<Transaction>>(`/wallet/transactions/${transactionId}`);
  return (res as ApiDataResponse<Transaction>).data;
}

/**
 * Check withdrawal request status (for pending withdrawal requests)
 * GET /wallet/withdrawal-requests/:requestId
 */
export async function checkWithdrawalRequestStatus(
  withdrawalRequestId: string
): Promise<WithdrawResponse> {
  const res = await apiGet<ApiDataResponse<{
    id: string;
    withdrawalRequestId: string;
    status: string;
    amount: number;
    requestedAt: string;
  }>>(`/wallet/withdrawal-requests/${withdrawalRequestId}`);
  const data = (res as ApiDataResponse<{ id: string; withdrawalRequestId: string; status: string; amount: number; requestedAt: string }>).data;
  const status = data?.status || "pending";
  return {
    success: status === "completed",
    transactionId: "",
    withdrawalRequestId: data?.id ?? withdrawalRequestId,
    amount: data?.amount ?? 0,
    status: status as "pending" | "processing" | "completed" | "failed",
    message: status === "completed" ? "Withdrawal completed successfully" : status === "pending" ? "Pending approval" : undefined,
  };
}

/**
 * Check withdrawal status (transaction or withdrawal request)
 */
export async function checkWithdrawalStatus(
  transactionIdOrRequestId: string,
  isRequestId = false
): Promise<WithdrawResponse> {
  if (isRequestId) {
    return checkWithdrawalRequestStatus(transactionIdOrRequestId);
  }
  const transaction = await getTransaction(transactionIdOrRequestId);

  return {
    success: transaction.status === "completed",
    transactionId: transaction.id,
    amount: transaction.amount,
    status: transaction.status as "pending" | "processing" | "completed" | "failed",
    message: transaction.status === "completed" ? "Withdrawal completed successfully" : undefined,
    error: transaction.metadata?.failureReason,
  };
}

/**
 * Get current month earnings breakdown for payouts screen
 * GET /wallet/earnings-breakdown
 */
export async function getEarningsBreakdown(): Promise<EarningsBreakdown | null> {
  try {
    const res = await apiGet<ApiDataResponse<EarningsBreakdown>>("/wallet/earnings-breakdown");
    return (res as ApiDataResponse<EarningsBreakdown>).data ?? null;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null;
    }
    throw error;
  }
}
