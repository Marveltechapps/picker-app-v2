import React, { useState, useEffect } from "react";
import { View, StyleSheet, Animated, Platform, Text, ActivityIndicator, Dimensions } from "react-native";
import { CameraView } from "expo-camera";
import { useLiveVerification } from "@/hooks/useLiveVerification";
import type { FaceDetectionStatus } from "@/types/faceVerification";

// Safe import for CameraType - may not be available in Expo Go
let CameraType: any = null;
try {
  const cameraModule = require("expo-camera");
  CameraType = cameraModule.CameraType;
} catch (error) {
  if (__DEV__) {
    console.warn("[FaceDetectionCamera] CameraType not available, using fallback");
  }
}

// Fallback camera type constant
const FRONT_CAMERA = CameraType?.front ?? 'front';

export type { FaceDetectionStatus };

interface FaceDetectionCameraProps {
  onStatusChange: (status: FaceDetectionStatus) => void;
  onVerified?: () => void;
  onVerifyFailed?: (error: string) => void;
}

export default function FaceDetectionCamera({
  onStatusChange,
  onVerified,
  onVerifyFailed,
}: FaceDetectionCameraProps) {
  const [pulseAnim] = useState(new Animated.Value(1));

  // Use Live Verification hook (expo-camera + real face detection, same as Face Recognition)
  const {
    permission,
    requestPermission,
    cameraRef,
    status,
    handleFacesDetected,
    getFaceDetectorSettings,
  } = useLiveVerification({
    onStatusChange,
    onVerified,
    onVerifyFailed,
  });

  // Pulse animation for oval overlay
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Web fallback - same as Face Recognition
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>Camera Preview</Text>
          <Text style={styles.fallbackSubtext}>
            Face verification requires a native device. Please use the mobile app.
          </Text>
        </View>
        <Animated.View style={[styles.ovalOverlay, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.ovalBorder} />
        </Animated.View>
      </View>
    );
  }

  // Show loading state while waiting for permission
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.fallbackSubtext}>Requesting camera permission...</Text>
        </View>
        <Animated.View style={[styles.ovalOverlay, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.ovalBorder} />
        </Animated.View>
      </View>
    );
  }

  // Safe face detector settings (undefined in Expo Go / SDK 51+ - don't pass to avoid crash)
  const faceDetectorSettings = (() => {
    try {
      return getFaceDetectorSettings() ?? undefined;
    } catch {
      return undefined;
    }
  })();

  // Render real-time camera; only pass face detection props when settings exist (Expo Go safe)
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={FRONT_CAMERA}
        {...(faceDetectorSettings
          ? { onFacesDetected: handleFacesDetected, faceDetectorSettings }
          : {})}
      />
      <Animated.View style={[styles.ovalOverlay, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.ovalBorder} />
      </Animated.View>
    </View>
  );
}

// Safely get screen dimensions (may not be available in Expo Go initially)
const getScreenDimensions = () => {
  try {
    const { width } = Dimensions.get("window");
    return { width, isMobile: Platform.OS !== 'web' && width < 768 };
  } catch (error) {
    // Fallback if Dimensions not available
    return { width: 375, isMobile: true };
  }
};

const { width: SCREEN_WIDTH, isMobile } = getScreenDimensions();

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#000000",
    borderRadius: isMobile ? 16 : 24, // Smaller border radius on mobile
    overflow: "hidden",
    position: "relative",
    maxHeight: isMobile ? SCREEN_WIDTH * 1.2 : undefined, // Limit height on mobile
  },
  camera: {
    flex: 1,
  },
  ovalOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "75%",
    aspectRatio: 3 / 4,
    marginLeft: "-37.5%",
    marginTop: "-37.5%",
    alignItems: "center",
    justifyContent: "center",
  },
  ovalBorder: {
    width: "100%",
    height: "100%",
    borderRadius: 9999,
    borderWidth: isMobile ? 3 : 4, // Thinner border on mobile
    borderColor: "#FFFFFF",
    borderStyle: "solid",
  },
  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
    padding: 20,
  },
  fallbackText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  fallbackSubtext: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  fallbackHint: {
    color: "#6366F1",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
