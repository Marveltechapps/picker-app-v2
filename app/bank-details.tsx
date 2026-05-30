import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { User, Hash, Building2, CreditCard, MapPin, CreditCard as UpiIcon } from "lucide-react-native";
import Header from "@/components/Header";
import { useDefaultBankAccount } from "@/hooks/useBankVerification";
import { getProfileApi } from "@/services/user.service";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type TabType = "bank" | "upi";

interface BankDetails {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branch: string;
}

interface UpiDetails {
  upiId: string;
  upiName: string;
}

const emptyUpi: UpiDetails = { upiId: "", upiName: "" };

export default function BankDetailsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("bank");
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [upiDetails, setUpiDetails] = useState<UpiDetails>(emptyUpi);
  const [upiLoaded, setUpiLoaded] = useState(false);
  const [upiError, setUpiError] = useState<string | null>(null);

  const {
    data: defaultBankAccount,
    isLoading: bankLoading,
    error: bankError,
    refetch: refetchBank,
  } = useDefaultBankAccount();

  useEffect(() => {
    if (defaultBankAccount) {
      setBankDetails({
        accountHolder: defaultBankAccount.accountHolder,
        accountNumber: defaultBankAccount.accountNumber,
        bankName: defaultBankAccount.bankName ?? "",
        ifscCode: defaultBankAccount.ifscCode,
        branch: defaultBankAccount.branch ?? "",
      });
    } else {
      setBankDetails(null);
    }
  }, [defaultBankAccount]);

  const loadUpi = useCallback(async () => {
    try {
      setUpiError(null);
      const profile = await getProfileApi();
      setUpiDetails({
        upiId: profile?.upiId ?? "",
        upiName: profile?.upiName ?? "",
      });
    } catch (error) {
      setUpiDetails(emptyUpi);
      setUpiError(error instanceof Error ? error.message : "Failed to load UPI details");
    } finally {
      setUpiLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "upi") loadUpi();
    }, [activeTab, loadUpi])
  );

  useEffect(() => {
    loadUpi();
  }, [loadUpi]);

  const hasBank = bankDetails != null;
  const hasUpi = !!(upiDetails.upiId?.trim() || upiDetails.upiName?.trim());

  const bankInfoCards = hasBank
    ? [
        { icon: User, label: "Account Holder", value: bankDetails!.accountHolder, bgColor: "#EEF2FF", iconColor: "#8B5CF6" },
        { icon: Hash, label: "Account Number", value: bankDetails!.accountNumber, bgColor: "#DCFCE7", iconColor: "#10B981" },
        { icon: Building2, label: "Bank Name", value: bankDetails!.bankName || "—", bgColor: "#FEF3C7", iconColor: "#F59E0B" },
        { icon: CreditCard, label: "IFSC Code", value: bankDetails!.ifscCode, bgColor: "#FFEDD5", iconColor: "#F97316" },
        { icon: MapPin, label: "Branch", value: bankDetails!.branch || "—", bgColor: "#FEE2E2", iconColor: "#EF4444" },
      ]
    : [];

  const upiInfoCards = [
    { icon: UpiIcon, label: "UPI ID", value: upiDetails.upiId?.trim() || "—", bgColor: "#EEF2FF", iconColor: "#8B5CF6" },
    { icon: User, label: "UPI Name", value: upiDetails.upiName?.trim() || "—", bgColor: "#DCFCE7", iconColor: "#10B981" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Bank Account" subtitle="Payout account details" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "bank" && styles.activeTab]}
            onPress={() => setActiveTab("bank")}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === "bank" && styles.activeTabText]}>
              Bank Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "upi" && styles.activeTab]}
            onPress={() => setActiveTab("upi")}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === "upi" && styles.activeTabText]}>
              UPI ID
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "bank" ? (
          <>
            {bankLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateSubtext}>Loading bank details...</Text>
              </View>
            ) : bankError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>Unable to load bank details</Text>
                <Text style={styles.emptyStateSubtext}>Please try again.</Text>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() => refetchBank()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : !hasBank ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No bank account added</Text>
                <Text style={styles.emptyStateSubtext}>Add a bank account to receive payouts</Text>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() => router.push("/update-bank-details")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateButtonText}>Add Bank Account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {bankInfoCards.map((card, index) => (
                  <View key={index} style={styles.infoCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: card.bgColor }]}>
                      <card.icon color={card.iconColor} size={24} strokeWidth={2} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>{card.label}</Text>
                      <Text style={styles.infoValue}>{card.value}</Text>
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() => router.push("/update-bank-details")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateButtonText}>Update Bank Details</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <>
            {!upiLoaded ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateSubtext}>Loading…</Text>
              </View>
            ) : upiError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>Unable to load UPI details</Text>
                <Text style={styles.emptyStateSubtext}>{upiError}</Text>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={loadUpi}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : !hasUpi ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No UPI added</Text>
                <Text style={styles.emptyStateSubtext}>Add UPI ID for quick payouts</Text>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() => router.push("/update-upi-details")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateButtonText}>Add UPI</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {upiInfoCards.map((card, index) => (
                  <View key={index} style={styles.infoCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: card.bgColor }]}>
                      <card.icon color={card.iconColor} size={24} strokeWidth={2} />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>{card.label}</Text>
                      <Text style={styles.infoValue}>{card.value}</Text>
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={() => router.push("/update-upi-details")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateButtonText}>Update UPI Details</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 24,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#F3F4F6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  activeTabText: {
    color: "#5B4EFF",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  updateButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  updateButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  emptyState: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.tertiary,
    marginBottom: Spacing.lg,
  },
  bottomSpacer: {
    height: 20,
  },
});
