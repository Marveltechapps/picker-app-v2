import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Text } from "react-native";
import type { FaceDetectionStatus } from "@/types/faceVerification";

export type { FaceDetectionStatus };

interface FaceDetectionCameraProps {
  onStatusChange: (status: FaceDetectionStatus) => void;
  onVerified?: () => void;
  onVerifyFailed?: (error: string) => void;
}

export default function FaceDetectionCamera({
  onStatusChange,
  onVerified,
}: FaceDetectionCameraProps) {
  const [pulseAnim] = useState(new Animated.Value(1));
  const onStatusChangeRef = useRef(onStatusChange);
  const onVerifiedRef = useRef(onVerified);
  const verificationTriggered = useRef(false);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onVerifiedRef.current = onVerified;
  }, [onStatusChange, onVerified]);

  // Web fallback: simulate face detection after delay (same behavior as before)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!verificationTriggered.current) {
        try {
          onStatusChangeRef.current({
            faceDetected: true,
            hatDetected: false,
            sunglassesDetected: false,
            maskDetected: false,
            lightingScore: 0.8,
            faceCentered: true,
            faceBounds: null,
          });
          
          // Trigger verification on web (simulated)
          if (onVerifiedRef.current) {
            verificationTriggered.current = true;
            setTimeout(() => {
              onVerifiedRef.current?.();
            }, 500);
          }
        } catch (_) {}
      }
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#000000",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
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
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderStyle: "solid",
  },
});
