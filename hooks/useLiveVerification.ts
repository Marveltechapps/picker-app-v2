/**
 * useLiveVerification Hook
 * 
 * Simplified real-time face verification using expo-camera (same as Face Recognition)
 * Features:
 * - Auto-opens front camera
 * - Real-time face detection (same as Face Recognition)
 * - Instant verification on face detection (no quality checks)
 * - Same camera stack as Face Recognition for consistency
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Platform } from 'react-native';
import faceRecognitionService, { type FaceFeature } from '@/services/faceRecognition.service';
import type { FaceDetectionStatus } from '@/types/faceVerification';

export interface UseLiveVerificationOptions {
  /** Called when face detection status changes */
  onStatusChange?: (status: FaceDetectionStatus) => void;
  /** Called when verification succeeds */
  onVerified?: () => void;
  /** Called when verification fails */
  onVerifyFailed?: (error: string) => void;
}

export interface UseLiveVerificationReturn {
  /** Camera permissions */
  permission: ReturnType<typeof useCameraPermissions>[0];
  /** Request camera permission */
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
  /** Camera view ref */
  cameraRef: React.RefObject<CameraView | null>;
  /** Current face detection status */
  status: FaceDetectionStatus;
  /** Whether verification succeeded */
  isVerified: boolean;
  /** Error message if any */
  error: string | null;
  /** Face detection handler (to be passed to CameraView onFacesDetected) */
  handleFacesDetected: (result: { faces: FaceFeature[]; image?: { width: number; height: number } }) => void;
  /** Reset verification state */
  reset: () => void;
  /** Get face detector settings (same as Face Recognition) */
  getFaceDetectorSettings: () => any;
}

export function useLiveVerification(options: UseLiveVerificationOptions = {}): UseLiveVerificationReturn {
  const {
    onStatusChange,
    onVerified,
    onVerifyFailed,
  } = options;

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [status, setStatus] = useState<FaceDetectionStatus>({
    faceDetected: false,
    hatDetected: false,
    sunglassesDetected: false,
    maskDetected: false,
    lightingScore: 0.3,
    faceCentered: false,
    faceBounds: null,
  });
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const verificationTriggered = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  const onVerifiedRef = useRef(onVerified);
  const onVerifyFailedRef = useRef(onVerifyFailed);

  // Update callback refs
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onVerifiedRef.current = onVerified;
    onVerifyFailedRef.current = onVerifyFailed;
  }, [onStatusChange, onVerified, onVerifyFailed]);

  // Track mount state
  useEffect(() => {
    mounted.current = true;
    verificationTriggered.current = false;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Handle face detection - SIMPLIFIED: instant verify on face detected
   * Rule: if (faces.length > 0) → VERIFIED immediately
   */
  const handleFacesDetected = useCallback(
    ({ faces, image }: { faces: FaceFeature[]; image?: { width: number; height: number } }) => {
      if (!mounted.current || isVerified || verificationTriggered.current) {
        return;
      }

      // Skip face detection on web
      if (Platform.OS === 'web') {
        return;
      }
      
      // If face detection module not available, log warning but don't block
      if (!faceRecognitionService.isFaceDetectionAvailable()) {
        console.warn('[useLiveVerification] Face detection module not available, camera will still work');
        return;
      }

      // Get image dimensions from detection result or use defaults
      const imageWidth = image?.width || 720;
      const imageHeight = image?.height || 1280;

      const newStatus = faceRecognitionService.processFaceDetection(faces, imageWidth, imageHeight);
      setStatus(newStatus);
      onStatusChangeRef.current?.(newStatus);

      // SINGLE RULE: Any face detected → verified immediately. No conditions.
      if (faces.length > 0 && !verificationTriggered.current) {
        verificationTriggered.current = true;
        setError(null);
        // Trigger verification immediately - no delay
        setIsVerified(true);
        onVerifiedRef.current?.();
      }
    },
    [isVerified]
  );

  /**
   * Reset verification state
   */
  const reset = useCallback(() => {
    setIsVerified(false);
    setError(null);
    verificationTriggered.current = false;
    setStatus({
      faceDetected: false,
      hatDetected: false,
      sunglassesDetected: false,
      maskDetected: false,
      lightingScore: 0.3,
      faceCentered: false,
      faceBounds: null,
    });
  }, []);

  // Auto-request permission on mount
  useEffect(() => {
    if (!permission?.granted && mounted.current) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  /**
   * Get face detector settings (same as Face Recognition)
   */
  const getFaceDetectorSettings = useCallback(() => {
    const settings = faceRecognitionService.getFaceDetectorSettings();
    return settings || undefined;
  }, []);

  return {
    permission,
    requestPermission,
    cameraRef,
    status,
    isVerified,
    error,
    handleFacesDetected,
    reset,
    getFaceDetectorSettings,
  };
}
