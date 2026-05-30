import React from "react";
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface ConfirmationModalProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmationModal({
  visible,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onCancel}
        />
        <View
          style={[styles.modalCard, Platform.OS === "web" && styles.modalCardWeb]}
          pointerEvents="auto"
        >
          <View style={styles.iconContainer}>
            <View style={styles.iconWrapper}>
              <AlertCircle color={Colors.warning[400]} size={36} strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>

          <View style={styles.divider} />

          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonLeft,
                (loading || pressed) && styles.buttonPressed,
              ]}
              onPress={loading ? undefined : onCancel}
              disabled={loading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
            >
              <Text style={styles.buttonText}>{cancelText}</Text>
            </Pressable>

            <View style={styles.buttonDivider} />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonRight,
                (loading || pressed) && styles.buttonPressed,
                Platform.OS === "web" && styles.buttonConfirmWeb,
              ]}
              onPress={() => {
                if (loading) return;
                onConfirm();
              }}
              {...(Platform.OS === "web" && {
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (loading) return;
                  onConfirm();
                },
              })}
              disabled={loading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={[styles.buttonText, styles.buttonTextPrimary]}>{confirmText}</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
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
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)", elevation: 6 }
      : { ...Shadows.xl, shadowOpacity: 0.2 }),
  },
  modalCardWeb: {
    position: "relative",
    zIndex: 1,
  },
  iconContainer: {
    alignItems: "center",
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.warning[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: "center",
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    lineHeight: 24,
  },
  body: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing['2xl'],
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.medium,
  },
  buttonContainer: {
    flexDirection: "row",
    height: 56,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLeft: {
    borderBottomLeftRadius: BorderRadius['2xl'],
  },
  buttonRight: {
    borderBottomRightRadius: BorderRadius['2xl'],
    backgroundColor: Colors.error[400],
  },
  buttonConfirmWeb: {
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDivider: {
    width: 1,
    backgroundColor: Colors.border.medium,
  },
  buttonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary[650],
  },
  buttonTextPrimary: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});
