import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Package, Send, CheckCircle2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { reportPickerIssue } from "@/services/issue.service";
import { appNotify } from "@/utils/appNotify";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";

export default function InventoryMismatchScreen() {
  const router = useRouter();
  const [product, setProduct] = useState("");
  const [expectedQty, setExpectedQty] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!product.trim()) {
      appNotify.error("Please enter the product name.", "Required");
      return;
    }
    setSubmitting(true);
    try {
      const message = [
        `Product: ${product.trim()}`,
        `Expected qty: ${expectedQty.trim() || "—"}`,
        `Actual qty: ${actualQty.trim() || "—"}`,
        reason.trim() ? `Reason: ${reason.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const result = await reportPickerIssue({
        issueType: "inventory_mismatch",
        description: message,
        severity: "medium",
      });
      setSubmitting(false);
      if (result.success) {
        setShowSuccess(true);
      } else {
        appNotify.error(result.error || "Failed to submit. Please try again.");
      }
    } catch {
      setSubmitting(false);
      appNotify.error("Failed to submit. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Inventory Mismatch" showBack onBackPress={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Package size={40} color="#5B4EFF" />
        </View>
        <Text style={styles.title}>Report Inventory Mismatch</Text>
        <Text style={styles.subtitle}>
          Product, expected vs actual quantity, and reason
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Product name / SKU *</Text>
          <TextInput
            style={styles.input}
            value={product}
            onChangeText={setProduct}
            placeholder="e.g. Product name or SKU"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Expected qty</Text>
            <TextInput
              style={styles.input}
              value={expectedQty}
              onChangeText={setExpectedQty}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Actual qty</Text>
            <TextInput
              style={styles.input}
              value={actualQty}
              onChangeText={setActualQty}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={reason}
            onChangeText={setReason}
            placeholder="Describe the mismatch (optional)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submit, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Send size={20} color="#FFF" />
              <Text style={styles.submitText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <CheckCircle2 color="#5B4EFF" size={56} strokeWidth={2} />
            <Text style={styles.successTitle}>Report Submitted</Text>
            <Text style={styles.successMessage}>
              Your inventory mismatch report has been submitted successfully. The warehouse team will review it
              shortly.
            </Text>
            <PrimaryButton
              title="Back to Home"
              onPress={() => {
                setShowSuccess(false);
                router.replace("/(tabs)");
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  field: { marginBottom: Spacing.lg },
  row: { flexDirection: "row", gap: Spacing.md },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: "#111827",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#5B4EFF",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    gap: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  successMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
});
