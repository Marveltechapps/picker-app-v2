import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Animated,
  ActivityIndicator,
  Platform,
  Dimensions,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  Download,
  FileText,
  Gift,
  History,
  TrendingUp,
  CheckCircle,
  X,
  ArrowLeft,
} from "lucide-react-native";
import { router } from "expo-router";
import { useAuth } from "@/state/authContext";
import { getOvertimeMultiplier } from "@/utils/payCalculations";
import { useWalletBalance, useWithdraw } from "@/hooks/useWithdraw";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { getEarningsBreakdown, type EarningsBreakdown } from "@/services/wallet.service";
import { useDefaultBankAccount, useVerifyBankAccount, useSaveBankAccount } from "@/hooks/useBankVerification";
import {
  validateBankForm,
  maskAccountNumber,
  type SavedBankAccount,
} from "@/services/bank.service";
import { getProfileApi } from "@/services/user.service";
import type { Transaction } from "@/services/wallet.service";
import { appNotify } from "@/utils/appNotify";

type TabType = "breakdown" | "incentives" | "history";

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

type PayoutBalanceStatus = "paid" | "pending" | "processing";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PayoutsScreen() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("breakdown");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [confettiAnim] = useState(new Animated.Value(0));
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAmountInputFocused, setIsAmountInputFocused] = useState(false);
  const [lastWithdrawnAmount, setLastWithdrawnAmount] = useState("");
  const [lastWithdrawStatus, setLastWithdrawStatus] = useState<'pending' | 'completed'>('completed');

  // Bank account form state
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [earningsBreakdownData, setEarningsBreakdownData] = useState<EarningsBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfileSlice>(null);

  // API Hooks
  const { data: walletBalance, isLoading: isLoadingBalance } = useWalletBalance();
  const { data: transactionHistory, isLoading: isLoadingHistory } = useTransactionHistory({ limit: 50 });
  const { data: defaultBankAccount } = useDefaultBankAccount();
  const verifyBankMutation = useVerifyBankAccount();
  const saveBankMutation = useSaveBankAccount();
  const withdrawMutation = useWithdraw();

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

  // Fetch earnings breakdown for current month
  useEffect(() => {
    let cancelled = false;
    setBreakdownLoading(true);
    getEarningsBreakdown()
      .then((data) => {
        if (!cancelled) setEarningsBreakdownData(data ?? null);
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getProfileApi().then((p) => {
      if (!cancelled && p) {
        setPayoutProfile({
          upiId: p.upiId,
          upiPayoutVerificationStatus: p.upiPayoutVerificationStatus,
          upiPayoutRejectionReason: p.upiPayoutRejectionReason,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [defaultBankAccount?.id]);

  // Calculate current month and year dynamically
  const now = new Date();
  const currentMonth = now.toLocaleString("en-US", { month: "long" });
  const currentYear = now.getFullYear();
  const currentMonthYear = `${currentMonth} ${currentYear}`;

  // Calculate pay date (typically 5th of next month)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const payDate = nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Use API breakdown when available; fallback to zeros so UI never shows NaN
  const b = earningsBreakdownData;
  const earningsBreakdown = useMemo(
    () => ({
      basePay: b?.basePay ?? 0,
      baseHours: b?.baseHours ?? 0,
      overtime: b?.overtime ?? 0,
      overtimeHours: b?.overtimeHours ?? 0,
      performance: b?.performance ?? 0,
      attendance: b?.attendance ?? 0,
      accuracy: b?.accuracy ?? 0,
      referral: b?.referral ?? 0,
    }),
    [b]
  );
  const grossPay = b?.grossPay ?? earningsBreakdown.basePay + earningsBreakdown.overtime + earningsBreakdown.performance + earningsBreakdown.attendance + earningsBreakdown.accuracy + earningsBreakdown.referral;
  const deductions = useMemo(
    () => ({ tds: b?.deductions?.tds ?? 0 }),
    [b]
  );
  const rawNet = walletBalance?.availableBalance ?? b?.netPayout ?? Math.max(0, grossPay - deductions.tds);
  const netPayout = Number.isFinite(rawNet) && rawNet >= 0 ? rawNet : 0;
  const displayPayDate = payDate || nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const incentivesFromApi = b?.incentives ?? { referral: 0, bonus: 0, total: 0 };

  const payoutData = {
    currentMonth: currentMonthYear,
    netPayout,
    status: "processing" as const,
    payDate: displayPayDate,
    earnings: earningsBreakdown,
    grossPay,
    deductions,
    incentives: incentivesFromApi,
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

  const handleWithdraw = () => {
    if (!bankDetails) {
      setShowAddBankModal(true);
    } else {
      setShowWithdrawModal(true);
      setWithdrawAmount("");
    }
  };

  const handleAddBank = async () => {
    const holder = accountHolderName.trim();
    const accNum = accountNumber.trim();
    const ifsc = ifscCode.trim().toUpperCase();

    const validation = validateBankForm(accountHolderName, accountNumber, ifscCode);
    if (!validation.valid) {
      appNotify.error(validation.error ?? "Please check your bank details.", "Validation Error");
      return;
    }

    setIsVerifyingBank(true);
    try {
      const verificationResult = await verifyBankMutation.mutateAsync({
        accountHolder: holder,
        accountNumber: accNum,
        ifscCode: ifsc,
      });

      if (!verificationResult.verified) {
        appNotify.error(
          verificationResult.error || "Bank account verification failed. Please check your details and try again.",
          "Verification Failed"
        );
        setIsVerifyingBank(false);
        return;
      }

      const savedAccount = await saveBankMutation.mutateAsync({
        accountHolder: holder,
        accountNumber: accNum,
        ifscCode: ifsc,
        bankName: verificationResult.bankName,
        branch: verificationResult.branch,
      });

      setBankDetails({
        accountNumber: savedAccount.accountNumber,
        ifsc: savedAccount.ifscCode,
        holderName: savedAccount.accountHolder,
        bankName: savedAccount.bankName,
      });

      setAccountNumber("");
      setIfscCode("");
      setAccountHolderName("");
      setShowAddBankModal(false);
      setShowWithdrawModal(true);
      setWithdrawAmount("");
      appNotify.success("Bank account verified and saved successfully!");
    } catch (error) {
      appNotify.error(
        error instanceof Error ? error.message : "Failed to verify bank account. Please try again."
      );
    } finally {
      setIsVerifyingBank(false);
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!bankDetails) {
      appNotify.error("Bank account not found. Please add bank details first.");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      appNotify.error("Please enter a valid amount.");
      return;
    }

    const maxAllowed = walletBalance?.availableBalance ?? netPayout;
    if (amount > maxAllowed) {
      appNotify.error("Insufficient balance.");
      return;
    }

    if (!defaultBankAccount) {
      appNotify.error("Bank account not linked. Please add bank details again.");
      return;
    }

    try {
      const result = await withdrawMutation.mutateAsync({
        amount,
        bankAccountId: defaultBankAccount.id,
      });

      if (result.success) {
        setLastWithdrawnAmount(withdrawAmount);
        setLastWithdrawStatus((result.status === 'pending' || result.status === 'processing') ? 'pending' : 'completed');
        setShowWithdrawModal(false);
        setShowSuccessModal(true);
        setWithdrawAmount("");
        Animated.sequence([
          Animated.timing(confettiAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(confettiAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      } else {
        appNotify.error(
          result.error || "Failed to process withdrawal. Please try again.",
          "Withdrawal Failed"
        );
      }
    } catch (error) {
      appNotify.error(
        error instanceof Error ? error.message : "Failed to process withdrawal. Please try again."
      );
    }
  };

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

  const renderBreakdownTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={20} color="#10B981" />
          <Text style={styles.sectionTitle}>Earnings</Text>
        </View>

        <View style={styles.earningRow}>
          <Text style={styles.earningLabel}>Base Pay ({payoutData.earnings.baseHours}h)</Text>
          <Text style={styles.earningValue}>₹{payoutData.earnings.basePay.toLocaleString()}</Text>
        </View>

        <View style={styles.earningRow}>
          <Text style={styles.earningLabel}>Overtime ({payoutData.earnings.overtimeHours}h)</Text>
          <Text style={styles.earningValue}>₹{payoutData.earnings.overtime.toLocaleString()}</Text>
        </View>

        <View style={styles.incentiveRow}>
          <View style={styles.incentiveIcon}>
            <Text style={styles.incentiveEmoji}>🏆</Text>
          </View>
          <Text style={styles.incentiveLabel}>Performance</Text>
          <Text style={styles.incentiveValue}>+₹{payoutData.earnings.performance.toLocaleString()}</Text>
        </View>

        <View style={styles.incentiveRow}>
          <View style={styles.incentiveIcon}>
            <CheckCircle size={16} color="#10B981" />
          </View>
          <Text style={styles.incentiveLabel}>Attendance</Text>
          <Text style={styles.incentiveValue}>+₹{payoutData.earnings.attendance.toLocaleString()}</Text>
        </View>

        <View style={styles.incentiveRow}>
          <View style={styles.incentiveIcon}>
            <Text style={styles.incentiveEmoji}>🎯</Text>
          </View>
          <Text style={styles.incentiveLabel}>Accuracy</Text>
          <Text style={styles.incentiveValue}>+₹{payoutData.earnings.accuracy.toLocaleString()}</Text>
        </View>

        <View style={styles.incentiveRow}>
          <View style={styles.incentiveIcon}>
            <Gift size={16} color="#8B5CF6" />
          </View>
          <Text style={styles.incentiveLabel}>Referral</Text>
          <Text style={styles.incentiveValue}>+₹{payoutData.earnings.referral.toLocaleString()}</Text>
        </View>

        <View style={styles.grossPayRow}>
          <Text style={styles.grossPayLabel}>Gross Pay</Text>
          <Text style={styles.grossPayValue}>₹{payoutData.grossPay.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <FileText size={20} color="#EF4444" />
          <Text style={styles.sectionTitle}>Deductions</Text>
        </View>

        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>TDS & Taxes</Text>
          <Text style={styles.deductionValue}>-₹{payoutData.deductions.tds.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.netPayoutCard}>
        <Text style={styles.netPayoutLabel}>Net Payout</Text>
        <Text style={styles.netPayoutValue}>₹{payoutData.netPayout.toLocaleString()}</Text>
      </View>
    </ScrollView>
  );

  const renderIncentivesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.incentivesCard}>
        <View style={styles.incentiveDetailRow}>
          <View style={styles.incentiveDetailLeft}>
            <Gift size={24} color="#8B5CF6" />
            <Text style={styles.incentiveDetailLabel}>Referral Bonus</Text>
          </View>
          <Text style={styles.incentiveDetailValue}>₹{payoutData.incentives.referral.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.incentivesCard}>
        <View style={styles.incentiveDetailRow}>
          <View style={styles.incentiveDetailLeft}>
            <TrendingUp size={24} color="#10B981" />
            <Text style={styles.incentiveDetailLabel}>Performance Bonus</Text>
          </View>
          <Text style={styles.incentiveDetailValue}>₹{payoutData.incentives.bonus.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.totalIncentivesCard}>
        <Text style={styles.totalIncentivesLabel}>Total Incentives</Text>
        <Text style={styles.totalIncentivesValue}>₹{payoutData.incentives.total.toLocaleString()}</Text>
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {isLoadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5B4EFF" />
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
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingTop: 10 }} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Current Month</Text>
            <View style={[styles.statusBadge, balanceStatusPillStyle(payoutData.status)]}>
              <Text style={styles.statusBadgeText}>
                {payoutData.status === "processing" ? "Processing" : payoutData.status === "pending" ? "Pending" : "Paid"}
              </Text>
            </View>
          </View>
          <Text style={styles.balanceMonth}>{payoutData.currentMonth}</Text>
          <Text style={styles.balanceAmountLabel}>Net Payout</Text>
          <Text style={styles.balanceAmount}>₹{payoutData.netPayout.toLocaleString()}</Text>
          <Text style={styles.balancePayDate}>Pay date: {payoutData.payDate}</Text>
          
          <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw}>
            <Download size={20} color="#000000" />
            <Text style={styles.withdrawButtonText}>Withdraw to Bank</Text>
          </TouchableOpacity>
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

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "breakdown" && styles.tabActive]}
            onPress={() => setActiveTab("breakdown")}
          >
            <FileText size={20} color={activeTab === "breakdown" ? "#5B4EFF" : "#9CA3AF"} />
            <Text style={[styles.tabText, activeTab === "breakdown" && styles.tabTextActive]}>Breakdown</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "incentives" && styles.tabActive]}
            onPress={() => setActiveTab("incentives")}
          >
            <Gift size={20} color={activeTab === "incentives" ? "#5B4EFF" : "#9CA3AF"} />
            <Text style={[styles.tabText, activeTab === "incentives" && styles.tabTextActive]}>Incentives</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "history" && styles.tabActive]}
            onPress={() => setActiveTab("history")}
          >
            <History size={20} color={activeTab === "history" ? "#5B4EFF" : "#9CA3AF"} />
            <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {activeTab === "breakdown" && renderBreakdownTab()}
        {activeTab === "incentives" && renderIncentivesTab()}
        {activeTab === "history" && renderHistoryTab()}
      </ScrollView>

      <Modal
        visible={showAddBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addBankModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Bank Details</Text>
              <TouchableOpacity onPress={() => setShowAddBankModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter account holder name"
                value={accountHolderName}
                onChangeText={setAccountHolderName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bank Account Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                keyboardType="number-pad"
                value={accountNumber}
                onChangeText={setAccountNumber}
                maxLength={18}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>IFSC Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter IFSC code"
                autoCapitalize="characters"
                value={ifscCode}
                onChangeText={(text) => setIfscCode(text.toUpperCase())}
                maxLength={11}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, (isVerifyingBank || withdrawMutation.isPending) && styles.saveButtonDisabled]}
              onPress={handleAddBank}
              disabled={isVerifyingBank || withdrawMutation.isPending}
            >
              {isVerifyingBank ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Verify & Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.withdrawModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Withdrawal</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.withdrawAmountInputBox}>
              <Text style={styles.withdrawAmountLabel}>Enter Amount</Text>
              <View style={[
                styles.amountInputContainer,
                isAmountInputFocused && styles.amountInputContainerFocused
              ]}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  keyboardType="number-pad"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  placeholderTextColor="#C4B5FD"
                  onFocus={() => setIsAmountInputFocused(true)}
                  onBlur={() => setIsAmountInputFocused(false)}
                />
              </View>
              <Text style={styles.availableBalanceText}>
                Available: ₹{payoutData.netPayout.toLocaleString()}
              </Text>
            </View>

            {bankDetails && (
              <View style={styles.bankDetailsBox}>
                <Text style={styles.bankDetailsTitle}>Bank Account Details</Text>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>Account Holder</Text>
                  <Text style={styles.bankDetailValue}>{bankDetails.holderName}</Text>
                </View>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>Bank Name</Text>
                  <Text style={styles.bankDetailValue}>{bankDetails.bankName}</Text>
                </View>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>Account Number</Text>
                  <Text style={styles.bankDetailValue}>{bankDetails.accountNumber}</Text>
                </View>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>IFSC Code</Text>
                  <Text style={styles.bankDetailValue}>{bankDetails.ifsc}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={[
                styles.confirmButton, 
                (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > netPayout || withdrawMutation.isPending) && styles.confirmButtonDisabled
              ]} 
              onPress={handleConfirmWithdraw}
              disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > netPayout || withdrawMutation.isPending}
            >
              {withdrawMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Withdrawal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Animated.View
              style={[
                styles.confettiContainer,
                {
                  opacity: confettiAnim,
                  transform: [
                    {
                      scale: confettiAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1.5],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.confetti}>🎉</Text>
            </Animated.View>
            <View style={styles.successIcon}>
              <CheckCircle size={64} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>
              {lastWithdrawStatus === 'pending' ? 'Request Submitted' : 'Withdrawal Successful!'}
            </Text>
            <Text style={styles.successAmount}>₹{lastWithdrawnAmount || withdrawAmount} {lastWithdrawStatus === 'pending' ? 'Requested' : 'Withdrawn'}</Text>
            <Text style={styles.successMessage}>
              {lastWithdrawStatus === 'pending'
                ? 'Your withdrawal request is pending approval. You will be notified once it is processed.'
                : 'Your withdrawal request has been processed successfully'}
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedHistory(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyDetailModal}>
            <View style={styles.historyDetailHeader}>
              <TouchableOpacity onPress={() => setSelectedHistory(null)}>
                <ArrowLeft size={24} color="#5B4EFF" />
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
                    <FileText size={20} color="#5B4EFF" />
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
            <ActivityIndicator size="large" color="#5B4EFF" />
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
    backgroundColor: "#5B4EFF",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 0,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeProcessing: {
    backgroundColor: "#FFA500",
  },
  statusBadgePending: {
    backgroundColor: "#F59E0B",
  },
  statusBadgePaid: {
    backgroundColor: "#10B981",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
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
    marginBottom: 12,
  },
  payoutMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payoutMethodRowSecond: {
    marginTop: 12,
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
    marginBottom: 20,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FACC15",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    marginHorizontal: 20,
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
  tabActive: {
    backgroundColor: "#F3F4F6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  tabTextActive: {
    color: "#5B4EFF",
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
    color: "#8B5CF6",
  },
  grossPayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#5B4EFF",
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
    backgroundColor: "#5B4EFF",
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
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  totalIncentivesLabel: {
    fontSize: 16,
    color: "#5B21B6",
    marginBottom: 8,
  },
  totalIncentivesValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#5B21B6",
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
  addBankModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
  },
  saveButton: {
    backgroundColor: "#5B4EFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  withdrawModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  withdrawAmountBox: {
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  withdrawAmountInputBox: {
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: SCREEN_WIDTH < 400 ? 16 : 20, // Responsive padding
    marginBottom: 24,
    width: "100%",
  },
  withdrawAmountLabel: {
    fontSize: 14,
    color: "#5B21B6",
    marginBottom: 12,
    fontWeight: "600",
  },
  withdrawAmountValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#5B21B6",
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: SCREEN_WIDTH < 400 ? 12 : 16, // Responsive padding
    marginBottom: 12,
    borderWidth: 2, // Outline border
    borderColor: "#C4B5FD", // Purple border matching placeholder
    minHeight: SCREEN_WIDTH < 400 ? 60 : 75, // Responsive height
    ...(Platform.OS === "web" ? { outlineWidth: 0 } : {}),
  },
  amountInputContainerFocused: {
    borderColor: "#8B5CF6", // Darker purple when focused
    borderWidth: 2.5, // Slightly thicker border on focus
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 0 0 3px rgba(139, 92, 246, 0.1)",
          outlineWidth: 0,
        }
      : {
          shadowColor: "#8B5CF6",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 2,
        }
    ),
  },
  currencySymbol: {
    fontSize: SCREEN_WIDTH < 400 ? 24 : 32, // Responsive font size
    fontWeight: "700",
    color: "#5B21B6",
    marginRight: SCREEN_WIDTH < 400 ? 6 : 8, // Responsive margin
  },
  amountInput: {
    flex: 1,
    fontSize: SCREEN_WIDTH < 400 ? 24 : 32, // Responsive font size
    fontWeight: "700",
    color: "#5B21B6",
    paddingVertical: SCREEN_WIDTH < 400 ? 12 : 16, // Responsive padding
    minHeight: SCREEN_WIDTH < 400 ? 60 : 75, // Responsive height
  },
  availableBalanceText: {
    fontSize: 14,
    color: "#7C3AED",
    textAlign: "center",
  },
  bankDetailsBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  bankDetailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  bankDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  bankDetailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  bankDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  confirmButton: {
    backgroundColor: "#5B4EFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: "#D1D5DB",
    opacity: 0.6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
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
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  successModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 24,
    alignItems: "center",
  },
  confettiContainer: {
    position: "absolute" as const,
    top: -20,
  },
  confetti: {
    fontSize: 80,
  },
  successIcon: {
    marginBottom: 24,
    marginTop: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#10B981",
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: "#5B4EFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
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
    color: "#5B4EFF",
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
    backgroundColor: "#5B4EFF",
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
    backgroundColor: "#EEF2FF",
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

function balanceStatusPillStyle(status: PayoutBalanceStatus): ViewStyle {
  switch (status) {
    case "paid":
      return styles.statusBadgePaid;
    case "pending":
      return styles.statusBadgePending;
    case "processing":
      return styles.statusBadgeProcessing;
    default:
      return {};
  }
}
