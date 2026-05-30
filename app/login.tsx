import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { sendOtp } from "@/services/auth.service";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";

export default function LoginPhoneScreen() {
  const router = useRouter();
  const colors = useColors();
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const isValidIndianNumber = (number: string): boolean => {
    const digits = (number ?? "").replace(/\D/g, "");
    if (digits.length !== 10) return false;
    const first = digits[0];
    return first >= "5" && first <= "9";
  };

  const handlePhoneChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, "");
    if (numeric.length <= 10) {
      setPhoneNumber(numeric);
    }
  };

  const handleSendOTP = async () => {
    if (!isValidIndianNumber(phoneNumber)) return;
    setLoading(true);
    try {
      const result = await sendOtp(phoneNumber);
      setLoading(false);
      if (result.success) {
        router.push({ pathname: "/otp", params: { phoneNumber } });
      } else {
        appNotify.error(result.error || result.message || "Failed to send OTP. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      appNotify.error("Failed to send OTP. Please try again.");
    }
  };

  const isValid = isValidIndianNumber(phoneNumber);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.card,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
    },
    inputSection: {
      marginTop: Spacing.xl,
      marginBottom: Spacing['2xl'],
    },
    label: {
      fontSize: Typography.fontSize['md-lg'],
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg + 2,
      fontSize: Typography.fontSize['lg-md'],
      fontWeight: Typography.fontWeight.medium,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    spacer: {
      flex: 1,
      minHeight: Spacing['4xl'],
    },
    termsContainer: {
      marginBottom: Spacing['2xl'],
    },
    termsText: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.regular,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: Typography.lineHeight.normal * Typography.fontSize.base,
    },
    termsLink: {
      color: colors.primary[650],
      fontWeight: Typography.fontWeight.semibold,
      textDecorationLine: "underline",
    },
    buttonContainer: {
      marginBottom: Spacing.xl,
    },
  }), [colors]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <Header 
        title="Sign in"
        subtitle="Enter your phone number"
        showBack={true}
      />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.content}>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="0000000000"
              placeholderTextColor={colors.gray[300]}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
            />
          </View>

          <View style={styles.spacer} />

          <View style={styles.buttonContainer}>
            <PrimaryButton 
              title="Send OTP" 
              onPress={handleSendOTP} 
              disabled={!isValid || loading}
              loading={loading}
            />
          </View>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{" "}
              <Text
                style={styles.termsLink}
                onPress={() => router.push("/terms-conditions")}
              >
                Terms & Conditions
              </Text>
              {"\n"}and{" "}
              <Text
                style={styles.termsLink}
                onPress={() => router.push("/privacy-policy")}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
