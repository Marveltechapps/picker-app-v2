import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { AlertCircle } from "lucide-react-native";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";

interface ExitConfirmModalProps {
  visible: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function ExitConfirmModal({
  visible,
  onConfirm,
  onCancel,
  loading = false,
}: ExitConfirmModalProps) {
  const handleConfirm = async () => {
    if (loading) return;
    await onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel} />
        <View
          style={[styles.modalCard, Platform.OS === "web" && styles.modalCardWeb]}
          pointerEvents="auto"
        >
          <View style={styles.iconWrap}>
            <AlertCircle color={Colors.error[400]} size={40} strokeWidth={2} />
          </View>
          <Text style={styles.title}>Exit</Text>
          <Text style={styles.message}>Do you want to exit?</Text>
          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnCancel,
                pressed && styles.btnPressed,
              ]}
              onPress={loading ? undefined : onCancel}
              disabled={loading}
            >
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnConfirm,
                pressed && styles.btnPressed,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnConfirmText}>Confirm</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing['2xl'],
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(139, 92, 246, 0.08)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  modalCardWeb: {
    position: "relative",
    zIndex: 1,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.sm,
  },
  buttons: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: {
    backgroundColor: Colors.gray[100],
  },
  btnConfirm: {
    backgroundColor: Colors.error[400],
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnCancelText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  btnConfirmText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
});
