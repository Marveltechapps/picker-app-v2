import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, Animated, Platform } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Info } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import PrimaryButton from "@/components/PrimaryButton";

export default function SuccessScreen() {
  const router = useRouter();
  const { completeDocuments } = useAuth();
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
    await completeDocuments();
    setLoading(false);
    router.replace("/training");
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
            <Text style={styles.title}>Documents Submitted!</Text>
            <Text style={styles.subtitle}>
              Your documents have been{"\n"}successfully uploaded for verification
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Info color="#8B5CF6" size={20} strokeWidth={2} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>What&apos;s next?</Text>
                <Text style={styles.infoText}>
                  Complete your training videos to proceed
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
          <PrimaryButton 
            title="Continue to Training Videos" 
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
    marginBottom: 32,
    width: "100%",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#F5F3FF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    width: "100%",
    alignItems: "flex-start",
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    flexShrink: 0,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 20,
  },
  buttonContainer: {
    width: "100%",
    paddingTop: 20,
  },
});
