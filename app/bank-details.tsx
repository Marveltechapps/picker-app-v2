import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import PaymentPayoutCard from "@/components/PaymentPayoutCard";
import {
  getBankAccounts,
  getDefaultBankAccount,
  type SavedBankAccount,
} from "@/services/bank.service";
import { getProfileApi } from "@/services/user.service";
import {
  bankMatchesSaved,
  clearRecentSavedBank,
  clearRecentSavedUpi,
  getRecentSavedBank,
  getRecentSavedUpi,
  PAYMENT_DETAILS_UPDATED_EVENT,
  type PaymentDetailsUpdate,
} from "@/utils/paymentDetailsStore";

export default function BankDetailsScreen() {
  const router = useRouter();
  const fetchGenerationRef = useRef(0);
  const [bankAccount, setBankAccount] = useState<SavedBankAccount | null>(null);
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [upiError, setUpiError] = useState<string | null>(null);

  const applyUpdate = useCallback((update: PaymentDetailsUpdate) => {
    if (update.bank) {
      setBankAccount(update.bank);
      setBankError(null);
    }
    if (update.upi) {
      setUpiId(update.upi.upiId);
      setUpiName(update.upi.upiName);
      setUpiError(null);
    }
    setInitialLoadDone(true);
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      PAYMENT_DETAILS_UPDATED_EVENT,
      (update: PaymentDetailsUpdate) => applyUpdate(update)
    );
    return () => subscription.remove();
  }, [applyUpdate]);

  const loadBankFromServer = useCallback(async (generation: number) => {
    try {
      setBankError(null);
      const recent = getRecentSavedBank();
      let account: SavedBankAccount | null;

      if (recent?.id) {
        const accounts = await getBankAccounts();
        account = accounts.find((row) => row.id === recent.id) ?? null;
      } else {
        account = await getDefaultBankAccount();
      }

      if (generation !== fetchGenerationRef.current) return;

      if (recent) {
        if (account && bankMatchesSaved(account, recent)) {
          clearRecentSavedBank();
          setBankAccount(account);
        } else {
          setBankAccount(recent);
        }
        return;
      }

      setBankAccount(account);
    } catch (error) {
      if (generation !== fetchGenerationRef.current) return;
      const recent = getRecentSavedBank();
      if (recent) {
        setBankAccount(recent);
        return;
      }
      setBankAccount(null);
      setBankError(error instanceof Error ? error.message : "Failed to load bank details");
    }
  }, []);

  const loadUpiFromServer = useCallback(async (generation: number) => {
    try {
      setUpiError(null);
      const profile = await getProfileApi({ bypassCache: true });
      if (generation !== fetchGenerationRef.current) return;

      const recent = getRecentSavedUpi();
      const serverId = profile?.upiId?.trim() ?? "";
      const serverName = profile?.upiName?.trim() ?? "";

      if (recent) {
        if (serverId === recent.upiId && serverName === recent.upiName) {
          clearRecentSavedUpi();
          setUpiId(serverId);
          setUpiName(serverName);
        } else {
          setUpiId(recent.upiId);
          setUpiName(recent.upiName);
        }
      } else {
        setUpiId(serverId);
        setUpiName(serverName);
      }
      setProfileUpdatedAt(profile?.createdAt ?? null);
    } catch (error) {
      if (generation !== fetchGenerationRef.current) return;
      const recent = getRecentSavedUpi();
      if (recent) {
        setUpiId(recent.upiId);
        setUpiName(recent.upiName);
        return;
      }
      setUpiId("");
      setUpiName("");
      setUpiError(error instanceof Error ? error.message : "Failed to load UPI details");
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const generation = ++fetchGenerationRef.current;

    const recentBank = getRecentSavedBank();
    const recentUpi = getRecentSavedUpi();
    if (recentBank) setBankAccount(recentBank);
    if (recentUpi) {
      setUpiId(recentUpi.upiId);
      setUpiName(recentUpi.upiName);
    }

    await Promise.all([loadBankFromServer(generation), loadUpiFromServer(generation)]);
    if (generation === fetchGenerationRef.current) {
      setInitialLoadDone(true);
    }
  }, [loadBankFromServer, loadUpiFromServer]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll])
  );

  const hasBank = bankAccount != null;
  const hasUpi = !!(upiId || upiName);
  const hasConfigured = hasBank || hasUpi;
  const isLoading = !initialLoadDone;

  const lastUpdatedLabel =
    bankAccount?.updatedAt || profileUpdatedAt
      ? new Date(bankAccount?.updatedAt ?? profileUpdatedAt!).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  const bankCardKey = bankAccount
    ? `${bankAccount.id}-${bankAccount.updatedAt}-${bankAccount.accountHolder}-${bankAccount.bankName}-${bankAccount.ifscCode}`
    : "no-bank";
  const upiCardKey = `${upiId}-${upiName}`;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Bank Details" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        {...scrollViewTouchProps}
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#155DFC" />
            <Text style={styles.loadingText}>Loading payment details…</Text>
          </View>
        ) : bankError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Unable to load bank details</Text>
            <Text style={styles.errorBody}>Please try again.</Text>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => refreshAll()}>
              <Text style={styles.secondaryActionButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : upiError && !hasBank ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Unable to load payment details</Text>
            <Text style={styles.errorBody}>{upiError}</Text>
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => loadUpiFromServer(++fetchGenerationRef.current)}
            >
              <Text style={styles.secondaryActionButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {!hasConfigured ? (
              <View style={[styles.primaryMethodCard, styles.primaryMethodCardEmpty]}>
                <View style={styles.emptyCardContent}>
                  <Text style={styles.emptyCardTitle}>No payment method yet</Text>
                  <Text style={styles.emptyCardBody}>
                    Add your bank account or UPI ID to receive payouts. Only you can view and update
                    your payment details.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.cardsStack}>
                {hasBank ? (
                  <PaymentPayoutCard
                    key={bankCardKey}
                    variant="bank"
                    details={{
                      accountHolder: bankAccount!.accountHolder,
                      accountNumber: bankAccount!.accountNumber,
                      bankName: bankAccount!.bankName,
                      ifscCode: bankAccount!.ifscCode,
                    }}
                  />
                ) : null}
                {hasUpi ? (
                  <PaymentPayoutCard
                    key={upiCardKey}
                    variant="upi"
                    details={{
                      accountHolder: upiName || "—",
                      upiId: upiId || "—",
                    }}
                  />
                ) : null}
                {lastUpdatedLabel ? (
                  <Text style={styles.pageMetaText}>Last updated: {lastUpdatedLabel}</Text>
                ) : null}
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => router.push("/update-bank-details")}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionButtonText}>
                  {hasBank ? "Edit bank" : "Bank account"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => router.push("/update-upi-details")}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionButtonText}>
                  {hasUpi ? "Edit UPI" : "UPI account"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 21,
    paddingTop: 21,
    paddingBottom: 40,
    gap: 20,
    alignItems: "stretch",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  errorWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  errorBody: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  cardsStack: {
    gap: 16,
    alignSelf: "stretch",
  },
  pageMetaText: {
    color: "#6A7282",
    textAlign: "center",
    marginTop: 4,
    fontSize: 12,
  },
  primaryMethodCard: {
    backgroundColor: "#155DFC",
    borderRadius: 14,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  primaryMethodCardEmpty: {
    backgroundColor: "#4B5563",
    paddingVertical: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyCardContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyCardTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyCardBody: {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: 14,
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    alignSelf: "stretch",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  secondaryActionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    color: "#364153",
    textAlign: "center",
  },
});
