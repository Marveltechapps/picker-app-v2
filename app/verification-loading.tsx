import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, StatusBar, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Upload } from "lucide-react-native";

export default function VerificationLoadingScreen() {
  const router = useRouter();
  const [dotCount, setDotCount] = useState<number>(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);

    const timer = setTimeout(() => {
      router.replace("/success");
    }, 4000);

    return () => {
      pulseAnimation.stop();
      clearInterval(dotInterval);
      clearTimeout(timer);
    };
  }, [router, scaleAnim]);

  const dots = ".".repeat(dotCount);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconInner}>
            <Upload color="#8B5CF6" size={48} strokeWidth={2} />
          </View>
        </Animated.View>

        <Text style={styles.title}>Verifying Documents</Text>
        <Text style={styles.subtitle}>
          Please wait while we process{"\n"}your documents{dots}
        </Text>

        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, dotCount >= 1 && styles.dotActive]} />
          <View style={[styles.dot, dotCount >= 2 && styles.dotActive]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 3,
    borderColor: "#E9D5FF",
  },
  iconInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 6,
  },
  dotActive: {
    backgroundColor: "#8B5CF6",
  },
});
