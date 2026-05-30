import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TextInput, Animated, Platform } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import { AlertCircle } from "lucide-react-native";
import PrimaryButton from "./PrimaryButton";

interface EnterOtpSheetProps {
  visible: boolean;
  generatedOtp: string;
  onSuccess: () => void;
  onBack: () => void;
  onClose: () => void;
}

export default function EnterOtpSheet({ visible, generatedOtp, onSuccess, onBack, onClose }: EnterOtpSheetProps) {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string>("");
  const [attempts, setAttempts] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const handleVerify = () => {
    const enteredOtp = otp.join("");

    if (enteredOtp === generatedOtp) {
      setError("");
      onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setError("Too many attempts. Please contact support.");
      } else {
        setError("Invalid OTP. Please try again.");
      }
      
      shakeError();
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const isOtpComplete = otp.every(digit => digit !== "");

  return (
    <BottomSheetModal visible={visible} onClose={onClose} onBack={onBack} title="Enter Manager OTP" height="70%">
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>#</Text>
          </View>

          <Text style={styles.title}>Verify Manager OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit OTP provided by your manager to proceed
          </Text>

          <Animated.View 
            style={[
              styles.otpInputContainer,
              { transform: [{ translateX: shakeAnimation }] }
            ]}
          >
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  error && styles.otpInputError,
                  digit && styles.otpInputFilled,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </Animated.View>

          {error ? (
            <View style={styles.errorCard}>
              <AlertCircle color="#EF4444" size={20} strokeWidth={2} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>ℹ️</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Need Help?</Text>
              <Text style={styles.infoText}>
                If you don&apos;t have the OTP, please ask your supervisor for the verification code.
              </Text>
            </View>
          </View>

          <View style={styles.attemptsInfo}>
            <Text style={styles.attemptsText}>
              Attempts: {attempts}/3
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="Verify OTP"
            onPress={handleVerify}
            disabled={!isOtpComplete || attempts >= 3}
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
  iconText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#8B5CF6",
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
  otpInputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
  },
  otpInputFilled: {
    borderColor: "#8B5CF6",
    backgroundColor: "#F5F3FF",
  },
  otpInputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    marginBottom: 16,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
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
    color: "#1E40AF",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3B82F6",
    lineHeight: 18,
  },
  attemptsInfo: {
    alignItems: "center",
  },
  attemptsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
});
