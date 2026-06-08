import { DeviceEventEmitter } from "react-native";
import type { SavedBankAccount } from "@/services/bank.service";

export const PAYMENT_DETAILS_UPDATED_EVENT = "payment-details-updated";

export type PaymentDetailsUpdate = {
  bank?: SavedBankAccount;
  upi?: { upiId: string; upiName: string };
};

const SAVE_GRACE_MS = 60_000;

let recentSavedBank: SavedBankAccount | null = null;
let recentSavedUpi: { upiId: string; upiName: string } | null = null;
let recentBankSavedAt = 0;
let recentUpiSavedAt = 0;

export function publishPaymentDetailsUpdate(update: PaymentDetailsUpdate): void {
  const now = Date.now();
  if (update.bank) {
    recentSavedBank = update.bank;
    recentBankSavedAt = now;
  }
  if (update.upi) {
    recentSavedUpi = update.upi;
    recentUpiSavedAt = now;
  }
  DeviceEventEmitter.emit(PAYMENT_DETAILS_UPDATED_EVENT, update);
}

export function getRecentSavedBank(): SavedBankAccount | null {
  if (!recentSavedBank || Date.now() - recentBankSavedAt > SAVE_GRACE_MS) return null;
  return recentSavedBank;
}

export function getRecentSavedUpi(): { upiId: string; upiName: string } | null {
  if (!recentSavedUpi || Date.now() - recentUpiSavedAt > SAVE_GRACE_MS) return null;
  return recentSavedUpi;
}

export function clearRecentSavedBank(): void {
  recentSavedBank = null;
  recentBankSavedAt = 0;
}

export function clearRecentSavedUpi(): void {
  recentSavedUpi = null;
  recentUpiSavedAt = 0;
}

export function bankMatchesSaved(
  fromServer: SavedBankAccount,
  expected: SavedBankAccount
): boolean {
  return (
    fromServer.accountHolder.trim() === expected.accountHolder.trim() &&
    fromServer.ifscCode.trim().toUpperCase() === expected.ifscCode.trim().toUpperCase() &&
    (fromServer.bankName?.trim() ?? "") === (expected.bankName?.trim() ?? "")
  );
}
