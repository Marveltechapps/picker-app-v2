/**
 * Bank Service
 * 
 * Handles bank account verification and management.
 * Integrates with payment gateway APIs (Razorpay/Cashfree/Stripe Treasury).
 */

import { apiPost, apiGet, apiPut, ApiClientError } from "@/utils/apiClient";

export interface BankAccountDetails {
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
  branch?: string;
}

export interface BankVerificationRequest {
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
  branch?: string;
}

export interface BankVerificationResponse {
  success: boolean;
  verified: boolean;
  bankAccountId?: string;
  bankName?: string;
  branch?: string;
  message?: string;
  error?: string;
  /** Server uses demo verification (no live penny-drop). */
  isDemoMode?: boolean;
}

export interface SavedBankAccount {
  id: string;
  accountHolder: string;
  accountNumber: string; // Masked (last 4 digits)
  ifscCode: string;
  bankName: string;
  branch?: string;
  isVerified: boolean;
  /** Finance / ops payout approval for withdrawals display */
  payoutVerificationStatus?: "pending" | "verified" | "rejected";
  payoutRejectionReason?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Verify bank account details
 * 
 * This calls the backend API which:
 * 1. Validates format (client-side validation should be done first)
 * 2. Calls payment gateway API (Razorpay/Cashfree) for real account verification
 * 3. Returns verification status
 */
export async function verifyBankAccount(
  details: BankVerificationRequest
): Promise<BankVerificationResponse> {
  try {
    const response = await apiPost<BankVerificationResponse>("/bank/verify", details);
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        success: false,
        verified: false,
        error: error.message,
      };
    }
    throw error;
  }
}

/** Backend returns { success: true, data: T } for list/create/update/set-default */
interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

