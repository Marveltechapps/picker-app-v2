/**
 * Native Error Handler for Production APK
 *
 * Catches unhandled promise rejections and native module errors
 * that can cause silent crashes in production builds.
 * In release APK, we log and avoid rethrowing to prevent forced exit where possible.
 */

import { Platform } from 'react-native';

// ErrorUtils may be undefined in minified/release or some React Native versions
let ErrorUtils: { getGlobalHandler?: () => (error: any, isFatal?: boolean) => void; setGlobalHandler?: (handler: (error: any, isFatal?: boolean) => void) => void } | undefined;
try {
  ErrorUtils = require('react-native').ErrorUtils;
} catch {
  ErrorUtils = undefined;
}
const originalHandler =
  ErrorUtils && typeof ErrorUtils.getGlobalHandler === 'function'
    ? ErrorUtils.getGlobalHandler()
    : null;

interface NativeError {
  message: string;
  stack?: string;
  name?: string;
  nativeStackAndroid?: string;
  cause?: unknown;
}

/**
 * Enhanced error handler for production
 */
function globalErrorHandler(error: NativeError, isFatal: boolean = false) {
  try {
    // Log error details for debugging
    console.error('[NativeErrorHandler] Fatal Error:', {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack,
      nativeStack: error?.nativeStackAndroid,
      isFatal,
      platform: Platform.OS,
      cause: error?.cause,
    });

    // Check for common native module errors
    const errorMessage = error?.message || '';
    const errorStack = error?.stack || '';

    // React Native Vision Camera errors
    if (
      errorMessage.includes('Camera') ||
      errorMessage.includes('vision-camera') ||
      errorStack.includes('com.mrousavy.camera')
    ) {
      console.error('[NativeErrorHandler] Camera module error detected');
    }

    // ML Kit Face Detection errors
    if (
      errorMessage.includes('MLKit') ||
      errorMessage.includes('FaceDetection') ||
      errorStack.includes('com.google.mlkit') ||
      errorStack.includes('com.infinitered')
    ) {
      console.error('[NativeErrorHandler] ML Kit Face Detection error detected');
    }

    // Worklets errors
    if (
      errorMessage.includes('Worklet') ||
      errorMessage.includes('worklets') ||
      errorStack.includes('com.worklets')
    ) {
      console.error('[NativeErrorHandler] Worklets error detected');
    }

    // Permission errors
    if (
      errorMessage.includes('Permission') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('denied')
    ) {
      console.error('[NativeErrorHandler] Permission error detected');
    }

    // In production APK, avoid calling originalHandler for non-fatal to reduce crash rate.
    // Original handler often triggers red box / crash; we already logged.
    if (originalHandler) {
      if (isFatal) {
        originalHandler(error, isFatal);
      } else {
        // Non-fatal: log only, do not rethrow/crash (keeps app responsive)
        try {
          originalHandler(error, false);
        } catch (_) {
          // Swallow to prevent double crash
        }
      }
    }
  } catch (handlerError) {
    // If error handler itself fails, log but do NOT rethrow (prevents cascade crash)
    try {
      console.error('[NativeErrorHandler] Error in error handler:', handlerError);
    } catch (_) {}
  }
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(reason: any, promise: Promise<any>) {
  console.error('[NativeErrorHandler] Unhandled Promise Rejection:', {
    reason,
    promise,
    platform: Platform.OS,
  });

  // Convert to Error if not already
  const error = reason instanceof Error 
    ? reason 
    : new Error(String(reason));

  globalErrorHandler(error as NativeError, false);
}

/**
 * Initialize native error handling
 * Call this in app entry point (app/_layout.tsx)
 */
export function setupNativeErrorHandling() {
  try {
    if (!ErrorUtils || typeof ErrorUtils.setGlobalHandler !== 'function') {
      return;
    }
    ErrorUtils.setGlobalHandler(globalErrorHandler);
  } catch (_) {
    // Silently fail in release if ErrorUtils is missing or minified
  }

  // Handle unhandled promise rejections
  if (typeof global !== 'undefined') {
    // Also listen for unhandledrejection event if available
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('unhandledrejection', (event: any) => {
        handleUnhandledRejection(event.reason, event.promise);
      });
    }
  }

  // Log initialization
  if (__DEV__) {
    console.log('[NativeErrorHandler] Native error handling initialized');
  }
}

/**
 * Safe wrapper for async native operations
 */
export async function safeNativeOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorContext?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`[NativeErrorHandler] Native operation failed${errorContext ? `: ${errorContext}` : ''}`, error);
    return fallback;
  }
}
