/**
 * Verification Preload — warm camera & biometric modules early.
 * When IdentityVerifySheet is visible, preload runs so Face/Fingerprint sheets open fast.
 * Avoids cold-start delays in Expo Go.
 */

import { Platform } from 'react-native';
import type { BiometricType } from '@/services/biometric.service';

let biometricCache: BiometricType | null = null;
let cameraWarmed = false;
let preloadStarted = false;

/** Fire-and-forget preload. Call when IdentityVerifySheet becomes visible. */
export function preloadVerification(): void {
  if (Platform.OS === 'web') return;
  if (preloadStarted) return;
  preloadStarted = true;

  if (__DEV__) {
    console.log('[VerificationPreload] Starting camera + biometric warm-up');
  }

  // Warm camera module (async, non-blocking)
  import("expo-camera")
    .then((m) => {
      const mod = m as {
        getCameraPermissionsAsync?: () => Promise<unknown>;
        requestCameraPermissionsAsync?: () => Promise<unknown>;
      };
      return mod.getCameraPermissionsAsync?.() ?? mod.requestCameraPermissionsAsync?.() ?? Promise.resolve();
    })
    .then(() => {
      cameraWarmed = true;
      if (__DEV__) console.log('[VerificationPreload] Camera module warmed');
    })
    .catch(() => {});

  // Warm biometric module + cache result
  import('@/services/biometric.service')
    .then(({ default: biometricService }) => biometricService.checkHardwareSupport())
    .then((result) => {
      biometricCache = result;
      if (__DEV__) console.log('[VerificationPreload] Biometric checked:', result.available ? result.type : result.error);
    })
    .catch(() => {});
}

/** Get cached biometric result for instant use (avoids re-check in Fingerprint sheet). */
export function getCachedBiometric(): BiometricType | null {
  return biometricCache;
}

/** Whether camera module has been warmed. */
export function isCameraWarmed(): boolean {
  return cameraWarmed;
}
