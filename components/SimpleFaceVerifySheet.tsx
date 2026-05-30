/**
 * Simple Face Verification Sheet
 * 
 * Uses expo-local-authentication for face unlock (works on basic Android versions)
 * This is simpler and more compatible than camera-based face detection
 */

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Platform, ActivityIndicator } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import { Camera, Check } from "lucide-react-native";
import PrimaryButton from "./PrimaryButton";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import * as Haptics from "expo-haptics";
import { appNotify } from "@/utils/appNotify";

interface SimpleFaceVerifySheetProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
  onBack: () => void;
}

export default function SimpleFaceVerifySheet({ visible, onSuccess, onClose, onBack }: SimpleFaceVerifySheetProps) {
  const [verified, setVerified] = useState(false);
  const scaleAnim = useState(new Animated.Value(1))[0];

  // Use biometric auth (works with face unlock on Android/iOS)
  const {
    isAvailable,
    biometricType,
    isAuthenticating,
    isAuthenticated,
    error: authError,
    authenticate,
    reset,
  } = useBiometricAuth({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerified(true);
      setTimeout(() => {
        onSuccess();
      }, 800);
    },
    onError: (err) => {
      if (!err.includes('cancelled')) {
        appNotify.error(err, "Verification Failed");
      }
    },
    promptMessage: "Use Face ID to verify your identity",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  // Sync authenticated state
  useEffect(() => {
    if (isAuthenticated && !verified) {
      setVerified(true);
    }
  }, [isAuthenticated, verified]);

  // Animate on authentication start
  useEffect(() => {
    if (isAuthenticating) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isAuthenticating, scaleAnim]);

  // Reset when sheet closes
  useEffect(() => {
    if (!visible) {
      reset();
      setVerified(false);
    }
  }, [visible, reset]);

  const handleAuthenticate = async () => {
    if (!isAvailable) {
      appNotify.info(
        "Face unlock is not available on this device. Please set up Face ID in device settings.",
        "Face ID Not Available"
      );
      return;
    }
    await authenticate();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Face Verification" height="85%" onBack={onBack}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.stepIndicator}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: "100%" }]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={styles.stepLabelActive}>Step 2 of 2</Text>
              <Text style={styles.stepLabelActive}>Identity Verification</Text>
            </View>
          </View>

          {Platform.OS === 'web' ? (
            <>
              <View style={styles.faceContainer}>
                <View style={styles.facePlaceholder}>
                  <Camera color="#6366F1" size={48} strokeWidth={2} />
                </View>
              </View>
              <Text style={styles.title}>Face Verification Not Available</Text>
              <Text style={styles.subtitle}>
                Face verification requires a native device. Please use the mobile app.
              </Text>
            </>
          ) : (
            <>
              <Animated.View
                style={[
                  styles.faceContainer,
                  {
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                <View style={[styles.faceCircle, verified && styles.faceCircleSuccess]}>
                  <Camera color={verified ? "#10B981" : "#6366F1"} size={80} strokeWidth={2} />
                </View>
                {isAuthenticating && (
                  <View style={styles.progressRing}>
                    <ActivityIndicator size="large" color="#6366F1" />
                  </View>
                )}
              </Animated.View>

              {verified ? (
                <>
                  <View style={styles.checkContainer}>
                    <Check color="#10B981" size={40} strokeWidth={3} />
                  </View>
                  <Text style={styles.successTitle}>Face Verified!</Text>
                  <Text style={styles.successSubtitle}>Identity confirmed successfully</Text>
                </>
              ) : isAuthenticating ? (
                <>
                  <Text style={styles.title}>Verifying...</Text>
                  <Text style={styles.subtitle}>
                    {biometricType.type === 'facial' 
                      ? 'Look at your device to authenticate' 
                      : 'Use your device biometric to authenticate'}
                  </Text>
                  {authError && !authError.includes('cancelled') && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.title}>
                    {biometricType.type === 'facial' 
                      ? 'Use Face ID to verify' 
                      : 'Use Biometric to verify'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isAvailable 
                      ? `Tap the button to authenticate with ${biometricType.type === 'facial' ? 'Face ID' : 'your biometric'}`
                      : 'Face unlock is not available. Please set up Face ID in device settings.'}
                  </Text>
                  {authError && !authError.includes('cancelled') && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{authError}</Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.footer}>
            <PrimaryButton 
              title="Skip Verification (Demo)" 
              onPress={() => {
                setVerified(true);
                setTimeout(() => onSuccess(), 500);
              }}
            />
          </View>
        ) : !isAuthenticating && !verified && (
          <View style={styles.footer}>
            <PrimaryButton 
              title={biometricType.type === 'facial' ? 'Authenticate with Face ID' : 'Authenticate'} 
              onPress={handleAuthenticate}
              disabled={!isAvailable}
            />
          </View>
        )}
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
    alignItems: "center",
  },
  stepIndicator: {
    width: "100%",
    marginBottom: 40,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 2,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepLabelActive: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#6366F1",
  },
  faceContainer: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    position: "relative",
  },
  faceCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  faceCircleSuccess: {
    backgroundColor: "#D1FAE5",
  },
  facePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#6366F1",
  },
  progressRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  checkContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#10B981",
    marginBottom: 8,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#6B7280",
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  errorContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#DC2626",
    textAlign: "center",
  },
});
