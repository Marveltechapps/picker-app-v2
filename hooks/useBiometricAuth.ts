/**
 * useBiometricAuth Hook
 *
 * Real device biometric authentication. Optimized for Expo Go:
 * - Uses preloaded cache when available (instant isAvailable)
 * - No double rAF delay; runs check immediately
 * - Proper async handling (no await in onPress path)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import biometricService, { type BiometricType } from '@/services/biometric.service';
import { getCachedBiometric } from '@/utils/verificationPreload';

export interface UseBiometricAuthOptions {
  /** Called when authentication succeeds */
  onSuccess?: () => void;
  /** Called when authentication fails */
  onError?: (error: string) => void;
  /** Prompt message for authentication */
  promptMessage?: string;
  /** Cancel label */
  cancelLabel?: string;
  /** Disable device fallback (passcode) */
  disableDeviceFallback?: boolean;
}

export interface UseBiometricAuthReturn {
  /** Whether biometric hardware is available */
  isAvailable: boolean;
  /** Whether availability check is in progress (avoids UI flash / shows loading) */
  isChecking: boolean;
  /** Biometric type (fingerprint, facial, etc.) */
  biometricType: BiometricType;
  /** Whether authentication is in progress */
  isAuthenticating: boolean;
  /** Whether authentication was successful */
  isAuthenticated: boolean;
  /** Error message if any */
  error: string | null;
  /** Check hardware support */
  checkAvailability: () => Promise<void>;
  /** Start authentication */
  authenticate: () => Promise<void>;
  /** Reset authentication state */
  reset: () => void;
}

export function useBiometricAuth(options: UseBiometricAuthOptions = {}): UseBiometricAuthReturn {
  const {
    onSuccess,
    onError,
    promptMessage = 'Authenticate to continue',
    cancelLabel = 'Cancel',
    disableDeviceFallback = false,
  } = options;

  // Use cached result for instant isAvailable when preload ran
  const cached = getCachedBiometric();
  const [isAvailable, setIsAvailable] = useState(cached?.available ?? false);
  const [isChecking, setIsChecking] = useState(!cached);
  const [biometricType, setBiometricType] = useState<BiometricType>(
    cached ?? { available: false, type: 'none' }
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update callback refs
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  // Track mount state
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Check biometric availability (runs off main thread via native bridge)
   */
  const checkAvailability = useCallback(async () => {
    try {
      setIsChecking(true);
      setError(null);
      const result = await biometricService.checkHardwareSupport();

      if (mounted.current) {
        setBiometricType(result);
        setIsAvailable(result.available);
        if (!result.available && result.error) {
          setError(result.error);
        } else {
          setError(null);
        }
      }
    } catch (err) {
      console.error('[useBiometricAuth] Error checking availability:', err);
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to check biometric availability');
        setIsAvailable(false);
      }
    } finally {
      if (mounted.current) {
        setIsChecking(false);
      }
    }
  }, []);

  /**
   * Perform biometric authentication
   */
  const authenticate = useCallback(async () => {
    if (isAuthenticating || isAuthenticated) {
      return;
    }

    try {
      if (__DEV__) console.log('[useBiometricAuth] Authenticate starting');
      setIsAuthenticating(true);
      setError(null);

      // First check availability
      if (!isAvailable) {
        await checkAvailability();
        
        if (!isAvailable) {
          const errorMsg = biometricType.error || 'Biometric authentication not available';
          setError(errorMsg);
          if (onErrorRef.current) {
            onErrorRef.current(errorMsg);
          }
          setIsAuthenticating(false);
          return;
        }
      }

      const result = await biometricService.authenticate({
        promptMessage,
        cancelLabel,
        disableDeviceFallback,
        skipHardwareCheck: isAvailable,
      });

      if (mounted.current) {
        setIsAuthenticating(false);

        if (result.success) {
          setIsAuthenticated(true);
          setError(null);
          
          // Call success callback
          if (onSuccessRef.current) {
            onSuccessRef.current();
          }
        } else {
          setIsAuthenticated(false);
          setError(result.error || 'Authentication failed');
          
          // Call error callback (but not for user cancellation)
          if (result.error && !result.error.includes('cancelled') && onErrorRef.current) {
            onErrorRef.current(result.error);
          }
        }
      }
    } catch (err) {
      console.error('[useBiometricAuth] Authentication error:', err);
      if (mounted.current) {
        setIsAuthenticating(false);
        setIsAuthenticated(false);
        const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMsg);
        
        if (onErrorRef.current) {
          onErrorRef.current(errorMsg);
        }
      }
    }
  }, [
    isAuthenticating,
    isAuthenticated,
    isAvailable,
    biometricType,
    promptMessage,
    cancelLabel,
    disableDeviceFallback,
    checkAvailability,
  ]);

  /**
   * Reset authentication state
   */
  const reset = useCallback(() => {
    setIsAuthenticated(false);
    setIsAuthenticating(false);
    setError(null);
  }, []);

  // Run check immediately (no rAF delay). Skip if cache hit from preload.
  useEffect(() => {
    if (cached) return;
    const id = setTimeout(() => checkAvailability().catch(() => {}), 0);
    return () => clearTimeout(id);
  }, [checkAvailability, cached]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Reset authentication state when app comes to foreground
      // (biometric auth is typically cancelled when app goes to background)
      if (nextAppState === 'active' && isAuthenticating) {
        setIsAuthenticating(false);
      }
    });

    return () => subscription.remove();
  }, [isAuthenticating]);

  return {
    isAvailable,
    isChecking,
    biometricType,
    isAuthenticating,
    isAuthenticated,
    error,
    checkAvailability,
    authenticate,
    reset,
  };
}
