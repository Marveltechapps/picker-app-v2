import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, StatusBar, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { Colors, Typography, Spacing } from "@/constants/theme";

const ICON_COLOR = "#5B4EFF";
const ICON_SIZE = 64;

export default function DocumentVerificationSuccessScreen() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.flex}>
        <View style={styles.center}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <CheckCircle2 color={ICON_COLOR} size={ICON_SIZE} strokeWidth={2} />
          </Animated.View>
          <Text style={styles.title}>Documents Verified!</Text>
          <Text style={styles.subtitle}>
            {"Your identity has been confirmed. You're ready for the next step."}
          </Text>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton title="Continue to Training" onPress={() => router.replace("/training")} />
          <Text style={styles.footerNote}>Your documents are securely stored</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  title: {
    marginTop: Spacing["2xl"],
    fontSize: Typography.fontSize["3xl"],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: "center",
    letterSpacing: Typography.letterSpacing.tight,
  },
  subtitle: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  bottom: {
    gap: Spacing.md,
  },
  footerNote: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray[500],
    textAlign: "center",
    ...(Platform.OS === "web"
      ? { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
});
