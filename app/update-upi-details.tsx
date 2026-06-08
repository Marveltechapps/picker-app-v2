import { ScrollView } from "@/utils/scrollables";
import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CheckCircle2, AlertTriangle } from "lucide-react-native";
import { getProfileApi, setUpiApi } from "@/services/user.service";
import { publishPaymentDetailsUpdate } from "@/utils/paymentDetailsStore";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { Colors, Typography, Spacing, BorderRadius, Shadows, IconSizes } from "@/constants/theme";

const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

export default function UpdateUpiDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [hasExistingUpi, setHasExistingUpi] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const loadUpiDetails = useCallback(async () => {
    try {
      const profile = await getProfileApi({ bypassCache: true });
      const nextId = profile?.upiId?.trim() ?? "";
      const nextName = profile?.upiName?.trim() ?? "";
      setUpiId(nextId);
      setUpiName(nextName);
      setHasExistingUpi(!!(nextId || nextName));
      setErrors({});
    } catch (error) {
      console.error("Error loading UPI details:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUpiDetails();
    }, [loadUpiDetails])
  );

  const screenTitle = hasExistingUpi ? "Edit UPI Details" : "Add UPI Details";

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};

    if (!upiId?.trim()) {
      newErrors.upiId = "Please enter your UPI ID";
    } else if (!UPI_REGEX.test(upiId.trim())) {
      newErrors.upiId = "Please enter a valid UPI ID";
    }

    if (!upiName?.trim() || upiName.trim().length < 2) {
      newErrors.upiName = "Please enter name as per UPI account (at least 2 characters)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const nextId = upiId.trim();
    const nextName = upiName.trim();

    setLoading(true);
    try {
      const result = await setUpiApi(nextId, nextName);
      if (!result.success) {
        setLoading(false);
        setErrors({ submit: result.error ?? "Failed to update UPI details." });
        return;
      }

      publishPaymentDetailsUpdate({ upi: { upiId: nextId, upiName: nextName } });
      setHasExistingUpi(true);
      setLoading(false);
      setShowSavedModal(true);
    } catch {
      setLoading(false);
      setErrors({ submit: "Failed to save UPI details" });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title={screenTitle} />

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
          <Text style={styles.sectionTitle}>UPI Payment Details</Text>
          <Text style={styles.sectionSubtitle}>
            Link your UPI ID for instant salary transfers
          </Text>

          {errors.submit ? <Text style={styles.fieldError}>{errors.submit}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>UPI ID</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "upiId" && styles.inputContainerFocused,
                (errors.upiId ||
                  (upiId.length > 0 && !UPI_REGEX.test(upiId))) &&
                  styles.inputContainerError,
              ]}
            >
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={(t) => {
                  setUpiId(t);
                  clearFieldError("upiId");
                }}
                placeholder="yourname@paytm"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedField("upiId")}
                onBlur={() => setFocusedField(null)}
              />
              {upiId.length > 0 && UPI_REGEX.test(upiId) && !errors.upiId && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.upiId ? (
              <Text style={styles.fieldError}>{errors.upiId}</Text>
            ) : upiId.length > 0 && !UPI_REGEX.test(upiId) ? (
              <Text style={styles.errorText}>Please enter a valid UPI ID</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>UPI Name</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "upiName" && styles.inputContainerFocused,
                errors.upiName ? styles.inputContainerError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                value={upiName}
                onChangeText={(t) => {
                  setUpiName(t);
                  clearFieldError("upiName");
                }}
                placeholder="Enter name as per UPI account"
                placeholderTextColor={Colors.text.tertiary}
                autoCapitalize="words"
                onFocus={() => setFocusedField("upiName")}
                onBlur={() => setFocusedField(null)}
              />
              {upiName.length > 0 && !errors.upiName && (
                <CheckCircle2 color={Colors.success[400]} size={IconSizes.sm} strokeWidth={2} />
              )}
            </View>
            {errors.upiName ? <Text style={styles.fieldError}>{errors.upiName}</Text> : null}
          </View>

          <View style={styles.infoBox}>
            <AlertTriangle color={Colors.warning[400]} size={IconSizes.md} strokeWidth={2} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Important</Text>
              <Text style={styles.infoText}>
                Verify your UPI ID is correct. Payments will be sent to this UPI address.
              </Text>
            </View>
          </View>

          <View style={styles.submitWrap}>
            <PrimaryButton
              title="Save UPI Details"
              onPress={handleUpdate}
              disabled={loading}
              loading={loading}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showSavedModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <CheckCircle2 color={Colors.primary[500]} size={56} strokeWidth={2} />
            <Text style={styles.successTitle}>UPI Details Saved</Text>
            <Text style={styles.successMessage}>
              Your UPI ID has been saved successfully and is pending verification.
            </Text>
            <PrimaryButton
              title="Done"
              onPress={() => {
                setShowSavedModal(false);
                try {
                  if (router.canGoBack()) router.back();
                  else router.replace("/bank-details");
                } catch {
                  try {
                    router.replace("/bank-details");
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
    marginBottom: Spacing.xl,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
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
