/**
 * Biometric Service
 * 
 * Real device biometric authentication using expo-local-authentication
 * Supports:
 * - Fingerprint (Android)
 * - Face ID / Touch ID (iOS)
 * - Hardware availability checks
 * - Enrollment status checks
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricType {
  available: boolean;
  type: 'fingerprint' | 'facial' | 'iris' | 'none';
  error?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
}

class BiometricService {
  /**
   * Check if biometric hardware is available on the device
   */
  async checkHardwareSupport(): Promise<BiometricType> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      
      if (!compatible) {
        return {
          available: false,
          type: 'none',
          error: 'Biometric authentication is not available on this device.',
        };
      }

      // Check enrolled biometrics
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!enrolled) {
        return {
          available: false,
          type: 'none',
          error: 'No biometrics enrolled. Please set up fingerprint or face ID in device settings.',
        };
      }

      // Get supported authentication types
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      let biometricType: 'fingerprint' | 'facial' | 'iris' | 'none' = 'none';
      
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }

      return {
        available: true,
        type: biometricType,
      };
    } catch (error) {
      console.error('[BiometricService] Error checking hardware support:', error);
      return {
        available: false,
        type: 'none',
        error: error instanceof Error ? error.message : 'Unknown error checking biometric support',
      };
    }
  }

  /**
   * Authenticate using biometrics
   * @param options - Authentication options
   * @param options.skipHardwareCheck - When true, skip re-check (caller already verified); faster response.
   */
  async authenticate(options?: {
    promptMessage?: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
    fallbackLabel?: string;
    skipHardwareCheck?: boolean;
  }): Promise<BiometricAuthResult> {
    try {
      if (!options?.skipHardwareCheck) {
        const hardwareCheck = await this.checkHardwareSupport();
        if (!hardwareCheck.available) {
          return {
            success: false,
            error: hardwareCheck.error || 'Biometric authentication not available',
          };
        }
      }

      // Configure authentication options
      const authOptions: LocalAuthentication.LocalAuthenticationOptions = {
        promptMessage: options?.promptMessage || 'Authenticate to continue',
        cancelLabel: options?.cancelLabel || 'Cancel',
        disableDeviceFallback: options?.disableDeviceFallback ?? false,
        fallbackLabel: options?.fallbackLabel || 'Use Passcode',
      };

      // Perform authentication
      const result = await LocalAuthentication.authenticateAsync(authOptions);

      if (result.success) {
        return {
          success: true,
        };
      } else {
        // Handle different error cases
        let errorMessage = 'Authentication failed';
        
        if (result.error === 'user_cancel') {
          errorMessage = 'Authentication cancelled by user';
        } else if (result.error === 'user_fallback') {
          errorMessage = 'User chose to use fallback authentication';
        } else if (result.error === 'system_cancel') {
          errorMessage = 'Authentication cancelled by system';
        } else if (result.error === 'passcode_not_set') {
          errorMessage = 'No passcode set on device. Please set up device security.';
        } else if (result.error === 'not_available') {
          errorMessage = 'Biometric authentication is not available';
        } else if (result.error === 'not_enrolled') {
          errorMessage = 'No biometrics enrolled. Please set up fingerprint or face ID.';
        } else if (result.error) {
          errorMessage = `Authentication error: ${result.error}`;
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      console.error('[BiometricService] Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error',
      };
    }
  }

  /**
   * Check if device has biometrics enrolled
   */
  async isEnrolled(): Promise<boolean> {
    try {
      return await LocalAuthentication.isEnrolledAsync();
    } catch (error) {
      console.error('[BiometricService] Error checking enrollment:', error);
      return false;
    }
  }

  /**
   * Get human-readable biometric type name
   */
  getBiometricTypeName(type: 'fingerprint' | 'facial' | 'iris' | 'none'): string {
    switch (type) {
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'facial':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'iris':
        return 'Iris';
      default:
        return 'Biometric';
    }
  }
}

export default new BiometricService();
