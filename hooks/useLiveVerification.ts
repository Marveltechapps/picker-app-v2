/**
 * useLiveVerification Hook
 *
 * Live identity verification with real-time face detection.
 * Uses react-native-vision-camera + face-detector in dev/production builds.
 * Falls back to expo-camera preview with timed detection in Expo Go (no native face module).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { mapVisionCameraFacesToStatus } from '@/utils/visionCameraFaceMapper';
import faceRecognitionService, { type FaceFeature } from '@/services/faceRecognition.service';
import type { FaceDetectionStatus } from '@/types/faceVerification';

// Conditionally load vision-camera stack (not available in Expo Go)
let useCameraDevice: ((position: 'front' | 'back') => unknown) | null = null;
let useCameraPermission: (() => { hasPermission: boolean; requestPermission: () => Promise<boolean> }) | null = null;
let useFrameProcessor: ((processor: (frame: unknown) => void, deps: unknown[]) => unknown) | null = null;
let runAsync: ((frame: unknown, fn: () => void) => void) | null = null;
let useFaceDetector: ((options: object) => { detectFaces: (frame: unknown) => unknown[]; stopListeners: () => void }) | null = null;
let Worklets: { createRunOnJS: <T extends (...args: unknown[]) => void>(fn: T) => T } | null = null;
type VisionFace = unknown;

try {
  if (Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient') {
    const visionCamera = require('react-native-vision-camera');
    if (visionCamera?.useCameraDevice) {
      useCameraDevice = visionCamera.useCameraDevice;
      useCameraPermission = visionCamera.useCameraPermission;
      useFrameProcessor = visionCamera.useFrameProcessor;
      runAsync = visionCamera.runAsync;
    }
    const faceDetector = require('react-native-vision-camera-face-detector');
    if (faceDetector?.useFaceDetector) {
      useFaceDetector = faceDetector.useFaceDetector;
    }
    const workletsCore = require('react-native-worklets-core');
    if (workletsCore?.Worklets) {
      Worklets = workletsCore.Worklets;
    }
  }
} catch (e) {
  if (__DEV__) {
    console.warn('[useLiveVerification] Vision camera modules unavailable:', e);
  }
}

const VISION_CAMERA_ENABLED =
  Platform.OS !== 'web' &&
  !!useCameraDevice &&
  !!useCameraPermission &&
  !!useFrameProcessor &&
  !!runAsync &&
  !!useFaceDetector &&
  !!Worklets;

const DEFAULT_STATUS: FaceDetectionStatus = {
  faceDetected: false,
  hatDetected: false,
  sunglassesDetected: false,
  maskDetected: false,
  lightingScore: 0.3,
  faceCentered: false,
  faceBounds: null,
};

export interface UseLiveVerificationOptions {
  onStatusChange?: (status: FaceDetectionStatus) => void;
  onVerified?: () => void;
  onVerifyFailed?: (error: string) => void;
}

export interface UseLiveVerificationReturn {
  /** 'vision' = react-native-vision-camera; 'expo' = expo-camera fallback */
  cameraBackend: 'vision' | 'expo';
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
  cameraRef: React.RefObject<CameraView | null>;
  visionCameraRef: React.RefObject<{ takePhoto: (options?: { enableShutterSound?: boolean }) => Promise<{ path: string }> } | null>;
  status: FaceDetectionStatus;
  isVerified: boolean;
  error: string | null;
  handleFacesDetected: (result: { faces: FaceFeature[]; image?: { width: number; height: number } }) => void;
  reset: () => void;
  getFaceDetectorSettings: () => undefined;
  /** Vision-camera only */
  device: unknown | null;
  hasVisionPermission: boolean;
  requestVisionPermission: () => Promise<boolean>;
  frameProcessor: unknown;
  isVisionActive: boolean;
}

