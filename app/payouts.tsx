import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import ModalGestureRoot from "@/components/ModalGestureRoot";
import Header from "@/components/Header";
import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, Text, View, Modal, ActivityIndicator, Platform, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Download,
  FileText,
  CheckCircle,
  ArrowLeft,
} from "lucide-react-native";
import { useWalletBalance } from "@/hooks/useWithdraw";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { useDefaultBankAccount } from "@/hooks/useBankVerification";
import { type SavedBankAccount } from "@/services/bank.service";
import { getProfileApi } from "@/services/user.service";
import { usePullToRefresh } from "@/utils/pullToRefresh";

interface HistoryItem {
  id: string;
  month: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "processing";
  transactionId: string;
  paymentMode: string;
  paymentDate: string;
}

interface BankDetails {
  accountNumber: string;
  ifsc: string;
  holderName: string;
  bankName: string;
}

type PayoutProfileSlice = {
  upiId?: string;
  upiPayoutVerificationStatus?: string;
  upiPayoutRejectionReason?: string;
} | null;

type PayoutBadgeInfo = { label: string; tone: "gray" | "yellow" | "green" | "red"; reason?: string };

function payoutBankBadge(account: SavedBankAccount | null | undefined): PayoutBadgeInfo {
  if (!account) return { label: "Not Added", tone: "gray" };
  if (account.payoutVerificationStatus === "rejected") {
    return {
      label: "Rejected",
      tone: "red",
      reason: account.payoutRejectionReason,
    };
  }
  if (account.payoutVerificationStatus === "pending") {
    return { label: "Under Review", tone: "yellow" };
  }
  if (account.payoutVerificationStatus === "verified" || account.isVerified) {
    return { label: "Verified", tone: "green" };
  }
  return { label: "Under Review", tone: "yellow" };
}

function payoutUpiBadge(profile: PayoutProfileSlice): PayoutBadgeInfo {
  if (!profile?.upiId?.trim()) return { label: "Not Added", tone: "gray" };
  const s = profile.upiPayoutVerificationStatus;
  if (s === "rejected") {
    return { label: "Rejected", tone: "red", reason: profile.upiPayoutRejectionReason };
  }
  if (s === "verified") return { label: "Verified", tone: "green" };
  return { label: "Under Review", tone: "yellow" };
}

