import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react-native";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { Colors, Typography, Spacing, BorderRadius, Shadows, IconSizes } from "@/constants/theme";
import { useDefaultBankAccount, useVerifyBankAccount, useSaveBankAccount, useUpdateBankAccount } from "@/hooks/useBankVerification";
import {
  isValidIFSCFormat,
  validateIFSC,
  validateAccountNumber,
  validateAccountHolder,
} from "@/services/bank.service";

export default function UpdateBankDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [ifscHint, setIfscHint] = useState<string | null>(null);
  const [ifscLookupBusy, setIfscLookupBusy] = useState(false);
  /** Backend returned demo bank verification (penny-drop stub). */
  const [verifyDemoMode, setVerifyDemoMode] = useState(false);

  const { data: defaultBankAccount } = useDefaultBankAccount();
  const verifyBankMutation = useVerifyBankAccount();
  const saveBankMutation = useSaveBankAccount();
  const updateBankMutation = useUpdateBankAccount();

  useEffect(() => {
    if (!defaultBankAccount) return;
    setAccountHolder(defaultBankAccount.accountHolder ?? "");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setBankName(defaultBankAccount.bankName ?? "");
    setIfscCode(defaultBankAccount.ifscCode ?? "");
    setBranch(defaultBankAccount.branch ?? "");
  }, [defaultBankAccount]);

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleIfscBlur = async () => {
    setFocusedField(null);
    const code = ifscCode.trim().toUpperCase();
    if (!isValidIFSCFormat(code)) {
      setIfscHint(null);
      return;
    }
    setIfscLookupBusy(true);
    try {
      const data = await validateIFSC(code);
      if (data && typeof data.BANK === "string") {
        const bank = data.BANK;
        const branchName = typeof data.BRANCH === "string" ? data.BRANCH : "";
        setIfscHint(bank);
        setBankName((prev) => (prev.trim() ? prev : bank));
        setBranch((prev) => (prev.trim() ? prev : branchName || prev));
      } else {
        setIfscHint("IFSC not found");
      }
    } finally {
      setIfscLookupBusy(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};

    if (!validateAccountHolder(accountHolder)) {
      newErrors.accountHolder = "Please enter a valid account holder name (2-100 characters)";
    }
    if (accountNumber !== confirmAccountNumber) {
      newErrors.confirmAccountNumber = "Account numbers do not match";
    }
    if (!validateAccountNumber(accountNumber)) {
      newErrors.accountNumber = "Please enter a valid account number (9-18 digits)";
    }
    if (!isValidIFSCFormat(ifscCode)) {
      newErrors.ifscCode = "Please enter a valid IFSC code (11 characters)";
    }
    if (!bankName?.trim()) {
      newErrors.bankName = "Please enter your bank name";
    }
    if (!branch?.trim()) {
      newErrors.branch = "Please enter branch name and location";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setIsVerifying(true);

    try {
      const verificationResult = await verifyBankMutation.mutateAsync({
        accountHolder,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        bankName,
        branch,
      });

      if (!verificationResult.verified) {
        setErrors({
          verify:
            verificationResult.error ||
            "Bank account verification failed. Please check your details and try again.",
        });
        setLoading(false);
        setIsVerifying(false);
        return;
      }

      setVerifyDemoMode(verificationResult.isDemoMode === true);

      const payload = {
        accountHolder,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        bankName: verificationResult.bankName || bankName,
        branch: verificationResult.branch || branch,
      };

      if (defaultBankAccount?.id) {
        await updateBankMutation.mutateAsync({
          accountId: defaultBankAccount.id,
          details: payload,
        });
      } else {
        await saveBankMutation.mutateAsync(payload);
      }

      setLoading(false);
      setIsVerifying(false);
      setShowSavedModal(true);
    } catch (error) {
      setLoading(false);
      setIsVerifying(false);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Failed to update bank details. Please try again.",
      });
    }
  };

  const saving = loading || isVerifying;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Update Bank Details" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Bank Account Details</Text>
          <Text style={styles.sectionSubtitle}>Enter your bank information for salary payments</Text>

          {(__DEV__ || verifyDemoMode) && (
            <View style={styles.demoBanner}>
              <AlertTriangle color="#B45309" size={IconSizes.md} strokeWidth={2} />
              <Text style={styles.demoBannerText}>
                Demo Mode — Bank verification will be enabled in production
              </Text>
            </View>
          )}

          {errors.verify ? <Text style={styles.fieldError}>{errors.verify}</Text> : null}
          {errors.submit ? <Text style={styles.fieldError}>{errors.submit}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Holder Name</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "accountHolder" && styles.inputContainerFocused,
                errors.accountHolder ? styles.inputContainerError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                value={accountHolder}
                onChangeText={(t) => {
                  setAccountHolder(t);
                  clearFieldError("accountHolder");
                }}
                placeholder="Enter full name as per bank account"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="words"
                onFocus={() => setFocusedField("accountHolder")}
                onBlur={() => setFocusedField(null)}
              />
              {accountHolder.length > 0 && !errors.accountHolder && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.accountHolder ? <Text style={styles.fieldError}>{errors.accountHolder}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Number</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "accountNumber" && styles.inputContainerFocused,
                errors.accountNumber ? styles.inputContainerError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={(t) => {
                  setAccountNumber(t);
                  clearFieldError("accountNumber");
                  clearFieldError("confirmAccountNumber");
                }}
                placeholder="Enter your bank account number"
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="number-pad"
                maxLength={20}
                onFocus={() => setFocusedField("accountNumber")}
                onBlur={() => setFocusedField(null)}
              />
              {accountNumber.length > 0 && !errors.accountNumber && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.accountNumber ? <Text style={styles.fieldError}>{errors.accountNumber}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Account Number</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "confirmAccountNumber" && styles.inputContainerFocused,
                errors.confirmAccountNumber ? styles.inputContainerError : null,
                accountNumber !== confirmAccountNumber &&
                  confirmAccountNumber.length > 0 &&
                  !errors.confirmAccountNumber &&
                  styles.inputContainerError,
              ]}
            >
              <TextInput
                style={styles.input}
                value={confirmAccountNumber}
                onChangeText={(t) => {
                  setConfirmAccountNumber(t);
                  clearFieldError("confirmAccountNumber");
                }}
                placeholder="Re-enter account number to confirm"
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="number-pad"
                maxLength={20}
                onFocus={() => setFocusedField("confirmAccountNumber")}
                onBlur={() => setFocusedField(null)}
              />
              {accountNumber === confirmAccountNumber && confirmAccountNumber.length > 0 && !errors.confirmAccountNumber && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.confirmAccountNumber ? (
              <Text style={styles.fieldError}>{errors.confirmAccountNumber}</Text>
            ) : accountNumber !== confirmAccountNumber && confirmAccountNumber.length > 0 ? (
              <Text style={styles.errorText}>Account numbers do not match</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Name</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "bankName" && styles.inputContainerFocused,
                errors.bankName ? styles.inputContainerError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={(t) => {
                  setBankName(t);
                  clearFieldError("bankName");
                }}
                placeholder="Enter your bank name"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="words"
                onFocus={() => setFocusedField("bankName")}
                onBlur={() => setFocusedField(null)}
              />
              {bankName.length > 0 && !errors.bankName && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.bankName ? <Text style={styles.fieldError}>{errors.bankName}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>IFSC Code</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "ifscCode" && styles.inputContainerFocused,
                errors.ifscCode ? styles.inputContainerError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                value={ifscCode}
                onChangeText={(text) => {
                  setIfscCode(text.toUpperCase());
                  clearFieldError("ifscCode");
                  setIfscHint(null);
                }}
                placeholder="Enter 11-digit IFSC code"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="characters"
                maxLength={11}
                onFocus={() => setFocusedField("ifscCode")}
                onBlur={() => void handleIfscBlur()}
              />
              {ifscCode.length === 11 && isValidIFSCFormat(ifscCode) && !errors.ifscCode && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.ifscCode ? <Text style={styles.fieldError}>{errors.ifscCode}</Text> : null}
            {ifscLookupBusy ? <Text style={styles.ifscHintText}>Looking up IFSC…</Text> : null}
            {ifscHint && !errors.ifscCode && !ifscLookupBusy ? (
              <Text
                style={[
                  styles.ifscHintText,
                  ifscHint === "IFSC not found" ? styles.ifscHintError : null,
                ]}
              >
                {ifscHint === "IFSC not found" ? ifscHint : `Bank: ${ifscHint}`}
              </Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Branch Location</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "branch" && styles.inputContainerFocused,
                errors.branch ? styles.inputContainerError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                value={branch}
                onChangeText={(t) => {
                  setBranch(t);
                  clearFieldError("branch");
                }}
                placeholder="Enter branch name and location"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="words"
                onFocus={() => setFocusedField("branch")}
                onBlur={() => setFocusedField(null)}
              />
              {branch.length > 0 && !errors.branch && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.branch ? <Text style={styles.fieldError}>{errors.branch}</Text> : null}
          </View>

          <View style={styles.infoBox}>
            <AlertTriangle color={Colors.warning[400]} size={IconSizes.md} strokeWidth={2} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Important</Text>
              <Text style={styles.infoText}>
                Ensure your bank details are correct. All salary payments will be credited to this account.
              </Text>
            </View>
          </View>

          <View style={styles.submitWrap}>
            <PrimaryButton
              title={isVerifying ? "Verifying…" : "Verify & Update Bank Details"}
              onPress={handleUpdate}
              disabled={saving}
              loading={saving}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showSavedModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <CheckCircle2 color={Colors.primary[500]} size={56} strokeWidth={2} />
            <Text style={styles.successTitle}>Details Saved</Text>
            <Text style={styles.successMessage}>
              Your bank details have been saved successfully and are pending verification.
            </Text>
            <PrimaryButton
              title="Done"
              onPress={() => {
                setShowSavedModal(false);
                try {
                  if (router.canGoBack()) router.back();
                  else router.push("/bank-details");
                } catch {
                  try {
                    router.push("/bank-details");
                  } catch {
                    // no-op
                  }
                }
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
  },
  sectionTitle: {
    fontSize: Typography.fontSize["3xl"],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
  },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  demoBannerText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: "#92400E",
  },
  ifscHintText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  ifscHintError: {
    color: Colors.error[400],
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gray[700],
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  inputContainerFocused: {
    borderColor: Colors.primary[500],
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: Colors.error[400],
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.primary,
    padding: 0,
  },
  fieldError: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.error[400],
    marginTop: Spacing.sm,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: Colors.warning[50],
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning[100],
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.secondary[700],
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.secondary[700],
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.base,
  },
  submitWrap: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  bottomSpacer: {
    height: Spacing.xl,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  successCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius["2xl"],
    padding: Spacing["2xl"],
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    gap: Spacing.lg,
  },
  successTitle: {
    fontSize: Typography.fontSize["2xl"],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: "center",
  },
  successMessage: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
  },
});
