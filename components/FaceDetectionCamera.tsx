import React, { useState, useEffect } from "react";
import { View, StyleSheet, Animated, Platform, Text, ActivityIndicator, Dimensions } from "react-native";
import { CameraView, type CameraType } from "expo-camera";
import { useLiveVerification } from "@/hooks/useLiveVerification";
import type { FaceDetectionStatus } from "@/types/faceVerification";

// Safe import for CameraType enum - may not be available in Expo Go
let cameraTypeEnum: { front?: string } | null = null;
try {
  const cameraModule = require("expo-camera");
  cameraTypeEnum = cameraModule.CameraType;
} catch {
  if (__DEV__) {
    console.warn("[FaceDetectionCamera] CameraType not available, using fallback");
  }
}

const FRONT_CAMERA: CameraType = (cameraTypeEnum?.front ?? "front") as CameraType;

// Vision Camera (dev/production builds only)
let VisionCamera: React.ComponentType<{
  ref?: React.Ref<unknown>;
  style?: object;
  device: unknown;
  isActive?: boolean;
  photo?: boolean;
  frameProcessor?: unknown;
}> | null = null;

try {
  if (Platform.OS !== "web") {
    VisionCamera = require("react-native-vision-camera").Camera;
  }
} catch {
  VisionCamera = null;
}

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

  const {
    cameraBackend,
    permission,
    cameraRef,
    visionCameraRef,
    device,
    hasVisionPermission,
    frameProcessor,
    isVisionActive,
    handleFacesDetected,
    getFaceDetectorSettings,
  } = useLiveVerification({
    onStatusChange,
    onVerified,
    onVerifyFailed,
  });

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

  const ovalOverlay = (
    <Animated.View style={[styles.ovalOverlay, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.ovalBorder} />
    </Animated.View>
  );

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>Camera Preview</Text>
          <Text style={styles.fallbackSubtext}>
            Face verification requires a native device. Please use the mobile app.
          </Text>
        </View>
        {ovalOverlay}
      </View>
    );
  }

  // Vision-camera path (real face detection via frame processor)
  if (cameraBackend === "vision") {
    if (!VisionCamera || !device) {
      return (
        <View style={styles.container}>
          <View style={styles.fallbackContainer}>
            <ActivityIndicator size="large" color="#121358" />
            <Text style={styles.fallbackSubtext}>Starting camera...</Text>
          </View>
          {ovalOverlay}
        </View>
      );
    }

    if (!hasVisionPermission) {
      return (
        <View style={styles.container}>
          <View style={styles.fallbackContainer}>
            <ActivityIndicator size="large" color="#121358" />
            <Text style={styles.fallbackSubtext}>Requesting camera permission...</Text>
          </View>
          {ovalOverlay}
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <VisionCamera
          ref={visionCameraRef as React.Ref<unknown>}
          style={styles.camera}
          device={device}
          isActive={isVisionActive}
          photo
          frameProcessor={frameProcessor}
        />
        {ovalOverlay}
      </View>
    );
  }

  // Expo-camera fallback (Expo Go — no native face detector)
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackContainer}>
          <ActivityIndicator size="large" color="#121358" />
          <Text style={styles.fallbackSubtext}>Requesting camera permission...</Text>
        </View>
        {ovalOverlay}
      </View>
    );
  }

  const faceDetectorSettings = (() => {
    try {
      return getFaceDetectorSettings() ?? undefined;
    } catch {
      return undefined;
    }
  })();

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
      {ovalOverlay}
    </View>
  );
}

const getScreenDimensions = () => {
  try {
    const { width } = Dimensions.get("window");
    return { width, isMobile: Platform.OS !== "web" && width < 768 };
  } catch {
    return { width: 375, isMobile: true };
  }
};

const { width: SCREEN_WIDTH, isMobile } = getScreenDimensions();

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#000000",
    borderRadius: isMobile ? 16 : 24,
    overflow: "hidden",
    position: "relative",
    maxHeight: isMobile ? SCREEN_WIDTH * 1.2 : undefined,
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
    borderWidth: isMobile ? 3 : 4,
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
});
