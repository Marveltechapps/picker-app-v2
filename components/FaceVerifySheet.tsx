import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform, ActivityIndicator, Dimensions } from "react-native";
import { CameraView } from "expo-camera";
import BottomSheetModal from "./BottomSheetModal";
import { Camera, Check, AlertTriangle } from "lucide-react-native";
import PrimaryButton from "./PrimaryButton";
import { useFaceRecognition, getFaceDetectorSettings } from "@/hooks/useFaceRecognition";
import * as Haptics from "expo-haptics";

function safeFaceDetectorSettings(): object | undefined {
  try {
    return getFaceDetectorSettings() ?? undefined;
  } catch {
    return undefined;
  }
}

// Safe import for CameraType - may not be available in Expo Go
let CameraType: any = null;
try {
  const cameraModule = require("expo-camera");
  CameraType = cameraModule.CameraType;
} catch (error) {
  // CameraType not available, use fallback
  if (__DEV__) {
    console.warn("[FaceVerifySheet] CameraType not available, using fallback");
  }
}

// Fallback camera type constant
const FRONT_CAMERA = CameraType?.front ?? 'front';

// Responsive camera frame size (fit screen, avoid overflow)
const getCameraFrameSize = () => {
  const { width: sw, height: sh } = Dimensions.get("window");
  const isSmall = sw < 400 || sh < 600;
  const maxW = Math.min(280, sw - 48);
  const frameW = isSmall ? maxW : 280;
  const frameH = Math.round(frameW * (360 / 280));
  return { width: frameW, height: frameH };
};

// Responsive spacing for small screens
const getResponsiveSpacing = () => {
  const { width: sw, height: sh } = Dimensions.get("window");
  const isSmall = sw < 400 || sh < 600;
  return {
    stepMarginBottom: isSmall ? 20 : 40,
    cameraMarginBottom: isSmall ? 20 : 32,
  };
};

interface FaceVerifySheetProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
  onBack: () => void;
}

