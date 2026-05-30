import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, Animated, Platform } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";

export default function VerificationSuccessScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const scaleAnim = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim]);

  const handleContinue = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.replace("/training");
    }, 300);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.centerContent}>
          <Animated.View 
            style={[
              styles.iconCircle, 
              { 
                transform: [{ scale: scaleAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <CheckCircle2 color="#FFFFFF" size={64} strokeWidth={2.5} />
          </Animated.View>

          <Animated.View style={[styles.textContent, { opacity: fadeAnim }]}>
            <Text style={styles.title}>Verification Successful!</Text>
            <Text style={styles.subtitle}>
              Your identity has been{"\n"}successfully verified
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
          <PrimaryButton 
            title="Continue" 
            onPress={handleContinue} 
            loading={loading}
          />
        </Animated.View>
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
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    alignSelf: "center",
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 8px 16px rgba(16, 185, 129, 0.3)', elevation: 8 }
      : { shadowColor: "#10B981", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }
    ),
  },
  textContent: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: "center",
    width: "100%",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    width: "100%",
  },
  buttonContainer: {
    width: "100%",
    paddingTop: 20,
  },
});