export default function PayoutsScreen() {
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfileSlice>(null);

  const { data: walletBalance, refetch: refetchWalletBalance } = useWalletBalance();
  const { data: transactionHistory, isLoading: isLoadingHistory, refetch: refetchTransactionHistory } =
    useTransactionHistory({ limit: 50 });
  const { data: defaultBankAccount, refetch: refetchDefaultBankAccount } = useDefaultBankAccount();

  // Load default bank account from API.
  useEffect(() => {
    if (defaultBankAccount) {
      setBankDetails({
        accountNumber: defaultBankAccount.accountNumber,
        ifsc: defaultBankAccount.ifscCode,
        holderName: defaultBankAccount.accountHolder,
        bankName: defaultBankAccount.bankName,
      });
    }
  }, [defaultBankAccount]);

  const refreshPayoutData = useCallback(async () => {
    const [, , , profile] = await Promise.all([
      refetchWalletBalance(),
      refetchTransactionHistory(),
      refetchDefaultBankAccount(),
      getProfileApi({ bypassCache: true }),
    ]);
    if (profile) {
      setPayoutProfile({
        upiId: profile.upiId,
        upiPayoutVerificationStatus: profile.upiPayoutVerificationStatus,
        upiPayoutRejectionReason: profile.upiPayoutRejectionReason,
      });
    }
  }, [refetchWalletBalance, refetchTransactionHistory, refetchDefaultBankAccount]);

  const { refreshControl } = usePullToRefresh(() => refreshPayoutData());

  useEffect(() => {
    void refreshPayoutData();
  }, [refreshPayoutData]);

  useFocusEffect(
    useCallback(() => {
      void refreshPayoutData();
    }, [refreshPayoutData])
  );

  // Calculate current month and year dynamically
  const now = new Date();
  const currentMonth = now.toLocaleString("en-US", { month: "long" });
  const currentYear = now.getFullYear();
  const currentMonthYear = `${currentMonth} ${currentYear}`;

  // Calculate pay date (typically 5th of next month)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const payDate = nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const rawNet = walletBalance?.availableBalance ?? 0;
  const netPayout = Number.isFinite(rawNet) && rawNet >= 0 ? rawNet : 0;
  const displayPayDate = payDate || nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const payoutData = {
    currentMonth: currentMonthYear,
    netPayout,
    payDate: displayPayDate,
  };

  // Convert transactions to history items
  const historyData: HistoryItem[] = React.useMemo(() => {
    if (!transactionHistory?.transactions) return [];

    return transactionHistory.transactions
      .filter((tx) => tx.type === "debit") // Only withdrawals
      .map((tx) => {
        const date = new Date(tx.createdAt);
        const month = date.toLocaleString("en-US", { month: "short", year: "numeric" });
        const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        return {
          id: tx.id,
          month,
          date: formattedDate,
          amount: tx.amount,
          status: tx.status === "completed" ? "paid" : tx.status === "failed" ? "pending" : "processing",
          transactionId: tx.referenceId,
          paymentMode: tx.metadata?.paymentMode || "Bank Transfer",
          paymentDate: tx.completedAt ? new Date(tx.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : formattedDate,
        };
      });
  }, [transactionHistory]);

  const handleDownloadPayoutSlip = async () => {
    if (!selectedHistory || isDownloading) return;

    setIsDownloading(true);

    try {
      // Simulate download process (replace with actual download logic)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // In a real app, you would:
      // 1. Generate/download the PDF
      // 2. Save to device storage
      // 3. Show success message
      
      setIsDownloading(false);
      // Optionally show success toast/alert here
    } catch (error) {
      console.error("Download error:", error);
      setIsDownloading(false);
      // Optionally show error toast/alert here
    }
  };

  const renderHistoryTab = () => (
    <ScrollView
      style={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      {...scrollViewTouchProps}
    >
      {isLoadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#121358" />
          <Text style={styles.loadingText}>Loading transaction history...</Text>
        </View>
      ) : historyData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No transaction history yet</Text>
        </View>
      ) : (
        historyData.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.historyCard}
          onPress={() => setSelectedHistory(item)}
        >
          <View style={styles.historyLeft}>
            <Text style={styles.historyMonth}>{item.month}</Text>
            <Text style={styles.historyDate}>{item.date}</Text>
          </View>
          <View style={styles.historyRight}>
            <Text style={styles.historyAmount}>₹{item.amount.toLocaleString()}</Text>
            <View style={[styles.historyStatus, historyStatusPillStyle(item.status)]}>
              <Text style={[styles.historyStatusText, historyStatusLabelStyle(item.status)]}>
                {item.status === "paid" ? "Paid" : item.status === "pending" ? "Pending" : "Processing"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Payouts" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        {...scrollViewTouchProps}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Month</Text>
          <Text style={styles.balanceMonth}>{payoutData.currentMonth}</Text>
          <Text style={styles.balanceAmountLabel}>Net Payout</Text>
          <Text style={styles.balanceAmount}>₹{payoutData.netPayout.toLocaleString()}</Text>
          <Text style={styles.balancePayDate}>Pay date: {payoutData.payDate}</Text>
        </View>

        <View style={styles.payoutMethodsCard}>
          <Text style={styles.payoutMethodsTitle}>Bank & UPI verification</Text>
          {(() => {
            const bank = payoutBankBadge(defaultBankAccount);
            const upi = payoutUpiBadge(payoutProfile);
            const badgeBg = (tone: PayoutBadgeInfo["tone"]) =>
              tone === "green"
                ? styles.payoutBadgeGreen
                : tone === "yellow"
                  ? styles.payoutBadgeYellow
                  : tone === "red"
                    ? styles.payoutBadgeRed
                    : styles.payoutBadgeGray;
            const badgeFg = (tone: PayoutBadgeInfo["tone"]) =>
              tone === "green"
                ? styles.payoutBadgeFgLight
                : tone === "red"
                  ? styles.payoutBadgeFgRed
                  : tone === "gray"
                    ? styles.payoutBadgeFgGray
                    : styles.payoutBadgeFgDark;
            return (
              <>
                <View style={styles.payoutMethodRow}>
                  <Text style={styles.payoutMethodLabel}>Bank account</Text>
                  <View style={[styles.payoutBadge, badgeBg(bank.tone)]}>
                    <Text style={[styles.payoutBadgeText, badgeFg(bank.tone)]}>{bank.label}</Text>
                  </View>
                </View>
                {bank.reason ? <Text style={styles.payoutRejectReason}>{bank.reason}</Text> : null}
                <View style={[styles.payoutMethodRow, styles.payoutMethodRowSecond]}>
                  <Text style={styles.payoutMethodLabel}>UPI</Text>
                  <View style={[styles.payoutBadge, badgeBg(upi.tone)]}>
                    <Text style={[styles.payoutBadgeText, badgeFg(upi.tone)]}>{upi.label}</Text>
                  </View>
                </View>
                {upi.reason ? <Text style={styles.payoutRejectReason}>{upi.reason}</Text> : null}
              </>
            );
          })()}
        </View>

        <Text style={styles.historySectionTitle}>History</Text>
        {renderHistoryTab()}
      </ScrollView>

      <Modal
        visible={!!selectedHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedHistory(null)}
      >
        <ModalGestureRoot>
          <View style={styles.modalOverlay}>
          <View style={styles.historyDetailModal}>
            <View style={styles.historyDetailHeader}>
              <TouchableOpacity onPress={() => setSelectedHistory(null)}>
                <ArrowLeft size={24} color="#121358" />
              </TouchableOpacity>
              <Text style={styles.historyDetailTitle}>Back to History</Text>
            </View>

            {selectedHistory && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.historyDetailCard}>
                  <View style={styles.historyDetailIconRow}>
                    <View style={styles.historyDetailIcon}>
                      <CheckCircle size={32} color="#10B981" />
                    </View>
                    <View style={[styles.historyStatus, historyStatusPillStyle(selectedHistory.status)]}>
                      <Text style={[styles.historyStatusText, historyStatusLabelStyle(selectedHistory.status)]}>
                        {selectedHistory.status === "paid" ? "Paid" : "Pending"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyDetailMonth}>{selectedHistory.month}</Text>
                  <Text style={styles.historyDetailDate}>{selectedHistory.date}</Text>
                  <View style={styles.historyDetailAmountBox}>
                    <Text style={styles.historyDetailAmountLabel}>Net Payout</Text>
                    <Text style={styles.historyDetailAmountValue}>₹{selectedHistory.amount.toLocaleString()}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                    onPress={handleDownloadPayoutSlip}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.downloadButtonText}>Downloading...</Text>
                      </>
                    ) : (
                      <>
                        <Download size={20} color="#FFFFFF" />
                        <Text style={styles.downloadButtonText}>Download</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.transactionDetailsCard}>
                  <View style={styles.transactionDetailsHeader}>
                    <FileText size={20} color="#121358" />
                    <Text style={styles.transactionDetailsTitle}>Transaction Details</Text>
                  </View>
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Transaction ID</Text>
                    <Text style={styles.transactionDetailValue}>{selectedHistory.transactionId}</Text>
                  </View>
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Payment Mode</Text>
                    <Text style={styles.transactionDetailValue}>{selectedHistory.paymentMode}</Text>
                  </View>
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Payment Date</Text>
                    <Text style={styles.transactionDetailValue}>{selectedHistory.paymentDate}</Text>
                  </View>
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Status</Text>
                    <Text style={[styles.transactionDetailValue, styles.transactionDetailValuePaid]}>Paid</Text>
                  </View>
                </View>

                {bankDetails && (
                  <View style={styles.bankAccountCard}>
                    <View style={styles.bankAccountHeader}>
                      <View style={styles.bankAccountIcon}>
                        <Text style={styles.bankAccountIconText}>🏦</Text>
                      </View>
                      <Text style={styles.bankAccountTitle}>Bank Account Details</Text>
                    </View>
                    <View style={styles.bankAccountDetail}>
                      <Text style={styles.bankAccountLabel}>Account Holder</Text>
                      <Text style={styles.bankAccountValue}>{bankDetails.holderName}</Text>
                    </View>
                    <View style={styles.bankAccountDetail}>
                      <Text style={styles.bankAccountLabel}>Bank Name</Text>
                      <Text style={styles.bankAccountValue}>{bankDetails.bankName}</Text>
                    </View>
                    <View style={styles.bankAccountDetail}>
                      <Text style={styles.bankAccountLabel}>Account Number</Text>
                      <Text style={styles.bankAccountValue}>{bankDetails.accountNumber}</Text>
                    </View>
                    <View style={styles.bankAccountDetail}>
                      <Text style={styles.bankAccountLabel}>IFSC Code</Text>
                      <Text style={styles.bankAccountValue}>{bankDetails.ifsc}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.paymentInfoCard}>
                  <View style={styles.paymentInfoHeader}>
                    <Text style={styles.paymentInfoIcon}>⚡</Text>
                    <Text style={styles.paymentInfoTitle}>Payment Information</Text>
                  </View>
                  <Text style={styles.paymentInfoText}>
                    This payout includes your base salary, overtime pay, performance bonuses, and incentives earned during {selectedHistory.month}.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
        </ModalGestureRoot>
      </Modal>

      {/* Loading Modal for Download */}
      <Modal
        visible={isDownloading}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.slipLoadingOverlay}>
          <View style={styles.slipLoadingCard}>
            <ActivityIndicator size="large" color="#121358" />
            <Text style={styles.slipLoadingTitle}>Downloading payout slip...</Text>
            <Text style={styles.slipLoadingSubtext}>Please wait</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 32,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: "#121358",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 0,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 8,
  },
  payoutMethodsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  payoutMethodsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  payoutMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  payoutMethodRowSecond: {
    marginTop: 8,
  },
  payoutMethodLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  payoutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  payoutBadgeGray: {
    backgroundColor: "#F3F4F6",
  },
  payoutBadgeYellow: {
    backgroundColor: "#FEF3C7",
  },
  payoutBadgeGreen: {
    backgroundColor: "#D1FAE5",
  },
  payoutBadgeRed: {
    backgroundColor: "#FEE2E2",
  },
  payoutBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  payoutBadgeFgLight: {
    color: "#065F46",
  },
  payoutBadgeFgDark: {
    color: "#92400E",
  },
  payoutBadgeFgRed: {
    color: "#991B1B",
  },
  payoutBadgeFgGray: {
    color: "#4B5563",
  },
  payoutRejectReason: {
    marginTop: 6,
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "500",
  },
  balanceMonth: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  balanceAmountLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FACC15",
    marginBottom: 8,
  },
  balancePayDate: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  historySectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  earningRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  earningLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  earningValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  incentiveRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  incentiveIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  incentiveEmoji: {
    fontSize: 16,
  },
  incentiveLabel: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
  },
  incentiveValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#121358",
  },
  grossPayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#121358",
  },
  grossPayLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  grossPayValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  deductionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  deductionLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  deductionValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  netPayoutCard: {
    backgroundColor: "#121358",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  netPayoutLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 6,
  },
  netPayoutValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  incentivesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  incentiveDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  incentiveDetailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  incentiveDetailLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  incentiveDetailValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10B981",
  },
  totalIncentivesCard: {
    backgroundColor: "#E4E5F0",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  totalIncentivesLabel: {
    fontSize: 16,
    color: "#0E0F45",
    marginBottom: 8,
  },
  totalIncentivesValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#0E0F45",
  },
  historyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  historyLeft: {
    flex: 1,
  },
  historyMonth: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 14,
    color: "#6B7280",
  },
  historyRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  historyStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyStatusPaid: {
    backgroundColor: "#D1FAE5",
  },
  historyStatusPending: {
    backgroundColor: "#FEF3C7",
  },
  historyStatusProcessing: {
    backgroundColor: "#DBEAFE",
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyStatusTextPaid: {
    color: "#065F46",
  },
  historyStatusTextPending: {
    color: "#92400E",
  },
  historyStatusTextProcessing: {
    color: "#1E40AF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#6B7280",
  },
  historyDetailModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    height: "90%",
  },
  historyDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  historyDetailTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#121358",
  },
  historyDetailCard: {
    backgroundColor: "#D1FAE5",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  historyDetailIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyDetailIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyDetailMonth: {
    fontSize: 20,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 4,
  },
  historyDetailDate: {
    fontSize: 14,
    color: "#059669",
    marginBottom: 16,
  },
  historyDetailAmountBox: {
    marginBottom: 16,
  },
  historyDetailAmountLabel: {
    fontSize: 14,
    color: "#059669",
    marginBottom: 4,
  },
  historyDetailAmountValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#065F46",
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121358",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  slipLoadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  slipLoadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    minWidth: 200,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)', elevation: 8 }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 }
    ),
  },
  slipLoadingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    textAlign: "center",
  },
  slipLoadingSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  transactionDetailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  transactionDetailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  transactionDetailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  transactionDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  transactionDetailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  transactionDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  transactionDetailValuePaid: {
    color: "#10B981",
  },
  bankAccountCard: {
    backgroundColor: "#EEEEF5",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  bankAccountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  bankAccountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  bankAccountIconText: {
    fontSize: 20,
  },
  bankAccountTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  bankAccountDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  bankAccountLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  bankAccountValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  paymentInfoCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  paymentInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  paymentInfoIcon: {
    fontSize: 20,
  },
  paymentInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
  },
  paymentInfoText: {
    fontSize: 14,
    color: "#78350F",
    lineHeight: 20,
  },
});

function historyStatusPillStyle(status: HistoryItem["status"]): ViewStyle {
  switch (status) {
    case "paid":
      return styles.historyStatusPaid;
    case "pending":
      return styles.historyStatusPending;
    case "processing":
      return styles.historyStatusProcessing;
    default:
      return {};
  }
}

function historyStatusLabelStyle(status: HistoryItem["status"]): TextStyle {
  switch (status) {
    case "paid":
      return styles.historyStatusTextPaid;
    case "pending":
      return styles.historyStatusTextPending;
    case "processing":
      return styles.historyStatusTextProcessing;
    default:
      return {};
  }
}
