import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Share } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import * as Clipboard from "expo-clipboard";
import { Copy, Hash, Check } from "lucide-react-native";
import PrimaryButton from "./PrimaryButton";

interface ShareOtpSheetProps {
  visible: boolean;
  onContinue: (otp: string) => void;
  onClose: () => void;
}

export default function ShareOtpSheet({ visible, onContinue, onClose }: ShareOtpSheetProps) {
  const [otp, setOtp] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    generateOtp();
  }, []);

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

  const handleShare = async () => {
    if (otp) {
      try {
        await Share.share({
          message: `Your verification OTP is: ${otp}`,
        });
      } catch (error) {
        console.error("Error sharing OTP:", error);
      }
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Share OTP with Manager" height="65%">
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Hash color="#8B5CF6" size={48} strokeWidth={2.5} />
          </View>

          <Text style={styles.title}>Your OTP Code</Text>
          <Text style={styles.subtitle}>Generate a secure OTP to verify your identity</Text>

          <View style={styles.otpContainer}>
            <Text style={styles.otpText}>{otp || "------"}</Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
              {copied ? (
                <>
                  <Check color="#10B981" size={20} strokeWidth={2} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextSuccess]}>Copied!</Text>
                </>
              ) : (
                <>
                  <Copy color="#6366F1" size={20} strokeWidth={2} />
                  <Text style={styles.actionButtonText}>Copy</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Text style={styles.shareIcon}>↗</Text>
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>

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

        <View style={styles.footer}>
          <PrimaryButton
            title="Continue to Device Collection"
            onPress={() => onContinue(otp)}
            disabled={!otp}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  otpText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#8B5CF6",
    letterSpacing: 8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
  },
  actionButtonTextSuccess: {
    color: "#10B981",
  },
  shareIcon: {
    fontSize: 20,
    color: "#6366F1",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    marginBottom: 24,
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
    paddingBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
});
