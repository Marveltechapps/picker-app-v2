import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import { Hash, Zap } from "lucide-react-native";
import PrimaryButton from "./PrimaryButton";
import * as Clipboard from "expo-clipboard";
import { Copy, Check } from "lucide-react-native";
import { Shadows } from "@/constants/theme";

interface GenerateOtpSheetProps {
  visible: boolean;
  onClose: () => void;
  onContinue: (otp: string) => void;
}

export default function GenerateOtpSheet({ visible, onClose, onContinue }: GenerateOtpSheetProps) {
  const [otp, setOtp] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const generateOtp = () => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(newOtp);
  };

  const handleCopy = async () => {
    if (otp) {
      await Clipboard.setStringAsync(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContinue = () => {
    if (otp) {
      onContinue(otp);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Share OTP with Manager" height="70%">
      <View style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Hash color="#8B5CF6" size={48} strokeWidth={2.5} />
            </View>

            <Text style={styles.title}>Share OTP with Manager</Text>
            <Text style={styles.subtitle}>Generate a secure OTP to verify your identity</Text>

            {otp ? (
              <>
                <View style={styles.otpContainer}>
                  <Text style={styles.otpText}>{otp}</Text>
                </View>

                <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                  {copied ? (
                    <>
                      <Check color="#10B981" size={20} strokeWidth={2} />
                      <Text style={[styles.copyButtonText, styles.copyButtonTextSuccess]}>Copied!</Text>
                    </>
                  ) : (
                    <>
                      <Copy color="#6366F1" size={20} strokeWidth={2} />
                      <Text style={styles.copyButtonText}>Copy OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>Your OTP will appear here</Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>ℹ️</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Next Step</Text>
                <Text style={styles.infoText}>
                  Show this OTP to your supervisor to verify your identity and proceed to device collection.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {otp ? (
            <PrimaryButton
              title="Continue"
              onPress={handleContinue}
            />
          ) : (
            <TouchableOpacity style={styles.generateButton} onPress={generateOtp}>
              <Zap color="#FFFFFF" size={20} strokeWidth={2.5} />
              <Text style={styles.generateButtonText}>Generate OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  otpContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 32,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    borderStyle: "dashed",
  },
  otpText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#8B5CF6",
    letterSpacing: 8,
  },
  placeholderContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 32,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#9CA3AF",
    textAlign: "center",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
  },
  copyButtonTextSuccess: {
    color: "#10B981",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    marginBottom: 16,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoIconText: {
    fontSize: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D97706",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#F59E0B",
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    marginTop: 8,
  },
  generateButton: {
    backgroundColor: "#5B4EFF",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 12px rgba(91, 78, 255, 0.3)", elevation: 4 }
      : { ...Shadows.lg, shadowColor: "#5B4EFF", shadowOpacity: 0.3 }),
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});

