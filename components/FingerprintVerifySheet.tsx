import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform, ActivityIndicator } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import { Fingerprint, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import PrimaryButton from "./PrimaryButton";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { appNotify } from "@/utils/appNotify";

interface FingerprintVerifySheetProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
  onBack: () => void;
}

export default function FingerprintVerifySheet({ visible, onSuccess, onClose, onBack }: FingerprintVerifySheetProps) {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const scaleAnim = useState(new Animated.Value(1))[0];
  const successFiredRef = useRef(false);

  const {
    isAvailable,
    isChecking,
    biometricType,
    isAuthenticating,
    isAuthenticated,
    error: authError,
    authenticate,
    reset,
  } = useBiometricAuth({
    onSuccess: () => {
      if (successFiredRef.current) return;
      successFiredRef.current = true;
      if (__DEV__) console.log('[FingerprintVerify] Verified');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerified(true);
      setError(null);
      setTimeout(() => onSuccess(), 400);
    },
    onError: (err) => {
      // Don't show error for user cancellation
      if (!err.includes('cancelled')) {
        setError(err);
        appNotify.error(err, "Authentication Failed");
      }
    },
    promptMessage: "Authenticate with your biometric to verify your identity",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  // Sync authenticated state
  useEffect(() => {
    if (isAuthenticated && !verified) {
      setVerified(true);
    }
  }, [isAuthenticated, verified]);

  // Sync error state
  useEffect(() => {
    if (authError && !authError.includes('cancelled')) {
      setError(authError);
    }
  }, [authError]);

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

  // Auto-trigger once when sheet is ready (short delay so sheet is mounted and only one trigger)
  useEffect(() => {
    if (!visible || !isAvailable || verified || isAuthenticating || hasAutoTriggered || isChecking || successFiredRef.current) {
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      if (cancelled) return;
      setError(null);
      setHasAutoTriggered(true);
      authenticate().catch(() => {});
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [visible, isAvailable, verified, isAuthenticating, hasAutoTriggered, isChecking, authenticate]);

  useEffect(() => {
    if (!visible) {
      successFiredRef.current = false;
      reset();
      setVerified(false);
      setError(null);
      setHasAutoTriggered(false);
    }
  }, [visible, reset]);

  // Check availability on mount
  useEffect(() => {
    if (visible && !isAvailable) {
      // Only set error if biometric is actually unavailable (not just checking)
      if (biometricType && !biometricType.available) {
        setError(biometricType.error || "Fingerprint authentication is not available on this device. Please set up fingerprint in device settings.");
      }
    }
  }, [visible, isAvailable, biometricType]);

  const handleScan = () => {
    if (isAuthenticating || verified || successFiredRef.current) return;
    if (!isAvailable) {
      appNotify.info(
        biometricType.error || "Fingerprint authentication is not available. Please set up fingerprint in device settings.",
        "Fingerprint Not Available"
      );
      return;
    }
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    authenticate();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Fingerprint Scan" height="85%" onBack={onBack}>
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

          <Animated.View
            style={[
              styles.fingerprintContainer,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={[styles.fingerprintCircle, verified && styles.fingerprintCircleSuccess]}>
              <Fingerprint color={verified ? "#10B981" : "#121358"} size={100} strokeWidth={2} />
            </View>
            {isAuthenticating && (
              <View style={styles.progressRing}>
                <ActivityIndicator size="large" color="#121358" />
              </View>
            )}
          </Animated.View>

          {verified ? (
            <>
              <View style={styles.checkContainer}>
                <Check color="#10B981" size={40} strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>Fingerprint Verified!</Text>
              <Text style={styles.successSubtitle}>Identity confirmed successfully</Text>
            </>
          ) : isChecking ? (
            <>
              <ActivityIndicator size="large" color="#121358" style={styles.checkingSpinner} />
              <Text style={styles.title}>Checking...</Text>
              <Text style={styles.subtitle}>Verifying biometric availability</Text>
            </>
          ) : isAuthenticating ? (
            <>
              <Text style={styles.title}>Verifying...</Text>
              <Text style={styles.subtitle}>Place your finger on the sensor</Text>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>Place finger on sensor</Text>
              <Text style={styles.subtitle}>
                {isAvailable
                  ? 'Authentication will start automatically. Place your finger on the sensor when prompted.'
                  : 'Biometric authentication is not available'}
              </Text>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {!isAuthenticating && !verified && !isChecking && (
          <View style={styles.footer}>
            <PrimaryButton
              title="Scan Fingerprint"
              onPress={handleScan}
              disabled={!isAvailable || isAuthenticating}
            />
            {isAvailable && (
              <Text style={styles.helpText}>
                Place your finger on the sensor when ready
              </Text>
            )}
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
  fingerprintContainer: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    position: "relative",
  },
  fingerprintCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
  },
  fingerprintCircleSuccess: {
    backgroundColor: "#D1FAE5",
  },
  checkingSpinner: {
    marginBottom: 16,
  },
  progressRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressRingFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#121358",
    opacity: 0.3,
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
  progressTextContainer: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  progressText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#121358",
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
  helpText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#6B7280",
    textAlign: "center",
  },
});
