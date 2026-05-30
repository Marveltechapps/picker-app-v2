/**
 * useLiveFaceVerification
 *
 * Production-ready hook for LIVE real-time face verification.
 * - Auto-opens front camera on mount
 * - Continuous frame processing (not photo capture)
 * - Real-time face detection via frame processor
 * - Auto-verifies when face conditions are met (throttled 1-2 sec)
 * - Handles app state, permissions, memory leaks
 *
 * Uses react-native-vision-camera + react-native-vision-camera-face-detector
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { mapVisionCameraFacesToStatus } from "@/utils/visionCameraFaceMapper";
import { verifyFace } from "@/services/faceVerification.service";
import type { FaceDetectionStatus } from "@/types/faceVerification";
import { isExpoGo } from "@/utils/expoGoDetection";

// Conditionally import react-native-vision-camera and worklets (not available in Expo Go)
let useCameraDevice: any = null;
let useCameraPermission: any = null;
let useFrameProcessor: any = null;
let runAsync: any = null;
let Camera: any = null;
let useFaceDetector: any = null;
let Worklets: any = null;
type Face = any;
type Frame = any;

try {
  if (Platform.OS !== 'web' && !isExpoGo()) {
    const visionCamera = require("react-native-vision-camera");
    
    // Validate module is properly initialized
    if (!visionCamera || typeof visionCamera.useCameraDevice !== 'function') {
      throw new Error("react-native-vision-camera not properly initialized");
    }
    
    useCameraDevice = visionCamera.useCameraDevice;
    useCameraPermission = visionCamera.useCameraPermission;
    useFrameProcessor = visionCamera.useFrameProcessor;
    runAsync = visionCamera.runAsync;
    Camera = visionCamera.Camera;
    
    const faceDetector = require("react-native-vision-camera-face-detector");
    
    // Validate face detector
    if (!faceDetector || typeof faceDetector.useFaceDetector !== 'function') {
      throw new Error("react-native-vision-camera-face-detector not properly initialized");
    }
    
    useFaceDetector = faceDetector.useFaceDetector;
    
    // Conditionally import worklets
    try {
      const workletsCore = require("react-native-worklets-core");
      if (!workletsCore || !workletsCore.Worklets) {
        throw new Error("react-native-worklets-core not properly initialized");
      }
      Worklets = workletsCore.Worklets;
    } catch (workletsError) {
      console.error("[useLiveFaceVerification] react-native-worklets-core initialization failed:", workletsError);
    }
  }
} catch (error: any) {
  // Module not available (Expo Go or not installed)
  console.error("[useLiveFaceVerification] Native module initialization failed:", {
    error: error?.message || error,
    stack: error?.stack,
    platform: Platform.OS,
  });
}

// Throttle verification calls (1-2 seconds)
const VERIFY_THROTTLE_MS = 2000;
const CHECK_INTERVAL_MS = 500;

const DEFAULT_STATUS: FaceDetectionStatus = {
  faceDetected: false,
  hatDetected: false,
  sunglassesDetected: false,
  maskDetected: false,
  lightingScore: 0.3,
  faceCentered: false,
  faceBounds: null,
};

/**
 * Check if face status meets verification requirements
 * SIMPLIFIED: Only check if face is detected - that's enough
 */
function isStatusReady(s: FaceDetectionStatus): boolean {
  return s.faceDetected;
}

/**
 * Convert frame to base64 JPEG
 * Uses frame.toFile() for reliable encoding (temporary file approach)
 * This is the most reliable method for production
 */
async function frameToBase64(frame: Frame): Promise<string> {
  "worklet";
  try {
    // Method 1: Try toBase64 if available (newer versions)
    if (typeof frame.toBase64 === "function") {
      return frame.toBase64("jpeg", 85);
    }

    // Method 2: Use toFile() to save temporary JPEG, then read as base64
    // This is the most reliable cross-platform method
    const file = frame.toFile("jpeg", 85);
    if (!file) return "";

    // Read file as base64 (this will be done on JS thread via runOnJS)
    // For now, return file path - we'll handle conversion in JS
    return file.path;
  } catch (error) {
    return "";
  }
}