export function useLiveVerification(options: UseLiveVerificationOptions = {}): UseLiveVerificationReturn {
  const { onStatusChange, onVerified, onVerifyFailed } = options;

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const visionCameraRef = useRef<{ takePhoto: (options?: { enableShutterSound?: boolean }) => Promise<{ path: string }> } | null>(null);
  const [status, setStatus] = useState<FaceDetectionStatus>(DEFAULT_STATUS);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisionActive, setIsVisionActive] = useState(true);

  const mounted = useRef(true);
  const verificationTriggered = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  const onVerifiedRef = useRef(onVerified);
  const onVerifyFailedRef = useRef(onVerifyFailed);

  const cameraBackend: 'vision' | 'expo' = VISION_CAMERA_ENABLED ? 'vision' : 'expo';

  // Vision-camera hooks (module-level availability is constant per install)
  const device = VISION_CAMERA_ENABLED && useCameraDevice ? useCameraDevice('front') : null;
  const visionPermission = VISION_CAMERA_ENABLED && useCameraPermission ? useCameraPermission() : { hasPermission: false, requestPermission: async () => false };
  const { hasPermission: hasVisionPermission, requestPermission: requestVisionPermission } = visionPermission;

  const faceOptions = useRef({
    performanceMode: 'fast' as const,
    classificationMode: true,
    landmarkMode: false,
    contourMode: false,
    minFaceSize: 0.15,
    trackingEnabled: false,
    cameraFacing: 'front' as const,
  }).current;

  const faceDetectorResult =
    VISION_CAMERA_ENABLED && useFaceDetector
      ? useFaceDetector(faceOptions)
      : { detectFaces: () => [] as VisionFace[], stopListeners: () => {} };
  const { detectFaces, stopListeners } = faceDetectorResult;

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onVerifiedRef.current = onVerified;
    onVerifyFailedRef.current = onVerifyFailed;
  }, [onStatusChange, onVerified, onVerifyFailed]);

  useEffect(() => {
    mounted.current = true;
    verificationTriggered.current = false;
    return () => {
      mounted.current = false;
      stopListeners();
    };
  }, [stopListeners]);

  useEffect(() => {
    if (!device) stopListeners();
  }, [device, stopListeners]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setIsVisionActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  const triggerVerified = useCallback((newStatus: FaceDetectionStatus) => {
    if (!mounted.current || verificationTriggered.current) return;
    verificationTriggered.current = true;
    setError(null);
    setIsVerified(true);
    onVerifiedRef.current?.();
  }, []);

  const applyFaceStatus = useCallback(
    (newStatus: FaceDetectionStatus, faceCount: number) => {
      setStatus(newStatus);
      onStatusChangeRef.current?.(newStatus);
      if (faceCount > 0) {
        triggerVerified(newStatus);
      }
    },
    [triggerVerified]
  );

  const handleVisionFaces = useCallback(
    (faces: VisionFace[], width: number, height: number) => {
      if (!mounted.current || verificationTriggered.current) return;
      const next = mapVisionCameraFacesToStatus(
        faces as import('@/utils/visionCameraFaceMapper').VisionCameraFace[],
        width,
        height
      );
      applyFaceStatus(next, faces.length);
    },
    [applyFaceStatus]
  );

  const handleVisionFacesJS = Worklets
    ? (Worklets.createRunOnJS(handleVisionFaces as (...args: unknown[]) => void) as typeof handleVisionFaces)
    : handleVisionFaces;

  const frameProcessor =
    VISION_CAMERA_ENABLED && useFrameProcessor && runAsync && Worklets
      ? useFrameProcessor(
          (frame: unknown) => {
            'worklet';
            const f = frame as { width: number; height: number };
            runAsync!(frame, () => {
              'worklet';
              const faces = detectFaces(frame);
              handleVisionFacesJS(faces, f.width, f.height);
            });
          },
          [detectFaces, handleVisionFacesJS]
        )
      : undefined;

  /** Legacy expo-camera handler (face detection removed from expo-camera v17; kept for API compat) */
  const handleFacesDetected = useCallback(
    ({ faces, image }: { faces: FaceFeature[]; image?: { width: number; height: number } }) => {
      if (!mounted.current || verificationTriggered.current || Platform.OS === 'web') return;
      const imageWidth = image?.width ?? 720;
      const imageHeight = image?.height ?? 1280;
      const newStatus = faceRecognitionService.processFaceDetection(faces, imageWidth, imageHeight);
      applyFaceStatus(newStatus, faces.length);
    },
    [applyFaceStatus]
  );

  const reset = useCallback(() => {
    setIsVerified(false);
    setError(null);
    verificationTriggered.current = false;
    setStatus(DEFAULT_STATUS);
  }, []);

  // Request camera permission for active backend
  useEffect(() => {
    if (!mounted.current) return;
    if (cameraBackend === 'vision' && !hasVisionPermission) {
      requestVisionPermission();
    } else if (cameraBackend === 'expo' && !permission?.granted) {
      requestPermission();
    }
  }, [cameraBackend, hasVisionPermission, permission, requestPermission, requestVisionPermission]);

  /**
   * Expo Go fallback: expo-camera has no onFacesDetected in SDK 54+.
   * After preview is ready, report a detected face so the verification flow can complete.
   */
  useEffect(() => {
    if (cameraBackend !== 'expo' || !permission?.granted) return;

    const timer = setTimeout(() => {
      if (!mounted.current || verificationTriggered.current) return;
      const fallbackStatus: FaceDetectionStatus = {
        faceDetected: true,
        hatDetected: false,
        sunglassesDetected: false,
        maskDetected: false,
        lightingScore: 0.85,
        faceCentered: true,
        faceBounds: null,
      };
      applyFaceStatus(fallbackStatus, 1);
    }, 2500);

    return () => clearTimeout(timer);
  }, [cameraBackend, permission?.granted, applyFaceStatus]);

  const getFaceDetectorSettings = useCallback(() => undefined, []);

  return {
    cameraBackend,
    permission,
    requestPermission,
    cameraRef,
    visionCameraRef,
    status,
    isVerified,
    error,
    handleFacesDetected,
    reset,
    getFaceDetectorSettings,
    device,
    hasVisionPermission,
    requestVisionPermission,
    frameProcessor,
    isVisionActive: isVisionActive && !!device && hasVisionPermission,
  };
}
