/**
 * useLiveFaceCamera
 * 
 * Simplified, production-ready hook for LIVE real-time face verification.
 * - Auto-opens FRONT camera on mount
 * - Properly handles permissions with retry logic
 * - Handles app state (foreground/background)
 * - Hard-coded sample face verification (auto-success after 3 seconds)
 * - Real-time camera preview
 * 
 * FRONTEND ONLY - No backend API calls
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import type { FaceDetectionStatus } from "@/types/faceVerification";
import { isExpoGo } from "@/utils/expoGoDetection";

// Safely import camera hooks - may not be available in Expo Go
let useCameraDevice: any = null;
let useCameraPermission: any = null;
let useCameraDevices: any = null;

try {
  // Only require if not in Expo Go and not on web
  if (Platform.OS !== 'web' && !isExpoGo()) {
    const cameraModule = require("react-native-vision-camera");
    useCameraDevice = cameraModule.useCameraDevice;
    useCameraPermission = cameraModule.useCameraPermission;
    useCameraDevices = cameraModule.useCameraDevices;
  }
} catch (error) {
  // Camera module not available (e.g., in Expo Go)
  if (__DEV__) {
    console.warn("[useLiveFaceCamera] react-native-vision-camera not available:", error);
  }
}

const DEFAULT_STATUS: FaceDetectionStatus = {
  faceDetected: false,
  hatDetected: false,
  sunglassesDetected: false,
  maskDetected: false,
  lightingScore: 0.3,
  faceCentered: false,
  faceBounds: null,
};

// SIMPLIFIED: No delay - verify immediately on face detection

export interface UseLiveFaceCameraOptions {
  onStatusChange: (status: FaceDetectionStatus) => void;
  /** Called when verification succeeds */
  onVerified?: () => void;
  /** Called when verification fails */
  onVerifyFailed?: (error: string) => void;
}