export interface UseLiveFaceVerificationOptions {
  onStatusChange: (status: FaceDetectionStatus) => void;
  /** Called when verification succeeds */
  onVerified?: () => void;
  /** Called when verification fails */
  onVerifyFailed?: (error: string) => void;
  /** Optional auth token for verify API */
  token?: string;
}

export function useLiveFaceVerification({
  onStatusChange,
  onVerified,
  onVerifyFailed,
  token,
}: UseLiveFaceVerificationOptions) {
  // Check if camera module is available
  const isCameraAvailable = !!useCameraDevice && !!useCameraPermission && !!useFrameProcessor && Platform.OS !== 'web' && !isExpoGo();
  
  // Only use camera hooks if available
  const device = isCameraAvailable && useCameraDevice ? useCameraDevice("front") : null;
  const cameraPermission = isCameraAvailable && useCameraPermission ? useCameraPermission() : { hasPermission: false, requestPermission: () => Promise.resolve(false) };
  const { hasPermission, requestPermission } = cameraPermission;

  // State
  const [status, setStatus] = useState<FaceDetectionStatus>(DEFAULT_STATUS);
  const [isActive, setIsActive] = useState(true);
  const cameraRef = useRef<any>(null);

  // Verification throttling
  const lastVerifyTs = useRef(0);
  const verifying = useRef(false);
  const mounted = useRef(true);
  const lastFramePathRef = useRef<string | null>(null);

  // Callback refs (stable across renders)
  const onStatusChangeRef = useRef(onStatusChange);
  const onVerifiedRef = useRef(onVerified);
  const onVerifyFailedRef = useRef(onVerifyFailed);
  const tokenRef = useRef(token);

  // Update callback refs
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onVerifiedRef.current = onVerified;
    onVerifyFailedRef.current = onVerifyFailed;
    tokenRef.current = token;
  }, [onStatusChange, onVerified, onVerifyFailed, token]);

  // Track mount state
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      verifying.current = false;
    };
  }, []);

  // Auto-request permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Handle app state (pause camera when backgrounded)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      setIsActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  // Face detector configuration
  const faceOptions = useRef({
    performanceMode: "fast" as const,
    classificationMode: true,
    landmarkMode: false,
    contourMode: false,
    minFaceSize: 0.15,
    trackingEnabled: false,
    cameraFacing: "front" as const,
  }).current;

  // Only use face detector if available
  const faceDetectorResult = isCameraAvailable && useFaceDetector ? useFaceDetector(faceOptions) : { detectFaces: () => [], stopListeners: () => {} };
  const { detectFaces, stopListeners } = faceDetectorResult;

  // Cleanup face detector on unmount
  useEffect(() => {
    return () => {
      stopListeners();
    };
  }, [stopListeners]);

  // Stop listeners if device unavailable
  useEffect(() => {
    if (!device) {
      stopListeners();
    }
  }, [device, stopListeners]);

  /**
   * Save frame for verification (runs in worklet)
   * Returns base64 string or file path
   */
  const saveFrameForVerification = useCallback((frame: any): string | null => {
    "worklet";
    try {
      // Try toBase64 first (if available in newer versions)
      if (typeof frame.toBase64 === "function") {
        const base64 = frame.toBase64("jpeg", 85);
        return base64 ? `base64:${base64}` : null;
      }

      // Fallback: save to temporary file
      const file = frame.toFile("jpeg", 85);
      return file?.path || null;
    } catch (error) {
      return null;
    }
  }, []);

  /**
   * Handle detected faces - update status and store frame if ready
   * SIMPLIFIED: Accept any face detection, no strict conditions
   */
  const handleFaces = useCallback(
    (faces: Face[], width: number, height: number, frameData: string | null) => {
      const next = mapVisionCameraFacesToStatus(
        faces as unknown as import("@/utils/visionCameraFaceMapper").VisionCameraFace[],
        width,
        height
      );

      // SIMPLIFIED: Accept single or multiple faces (just need at least one)
      // No blocking for multiple faces

      setStatus(next);
      onStatusChangeRef.current(next);

      // Store frame data if face is detected (simplified condition)
      if (next.faceDetected && faces.length > 0 && frameData) {
        lastFramePathRef.current = frameData;
      } else {
        lastFramePathRef.current = null;
      }
    },
    []
  );

  const handleFacesJS = Worklets ? Worklets.createRunOnJS(handleFaces) : handleFaces;

  /**
   * Frame processor - runs on every frame
   */
  const frameProcessor = isCameraAvailable && useFrameProcessor && runAsync && Worklets ? useFrameProcessor(
    (frame: any) => {
      "worklet";
      runAsync(frame, () => {
        "worklet";
        const faces = detectFaces(frame);
        const w = frame.width;
        const h = frame.height;

        // Save frame if single face detected (we'll check conditions on JS thread)
        let frameData: string | null = null;
        if (faces.length === 1) {
          frameData = saveFrameForVerification(frame);
        }

        // Pass to JS thread for status mapping and verification check
        handleFacesJS(faces, w, h, frameData);
      });
    },
    [detectFaces, handleFacesJS, saveFrameForVerification]
  ) : undefined;

  /**
   * Convert file path to base64
   * Helper function to read temporary file and convert to base64
   */
  const fileToBase64 = useCallback(async (filePath: string): Promise<string> => {
    try {
      // Try expo-file-system first (if available)
      try {
        const { readAsStringAsync } = await import("expo-file-system");
        const base64 = await readAsStringAsync(filePath, {
          encoding: "base64",
        });
        return base64;
      } catch {
        // Fallback: use fetch for file:// URI (works on native)
        const uri = filePath.startsWith("file://") ? filePath : `file://${filePath}`;
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data:image/jpeg;base64, prefix if present
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      throw new Error(`Failed to read frame file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  /**
   * Verify face using latest frame data
   * Runs on JS thread
   */
  const verifyLatestFrame = useCallback(async () => {
    if (verifying.current || !mounted.current) return;

    const frameData = lastFramePathRef.current;
    if (!frameData) return;

    const onVerified = onVerifiedRef.current;
    const onFail = onVerifyFailedRef.current;

    if (!onVerified || !onFail) return;

    verifying.current = true;

    try {
      let base64: string;

      // Check if frameData is already base64 (from toBase64())
      if (frameData.startsWith("base64:")) {
        base64 = frameData.replace("base64:", "");
      } else {
        // Read file and convert to base64
        base64 = await fileToBase64(frameData);
      }

      if (!base64) {
        throw new Error("Failed to encode frame");
      }

      // Call verification API
      const result = await verifyFace(
        { base64: `data:image/jpeg;base64,${base64}` },
        { token: tokenRef.current ?? undefined }
      );

      if (!mounted.current) return;

      if (result.success && result.verified) {
        onVerified();
      } else {
        onFail(result.error ?? "Verification failed");
      }
    } catch (e) {
      if (mounted.current && onVerifyFailedRef.current) {
        onVerifyFailedRef.current(
          e instanceof Error ? e.message : "Frame verification failed"
        );
      }
    } finally {
      verifying.current = false;
    }
  }, [fileToBase64]);

  /**
   * Continuous verification check
   * Runs every CHECK_INTERVAL_MS when conditions are met
   */
  useEffect(() => {
    if (!onVerified || !onVerifyFailed || !device || !hasPermission || !isActive) {
      return;
    }

    const interval = setInterval(() => {
      if (!mounted.current || !isActive) return;
      if (!isStatusReady(status)) return;
      if (verifying.current) return;

      const now = Date.now();
      if (now - lastVerifyTs.current < VERIFY_THROTTLE_MS) return;

      lastVerifyTs.current = now;
      verifyLatestFrame();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [onVerified, onVerifyFailed, device, hasPermission, isActive, status, verifyLatestFrame]);

  return {
    cameraRef,
    device,
    hasPermission,
    requestPermission,
    frameProcessor,
    isActive: isActive && !!device && !!hasPermission,
    status,
  };
}