export default function FaceVerifySheet({ visible, onSuccess, onClose, onBack }: FaceVerifySheetProps) {
  const [verified, setVerified] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];
  const successFiredRef = useRef(false);

  // Face Recognition ALWAYS uses camera (never device biometric)
  const {
    permission,
    requestPermission,
    cameraRef,
    status,
    isVerifying,
    isVerified,
    error,
    handleFacesDetected,
    verify,
    reset,
  } = useFaceRecognition({
    visible,
    requireConfirmation: false,
    onStatusChange: () => {},
    onVerified: () => {
      if (successFiredRef.current) return;
      successFiredRef.current = true;
      if (__DEV__) console.log('[FaceVerify] Verified');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerified(true);
      pulseAnim.stopAnimation();
      setTimeout(() => onSuccess(), 400);
    },
    onVerifyFailed: (err) => {
      // Removed failure alerts - verification happens automatically on face detection
      // No spam of failure messages
    },
  });

  // Sync verified state
  useEffect(() => {
    if (isVerified && !verified) {
      setVerified(true);
    }
  }, [isVerified, verified]);

  useEffect(() => {
    if (visible) {
      successFiredRef.current = false;
      if (!permission?.granted && permission?.canAskAgain !== false) {
        requestPermission().catch(() => {});
      }
      reset();
      setVerified(false);
    }
  // Only run when visibility toggles; avoid re-running on permission/reset ref changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reset when sheet closes
  useEffect(() => {
    if (!visible) {
      successFiredRef.current = false;
      reset();
      setVerified(false);
    }
  }, [visible, reset]);

  // Animate pulse when verifying
  useEffect(() => {
    if (isVerifying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [isVerifying, pulseAnim]);

  const frameSize = getCameraFrameSize();
  const CAMERA_FRAME_WIDTH = frameSize.width;
  const CAMERA_FRAME_HEIGHT = frameSize.height;
  const spacing = getResponsiveSpacing();

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Face Recognition" height="85%" scrollable onBack={onBack}>
      <View style={styles.container}>
        <View style={styles.demoBanner}>
          <AlertTriangle color="#B45309" size={16} />
          <Text style={styles.demoBannerText}>
            Demo Mode — Real verification will be enabled in production
          </Text>
        </View>
        <View style={styles.content}>
          <View style={[styles.stepIndicator, { marginBottom: spacing.stepMarginBottom }]}>
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
              <View style={[styles.cameraContainer, { marginBottom: spacing.cameraMarginBottom }]}>
                <View style={[styles.cameraPlaceholder, { width: CAMERA_FRAME_WIDTH, height: CAMERA_FRAME_HEIGHT, borderRadius: CAMERA_FRAME_WIDTH / 2 }]}>
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
              <View style={[styles.cameraContainer, { marginBottom: spacing.cameraMarginBottom }]}>
                {!permission?.granted ? (
                  <View style={[styles.cameraPlaceholder, { width: CAMERA_FRAME_WIDTH, height: CAMERA_FRAME_HEIGHT, borderRadius: CAMERA_FRAME_WIDTH / 2 }]}>
                    {permission?.canAskAgain !== false ? (
                      <>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.permissionText}>Requesting camera permission...</Text>
                      </>
                    ) : (
                      <>
                        <Camera color="#6366F1" size={48} strokeWidth={2} />
                        <Text style={styles.permissionText}>Camera access required</Text>
                        <Text style={styles.permissionSubtext}>
                          Please enable camera permission in your device settings to use face recognition.
                        </Text>
                        <PrimaryButton
                          title="Request Permission"
                          onPress={requestPermission}
                          style={styles.permissionButton}
                        />
                      </>
                    )}
                  </View>
                ) : (
                  <Animated.View
                    style={[
                      styles.cameraFrame,
                      {
                        width: CAMERA_FRAME_WIDTH,
                        height: CAMERA_FRAME_HEIGHT,
                        borderRadius: CAMERA_FRAME_WIDTH / 2,
                      },
                      isVerifying && {
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  >
                    <CameraView
                      ref={cameraRef}
                      style={styles.camera}
                      facing={FRONT_CAMERA}
                      {...(safeFaceDetectorSettings()
                        ? { onFacesDetected: handleFacesDetected, faceDetectorSettings: safeFaceDetectorSettings() }
                        : {})}
                      enableTorch={false}
                    />
                    <View style={[styles.overlay, { borderRadius: CAMERA_FRAME_WIDTH / 2 }]} />
                    {status.faceBounds && !verified && (
                      <View
                        style={[
                          styles.faceBoundsOverlay,
                          {
                            left: status.faceBounds.x * CAMERA_FRAME_WIDTH,
                            top: status.faceBounds.y * CAMERA_FRAME_HEIGHT,
                            width: status.faceBounds.width * CAMERA_FRAME_WIDTH,
                            height: status.faceBounds.height * CAMERA_FRAME_HEIGHT,
                          },
                        ]}
                      />
                    )}
                    {status.faceDetected && !isVerifying && !verified && (
                      <View style={styles.faceDetectedIndicator}>
                        <Text style={styles.faceDetectedText}>✓ Face Detected</Text>
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>

              {verified ? (
                <>
                  <View style={styles.checkContainer}>
                    <Check color="#10B981" size={40} strokeWidth={3} />
                  </View>
                  <Text style={styles.successTitle}>Face Verified!</Text>
                  <Text style={styles.successSubtitle}>Identity confirmed successfully</Text>
                </>
              ) : isVerifying ? (
                <>
                  <Text style={styles.title}>Verifying...</Text>
                  <Text style={styles.subtitle}>Hold still — verification in progress</Text>
                </>
              ) : (
                <>
                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                  {permission?.granted && (
                    <>
                      <Text style={styles.title}>Identity verification</Text>
                      <Text style={styles.subtitle}>
                        Show your face in the frame to verify. No extra steps.
                      </Text>
                    </>
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
                if (successFiredRef.current) return;
                successFiredRef.current = true;
                setVerified(true);
                setTimeout(() => onSuccess(), 500);
              }}
            />
          </View>
        ) : !isVerifying && !verified && permission?.granted && (
          <View style={styles.footer}>
            <PrimaryButton
              title={status.faceDetected ? "Continue" : "Show your face in the frame"}
              onPress={verify}
              disabled={!!(safeFaceDetectorSettings() && !status.faceDetected)}
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
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  demoBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#92400E",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: "center",
  },
  stepIndicator: {
    width: "100%",
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
  cameraContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraFrame: {
    borderWidth: 4,
    borderColor: "#6366F1",
    backgroundColor: "#000000",
    overflow: "hidden",
    position: "relative",
  },
  camera: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: "transparent",
    pointerEvents: "none",
  },
  faceBoundsOverlay: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "rgba(16, 185, 129, 0.9)",
    borderRadius: 8,
    backgroundColor: "transparent",
    pointerEvents: "none",
  },
  faceDetectedIndicator: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  faceDetectedText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  cameraPlaceholder: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#6366F1",
  },
  permissionText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#111827",
    textAlign: "center",
  },
  permissionSubtext: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "400" as const,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: 20,
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
  conditionsCard: {
    marginTop: 24,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  conditionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  conditionText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#10B981",
  },
  conditionTextInactive: {
    color: "#9CA3AF",
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
});
