/**
 * Utility to detect if the app is running in Expo Go
 * 
 * Expo Go does not support:
 * - react-native-vision-camera
 * - @infinitered/react-native-mlkit-face-detection
 * - react-native-vision-camera-face-detector
 * - Custom native modules
 * 
 * Use this utility to conditionally enable/disable features that require dev client.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Check if the app is running in Expo Go
 * @returns true if running in Expo Go, false otherwise
 * 
 * IMPORTANT: When uncertain, returns true (assume Expo Go) to avoid loading
 * unsupported native modules (react-native-maps, vision-camera) that crash Expo Go.
 */
export function isExpoGo(): boolean {
  // On web, never Expo Go
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    if (typeof Constants === 'undefined') {
      // Constants not ready: assume Expo Go (safe - avoids native module crashes)
      return true;
    }

    // 'storeClient' = Expo Go (SDK 50+)
    if (Constants.executionEnvironment === 'storeClient') {
      return true;
    }

    // appOwnership === 'expo' = Expo Go (legacy)
    if (Constants.appOwnership === 'expo') {
      return true;
    }

    // Explicitly standalone or bare = dev/production build, NOT Expo Go
    if (Constants.executionEnvironment === 'standalone' || Constants.executionEnvironment === 'bare') {
      return false;
    }

    // Unknown: assume Expo Go (safe default for compatibility)
    return true;
  } catch {
    // Error reading Constants: assume Expo Go (safe - prevents native module load)
    return true;
  }
}

/**
 * Check if a native module is available
 * Use this to safely check if a module that requires dev client is available
 */
export function isNativeModuleAvailable(moduleName: string): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  if (isExpoGo()) {
    // In Expo Go, only Expo modules are available
    // Check if it's an Expo module (starts with 'expo-')
    return moduleName.startsWith('expo-');
  }

  // In dev client or standalone, all modules should be available
  return true;
}