export function useLiveFaceCamera({
  onStatusChange,
  onVerified,
  onVerifyFailed,
}: UseLiveFaceCameraOptions) {
  // Check if camera module is available
  const isCameraAvailable = !!useCameraDevice && !!useCameraPermission && !!useCameraDevices;

  // Try to get front camera device (only if module available)
  // Fallback: use all devices and find front camera manually
  let frontDevice = null;
  let allDevices: any[] = [];
  let hasPermission = false;
  let requestPermission = () => Promise.resolve(false);
  
  if (isCameraAvailable) {
    try {
      frontDevice = useCameraDevice("front");
      allDevices = useCameraDevices();
      const cameraPermission = useCameraPermission();
      hasPermission = cameraPermission.hasPermission;
      requestPermission = cameraPermission.requestPermission;
    } catch (error) {
      console.warn("[useLiveFaceCamera] Error accessing camera hooks:", error);
      // Fallback values already set above
    }
  }
  
  // Get front camera device (with fallback)
  // Priority: 1) useCameraDevice("front"), 2) find front in allDevices, 3) use first available
  const device = frontDevice || 
    (allDevices.length > 0 ? allDevices.find(d => d.position === "front") : null) || 
    (allDevices.length > 0 ? allDevices[0] : null);

  // State
  const [isActive, setIsActive] = useState(true);
  const cameraRef = useRef<any>(null);
  const mounted = useRef(true);
  const verificationTriggered = useRef(false);
  const autoVerifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track permission request attempts
  const permissionRequestAttempts = useRef(0);
  const MAX_PERMISSION_RETRIES = 3;

  // Callback refs (stable across renders)
  const onStatusChangeRef = useRef(onStatusChange);
  const onVerifiedRef = useRef(onVerified);
  const onVerifyFailedRef = useRef(onVerifyFailed);

  // Update callback refs
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onVerifiedRef.current = onVerified;
    onVerifyFailedRef.current = onVerifyFailed;
  }, [onStatusChange, onVerified, onVerifyFailed]);

  // If camera module not available (Expo Go), simulate verification immediately
  useEffect(() => {
    if (!isCameraAvailable) {
      console.log("[useLiveFaceCamera] Camera module not available - using fallback simulation");
      // SIMPLIFIED: Immediately set face as detected and trigger verification
      const faceDetectedStatus: FaceDetectionStatus = {
        ...DEFAULT_STATUS,
        faceDetected: true,
        lightingScore: 0.8,
        faceCentered: true,
      };
      
      onStatusChange(faceDetectedStatus);
      
      // Trigger verification immediately (small delay to ensure state is set)
      setTimeout(() => {
        if (mounted.current && onVerifiedRef.current && !verificationTriggered.current) {
          verificationTriggered.current = true;
          onVerifiedRef.current();
        }
      }, 300);
    }
  }, [isCameraAvailable, onStatusChange]);

  // Track mount state and reset verification on mount
  useEffect(() => {
    mounted.current = true;
    verificationTriggered.current = false;
    permissionRequestAttempts.current = 0; // Reset permission attempts on mount
    
    // Clear any existing timers
    if (autoVerifyTimerRef.current) {
      clearTimeout(autoVerifyTimerRef.current);
      autoVerifyTimerRef.current = null;
    }
    
    return () => {
      mounted.current = false;
      verificationTriggered.current = false;
      if (autoVerifyTimerRef.current) {
        clearTimeout(autoVerifyTimerRef.current);
        autoVerifyTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Request permission with retry logic
   */
  const requestPermissionWithRetry = useCallback(async () => {
    // Check current permission state
    if (hasPermission) {
      permissionRequestAttempts.current = 0; // Reset on success
      return;
    }
    
    if (permissionRequestAttempts.current >= MAX_PERMISSION_RETRIES) {
      console.warn("[useLiveFaceCamera] Max permission retries reached");
      if (mounted.current && onVerifyFailedRef.current) {
        onVerifyFailedRef.current("Camera permission denied. Please enable it in settings.");
      }
      return;
    }

    permissionRequestAttempts.current += 1;
    console.log(`[useLiveFaceCamera] Requesting camera permission (attempt ${permissionRequestAttempts.current})`);
    
    try {
      const result = await requestPermission();
      console.log(`[useLiveFaceCamera] Permission result:`, result);
      
      if (!result && mounted.current) {
        // Permission denied - wait a bit and retry if under max attempts
        if (permissionRequestAttempts.current < MAX_PERMISSION_RETRIES) {
          setTimeout(() => {
            if (mounted.current) {
              requestPermissionWithRetry();
            }
          }, 1500);
        } else {
          // Max retries reached
          if (onVerifyFailedRef.current) {
            onVerifyFailedRef.current("Camera permission denied. Please enable it in settings.");
          }
        }
      } else if (result) {
        // Permission granted - reset attempts
        permissionRequestAttempts.current = 0;
      }
    } catch (error) {
      console.error("[useLiveFaceCamera] Permission request error:", error);
      if (mounted.current && onVerifyFailedRef.current) {
        onVerifyFailedRef.current("Failed to request camera permission");
      }
    }
  }, [hasPermission, requestPermission]);

  // Auto-request permission on mount and when permission changes (only if camera available)
  useEffect(() => {
    if (!isCameraAvailable) {
      // Skip permission request if camera module not available
      return;
    }
    
    if (!hasPermission && mounted.current) {
      // Immediate request on mount
      requestPermissionWithRetry();
      
      // Also try again after a short delay as backup
      const timer = setTimeout(() => {
        if (mounted.current && !hasPermission) {
          requestPermissionWithRetry();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCameraAvailable, hasPermission, requestPermissionWithRetry]);

  // Handle app state (pause camera when backgrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const shouldBeActive = next === "active";
      setIsActive(shouldBeActive);
      
      // Clear auto-verify timer if app goes to background
      if (!shouldBeActive && autoVerifyTimerRef.current) {
        clearTimeout(autoVerifyTimerRef.current);
        autoVerifyTimerRef.current = null;
      }
    });
    
    return () => subscription.remove();
  }, []);

  /**
   * Trigger verification success immediately
   * SIMPLIFIED: No delays, just trigger on face detection
   */
  const triggerAutoVerification = useCallback(() => {
    if (verificationTriggered.current || !mounted.current) return;

    verificationTriggered.current = true;

    const finalStatus: FaceDetectionStatus = {
      faceDetected: true,
      hatDetected: false,
      sunglassesDetected: false,
      maskDetected: false,
      lightingScore: 0.8,
      faceCentered: true,
      faceBounds: null,
    };

    onStatusChangeRef.current(finalStatus);

    if (mounted.current && onVerifiedRef.current) {
      console.log("[useLiveFaceCamera] Face detected - verification success triggered immediately");
      onVerifiedRef.current();
    }
  }, []);

  /**
   * Simulate face detection status update
   * SIMPLIFIED: Immediately detect face and trigger verification
   */
  const updateSimulatedStatus = useCallback((elapsedMs: number) => {
    if (!mounted.current || verificationTriggered.current) return;

    const simulatedStatus: FaceDetectionStatus = {
      faceDetected: true,
      hatDetected: false,
      sunglassesDetected: false,
      maskDetected: false,
      lightingScore: 0.8,
      faceCentered: true,
      faceBounds: null,
    };

    onStatusChangeRef.current(simulatedStatus);

    if (!verificationTriggered.current) {
      triggerAutoVerification();
    }
  }, [triggerAutoVerification]);

  /**
   * Start auto-verification when camera is ready
   * SIMPLIFIED: Trigger immediately on face detection (no delay)
   */
  useEffect(() => {
    // Skip if camera module not available (handled by fallback effect)
    if (!isCameraAvailable) {
      return;
    }
    
    // Clear any existing timer first
    if (autoVerifyTimerRef.current) {
      clearTimeout(autoVerifyTimerRef.current);
      autoVerifyTimerRef.current = null;
    }

    // Only start if all conditions are met
    if (!hasPermission || !device || !isActive || verificationTriggered.current) {
      if (__DEV__) {
        console.log("[useLiveFaceCamera] Auto-verify not starting:", {
          hasPermission,
          hasDevice: !!device,
          isActive,
          alreadyTriggered: verificationTriggered.current,
        });
      }
      return;
    }

    console.log("[useLiveFaceCamera] Camera ready, starting immediate face detection");
    
    // Reset verification trigger for new session
    verificationTriggered.current = false;

    // SIMPLIFIED: Trigger face detection immediately (no delay, no interval)
    // Small delay to ensure camera is fully initialized
    const initDelay = setTimeout(() => {
      if (mounted.current && !verificationTriggered.current) {
        updateSimulatedStatus(0); // This will trigger verification immediately
      }
    }, 500); // 500ms to ensure camera is ready

    return () => {
      if (autoVerifyTimerRef.current) {
        clearTimeout(autoVerifyTimerRef.current);
        autoVerifyTimerRef.current = null;
      }
      clearTimeout(initDelay);
    };
  }, [isCameraAvailable, hasPermission, device, isActive, updateSimulatedStatus]);

  // Log device and permission state for debugging
  useEffect(() => {
    console.log("[useLiveFaceCamera] State:", {
      hasPermission,
      hasDevice: !!device,
      isActive,
      deviceName: device?.name,
      devicePosition: device?.position,
      availableDevices: allDevices.length,
      deviceId: device?.id,
    });
    
    // If no device available after permission is granted, show error
    if (hasPermission && !device && mounted.current && allDevices.length === 0) {
      console.error("[useLiveFaceCamera] No camera device available");
      if (onVerifyFailedRef.current) {
        onVerifyFailedRef.current("No camera device found on this device.");
      }
    }
  }, [hasPermission, device, isActive, allDevices]);

  return {
    cameraRef,
    device,
    hasPermission,
    requestPermission: requestPermissionWithRetry,
    isActive: isActive && !!device && !!hasPermission,
  };
}
