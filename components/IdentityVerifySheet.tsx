import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomSheetModal from "./BottomSheetModal";
import { Camera, Fingerprint, Shield, ChevronRight, Check } from "lucide-react-native";
import { PICKER_VERIFICATION_METHOD_KEY } from "@/constants/storageKeys";
import { preloadVerification } from "@/utils/verificationPreload";

interface IdentityVerifySheetProps {
  visible: boolean;
  onSelectMethod: (method: "face" | "fingerprint") => void;
  onClose: () => void;
  onBack: () => void;
}

export default function IdentityVerifySheet({ visible, onSelectMethod, onClose, onBack }: IdentityVerifySheetProps) {
  const [selectedMethod, setSelectedMethod] = useState<"face" | "fingerprint" | null>(null);
  const [rememberMyChoice, setRememberMyChoice] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (visible) {
      preloadVerification();
      AsyncStorage.getItem(PICKER_VERIFICATION_METHOD_KEY).then((saved) => {
        if (mountedRef.current && (saved === "face" || saved === "fingerprint")) {
          setRememberMyChoice(true);
        }
      }).catch(() => {});
    }
  }, [visible]);

  const handleSelectMethod = useCallback(
    (method: "face" | "fingerprint") => {
      if (isSelecting) return;
      setIsSelecting(true);
      setSelectedMethod(method);
      if (__DEV__) console.log("[IdentityVerify] Method selected:", method);
      if (rememberMyChoice) {
        AsyncStorage.setItem(PICKER_VERIFICATION_METHOD_KEY, method).catch(() => {});
      } else {
        AsyncStorage.removeItem(PICKER_VERIFICATION_METHOD_KEY).catch(() => {});
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSelectMethod(method);
    },
    [onSelectMethod, rememberMyChoice, isSelecting]
  );

  const toggleRememberMyChoice = useCallback(() => {
    setRememberMyChoice((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) {
      setIsSelecting(false);
      setSelectedMethod(null);
    }
  }, [visible]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Verify Identity"
      height="85%"
      scrollable={true}
      placement="top"
      onBack={onBack}
    >
      <View style={styles.container}>
        {/* Compact header so both options are visible in Expo Go without scrolling */}
        <View style={styles.stepIndicator}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: "100%" }]} />
          </View>
          <View style={styles.stepLabels}>
            <Text style={styles.stepLabelActive}>Step 2 of 2</Text>
            <Text style={styles.stepLabelActive}>Identity Verification</Text>
          </View>
        </View>

        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Shield color="#121358" size={30} strokeWidth={2.5} />
          </View>
        </View>

        <Text style={styles.title}>Verify Your Identity</Text>
        <Text style={styles.subtitle}>Choose your preferred method</Text>

        {/* Methods: Fingerprint first; ensure both cards are visible on native (no overflow hidden) */}
        <View style={styles.methodsContainer} collapsable={false}>
          <TouchableOpacity
            style={[
              styles.methodCard,
              styles.methodCardPink,
              selectedMethod === "fingerprint" && styles.methodCardSelected,
              isSelecting && styles.methodCardPressed,
            ]}
            onPress={() => handleSelectMethod("fingerprint")}
            disabled={isSelecting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Fingerprint Scan - Secure biometric"
          >
            <View style={styles.methodLeft}>
              <View style={[styles.methodIcon, styles.methodIconPink]}>
                <Fingerprint color="#EC4899" size={28} strokeWidth={2.5} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Fingerprint Scan</Text>
                <Text style={styles.methodSubtitle}>Secure biometric</Text>
              </View>
            </View>
            <ChevronRight color="#9CA3AF" size={24} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodCard,
              styles.methodCardBlue,
              selectedMethod === "face" && styles.methodCardSelected,
              isSelecting && styles.methodCardPressed,
            ]}
            onPress={() => handleSelectMethod("face")}
            disabled={isSelecting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Face Recognition - Quick and contactless"
          >
            <View style={styles.methodLeft}>
              <View style={[styles.methodIcon, styles.methodIconBlue]}>
                <Camera color="#3B82F6" size={28} strokeWidth={2.5} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Face Recognition</Text>
                <Text style={styles.methodSubtitle}>Quick and contactless</Text>
              </View>
            </View>
            <ChevronRight color="#9CA3AF" size={24} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={toggleRememberMyChoice}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberMyChoice }}
          accessibilityLabel="Remember my choice"
        >
          <View style={[styles.checkbox, rememberMyChoice && styles.checkboxChecked]}>
            {rememberMyChoice && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
          </View>
          <Text style={styles.checkboxText}>Remember my choice</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "web" ? 12 : 8,
    paddingBottom: Platform.OS === "web" ? 40 : 32,
    alignItems: "center",
  },
  stepIndicator: {
    width: "100%",
    marginBottom: Platform.OS === "web" ? 16 : 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#121358",
    borderRadius: 2,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepLabelActive: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#121358",
  },
  iconContainer: {
    marginBottom: Platform.OS === "web" ? 16 : 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: Platform.OS === "web" ? 22 : 20,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: Platform.OS === "web" ? 16 : 12,
    lineHeight: 22,
  },
  methodsContainer: {
    width: "100%",
    marginBottom: 12,
    minHeight: 156,
    justifyContent: "flex-start",
    overflow: "visible" as const,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    marginBottom: 10,
    flex: 0,
    minHeight: 68,
  },
  methodCardBlue: {
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
  },
  methodCardPink: {
    backgroundColor: "#FCE7F3",
    borderColor: "#FBCFE8",
  },
  methodCardSelected: {
    borderColor: "#121358",
  },
  methodCardPressed: {
    opacity: Platform.OS === "web" ? 0.8 : 0.7,
    transform: Platform.OS === "web" ? [{ scale: 0.98 }] : [],
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  methodIconBlue: {
    backgroundColor: "#DBEAFE",
  },
  methodIconPink: {
    backgroundColor: "#FBCFE8",
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
  },
  methodSubtitle: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#6B7280",
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    width: "100%",
    justifyContent: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#121358",
    borderColor: "#121358",
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#6B7280",
  },
});