function normalizeSavedBankAccount(raw: Record<string, unknown>): SavedBankAccount {
  const id = String(raw.id ?? raw._id ?? "");
  if (!id) {
    throw new ApiClientError("Bank account response is missing id");
  }
  return {
    id,
    accountHolder: String(raw.accountHolder ?? ""),
    accountNumber: String(raw.accountNumber ?? ""),
    ifscCode: String(raw.ifscCode ?? ""),
    bankName: String(raw.bankName ?? ""),
    branch: raw.branch != null ? String(raw.branch) : undefined,
    isVerified: Boolean(raw.isVerified),
    payoutVerificationStatus: raw.payoutVerificationStatus as SavedBankAccount["payoutVerificationStatus"],
    payoutRejectionReason: raw.payoutRejectionReason != null ? String(raw.payoutRejectionReason) : undefined,
    isDefault: Boolean(raw.isDefault),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

function unwrapBankAccountResponse(res: unknown): SavedBankAccount {
  const payload = res as ApiDataResponse<Record<string, unknown>>;
  if (!payload?.data || typeof payload.data !== "object") {
    throw new ApiClientError("Bank account API response missing data");
  }
  return normalizeSavedBankAccount(payload.data);
}

/**
 * Save verified bank account
 * POST /bank/accounts – returns { success, data: SavedBankAccount }
 */
export async function saveBankAccount(
  details: BankAccountDetails
): Promise<SavedBankAccount> {
  const res = await apiPost<ApiDataResponse<Record<string, unknown>>>("/bank/accounts", details);
  return unwrapBankAccountResponse(res);
}

/**
 * Get saved bank accounts
 * GET /bank/accounts – returns { success, data: SavedBankAccount[] }
 */
export async function getBankAccounts(): Promise<SavedBankAccount[]> {
  const res = await apiGet<ApiDataResponse<Record<string, unknown>[]>>("/bank/accounts");
  const rows = (res as ApiDataResponse<Record<string, unknown>[]>).data ?? [];
  return rows.map((row) => normalizeSavedBankAccount(row));
}

/**
 * Get default bank account
 */
export async function getDefaultBankAccount(): Promise<SavedBankAccount | null> {
  const accounts = await getBankAccounts();
  return accounts.find((acc) => acc.isDefault) || accounts[0] || null;
}

/**
 * Update bank account
 * PUT /bank/accounts/:accountId – returns { success, data: SavedBankAccount }
 */
export async function updateBankAccount(
  accountId: string,
  details: Partial<BankAccountDetails>
): Promise<SavedBankAccount> {
  const res = await apiPut<ApiDataResponse<Record<string, unknown>>>(
    `/bank/accounts/${accountId}`,
    details
  );
  return unwrapBankAccountResponse(res);
}

/**
 * Set default bank account
 * PUT /bank/accounts/:accountId/set-default – returns { success, data: SavedBankAccount }
 */
export async function setDefaultBankAccount(accountId: string): Promise<SavedBankAccount> {
  const res = await apiPut<ApiDataResponse<Record<string, unknown>>>(
    `/bank/accounts/${accountId}/set-default`,
    {}
  );
  return unwrapBankAccountResponse(res);
}

/**
 * Delete bank account
 */
export async function deleteBankAccount(accountId: string): Promise<void> {
  return apiPost<void>(`/bank/accounts/${accountId}/delete`, {});
}

/**
 * Client-side IFSC format check (11 chars: 4 letters + 0 + 6 alphanumeric).
 */
export function isValidIFSCFormat(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

export function validateAccountNumber(accountNumber: string): boolean {
  return /^\d{9,18}$/.test(accountNumber);
}

export function validateAccountHolder(holderName: string): boolean {
  return /^[a-zA-Z\s]{2,100}$/.test(holderName.trim());
}

/** Result of lightweight bank form validation */
export interface BankFormValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Lightweight bank validation – single sync pass, mandatory fields only.
 * Runs instantly on button click; no API, no heavy logic.
 * Order: holder → account number → IFSC (fail fast, one message).
 */
export function validateBankForm(
  holderName: string,
  accountNumber: string,
  ifscCode: string
): BankFormValidationResult {
  const holder = holderName.trim();
  const acc = accountNumber.trim();
  const ifsc = ifscCode.trim().toUpperCase();

  if (!holder) return { valid: false, error: "Account holder name is required." };
  if (!validateAccountHolder(holder)) return { valid: false, error: "Account holder: 2–100 characters, letters and spaces only." };
  if (!acc) return { valid: false, error: "Account number is required." };
  if (!validateAccountNumber(acc)) return { valid: false, error: "Account number: 9–18 digits only." };
  if (!ifsc) return { valid: false, error: "IFSC code is required." };
  if (!isValidIFSCFormat(ifsc)) return { valid: false, error: "IFSC: 11 characters (e.g. HDFC0001234)." };

  return { valid: true };
}

/** Dummy values for demo/dev – pass validation without calling real API */
const DUMMY_BANK = {
  accountNumber: "1234567890123456",
  ifsc: "HDFC0001234",
  holderNames: ["test user", "demo user", "demo account"],
};

/**
 * Returns true if the given details match dummy demo values (for dev/demo mode).
 * Use to skip real verify/save API and set local bank details.
 */
export function isDummyBankDetails(
  holderName: string,
  accountNumber: string,
  ifscCode: string
): boolean {
  const holder = holderName.trim().toLowerCase();
  const account = accountNumber.trim();
  const ifsc = ifscCode.trim().toUpperCase();
  const holderMatch = DUMMY_BANK.holderNames.some((h) => holder.includes(h) || h.includes(holder));
  return (
    holderMatch &&
    account === DUMMY_BANK.accountNumber &&
    ifsc === DUMMY_BANK.ifsc
  );
}

/**
 * Returns a verification response for dummy bank details (no API call).
 */
export function getDummyVerificationResponse(): BankVerificationResponse {
  return {
    success: true,
    verified: true,
    isDemoMode: true,
    bankName: "HDFC Bank",
    branch: "Demo Branch",
  };
}

/**
 * Razorpay public IFSC API — returns branch payload or null.
 * @see https://ifsc.razorpay.com/{IFSC}
 */
export async function validateIFSC(ifsc: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc.trim().toUpperCase()}`, {
      method: "GET",
    });
    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Razorpay IFSC API — public, no auth. */
export interface IfscLookupResult {
  valid: boolean;
  bank?: string;
  branch?: string;
  city?: string;
  state?: string;
  error?: string;
}

export async function lookupIfsc(ifscCode: string): Promise<IfscLookupResult> {
  const ifsc = ifscCode.trim().toUpperCase();
  if (!isValidIFSCFormat(ifsc)) {
    return { valid: false, error: "Invalid IFSC format" };
  }
  const j = await validateIFSC(ifsc);
  if (!j) {
    return { valid: false, error: "Could not verify IFSC" };
  }
  if (j && (j.BANK || j.BANKCODE)) {
    return {
      valid: true,
      bank: typeof j.BANK === "string" ? j.BANK : undefined,
      branch: typeof j.BRANCH === "string" ? j.BRANCH : undefined,
      city: typeof j.CITY === "string" ? j.CITY : undefined,
      state: typeof j.STATE === "string" ? j.STATE : undefined,
    };
  }
  return { valid: false, error: "IFSC not found" };
}

/**
 * Masks account number for display (last 4 visible).
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return "****";
  return `****${accountNumber.slice(-4)}`;
}
