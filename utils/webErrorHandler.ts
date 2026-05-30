/**
 * Web-specific error handlers
 * Suppresses known non-critical errors on web platform
 */

import { Platform } from 'react-native';

/**
 * Suppress blob URL errors (ERR_FILE_NOT_FOUND)
 * These occur when blob URLs are revoked before they can be loaded
 */
export function setupWebErrorSuppression() {
  if (Platform.OS !== 'web') return;

  // Helper function to check if error should be suppressed
  const shouldSuppressError = (errorStr: string): boolean => {
    // UUID pattern (8-4-4-4-12 format) - blob URLs often use UUIDs
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    
    // Suppress blob URL errors (including UUID-based blob URLs)
    if (
      (errorStr.includes('blob:') || uuidPattern.test(errorStr)) &&
      (errorStr.includes('ERR_FILE_NOT_FOUND') ||
       errorStr.includes('Failed to load resource') ||
       errorStr.includes('net::ERR_FILE_NOT_FOUND'))
    ) {
      return true;
    }
    
    // Suppress errors that are just UUIDs with ERR_FILE_NOT_FOUND
    if (
      uuidPattern.test(errorStr) &&
      (errorStr.includes('ERR_FILE_NOT_FOUND') ||
       errorStr.includes('Failed to load resource'))
    ) {
      return true;
    }
    
    // Suppress touch tracking errors
    if (
      errorStr.includes('Cannot record touch end without a touch start') ||
      errorStr.includes('Touch End') ||
      errorStr.includes('Touch Bank') ||
      errorStr.includes('touch end without a touch start')
    ) {
      return true;
    }
    
    // Suppress pointerEvents deprecation warning from react-native-web
    if (
      errorStr.includes('props.pointerEvents is deprecated') ||
      errorStr.includes('Use style.pointerEvents') ||
      errorStr.includes('pointerEvents is deprecated')
    ) {
      return true;
    }

    // Suppress errors from browser extensions (not from this app)
    // - CSS Peeper: csspeeper-inspector-tools, "Ad unit initialization failed", payload TypeError
    // - Give Freely: giveFreely.tsx – "Cannot read properties of undefined (reading 'payload')" (unhandled promise)
    if (
      errorStr.includes('csspeeper-inspector-tools') ||
      errorStr.includes('csspeeper') ||
      errorStr.includes('giveFreely') ||
      errorStr.includes('Ad unit initialization failed') ||
      errorStr.includes('inspector-tools')
    ) {
      return true;
    }
    // Extension "payload" TypeError often appears without script name in message; app's .payload usage is guarded
    if (errorStr.includes("reading 'payload'")) {
      return true;
    }

    // Chrome "Intervention" messages (slow network, deferred font loading from extensions)
    if (
      errorStr.includes('[Intervention]') ||
      errorStr.includes('Slow network is detected') ||
      errorStr.includes('chromestatus.com/feature/5636954674692096') ||
      (errorStr.includes('chrome-extension://') && (errorStr.includes('fonts/') || errorStr.includes('.ttf') || errorStr.includes('.otf')))
    ) {
      return true;
    }

    return false;
  };

  // Suppress blob URL errors and DevTools messages in console.error
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args.map(arg => String(arg || '')).join(' ');
    
    if (shouldSuppressError(errorMessage)) {
      return;
    }
    // Suppress React Native DevTools Hermes message (informational when no native app connected or on web)
    if (
      errorMessage.includes('No compatible apps connected') ||
      errorMessage.includes('React Native DevTools can only be used with Hermes') ||
      errorMessage.includes('using-hermes')
    ) {
      return;
    }
    
    originalError.apply(console, args);
  };

  // Suppress blob URL errors in console.warn (sometimes errors are logged as warnings)
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const errorMessage = args.map(arg => String(arg || '')).join(' ');
    
    // Suppress React / React Native DevTools messages (informational, not app errors)
    if (
      errorMessage.includes('Download the React DevTools') ||
      errorMessage.includes('react.dev/link/react-devtools') ||
      errorMessage.includes('Development-level warnings: ON') ||
      errorMessage.includes('Performance optimizations: OFF') ||
      errorMessage.includes('No compatible apps connected') ||
      errorMessage.includes('React Native DevTools can only be used with Hermes') ||
      errorMessage.includes('docs.expo.dev/guides/using-hermes')
    ) {
      return; // Silently ignore DevTools messages
    }
    
    if (shouldSuppressError(errorMessage)) {
      // Silently ignore
      return;
    }
    
    // Call original warn handler for other warnings
    originalWarn.apply(console, args);
  };

  // Suppress blob URL errors in global error handler
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const errorStr = String(message || '') + ' ' + String(source || '');
    
    if (shouldSuppressError(errorStr)) {
      return true; // Prevent default error handling
    }
    
    // Call original error handler for other errors
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Suppress unhandled promise rejections for blob URLs and browser-extension errors.
  // Use addEventListener so we don't overwrite React/Expo or other handlers.
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorStr =
      reason instanceof Error
        ? (reason.message + " " + (reason.stack || ""))
        : String(reason || "");

    if (shouldSuppressError(errorStr)) {
      event.preventDefault();
    }
  });

  // Suppress global error events (e.g. resource load failures) for blob/extension noise.
  // Use a single capture-phase listener instead of patching addEventListener.
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('error', (event: ErrorEvent) => {
      const errorStr =
        String(event.message || '') +
        ' ' +
        String(event.filename || '') +
        ' ' +
        String((event.target && (event.target as any).src) || '');
      if (shouldSuppressError(errorStr)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  // Suppress resource loading errors globally (catch errors from all elements)
  if (typeof document !== 'undefined') {
    // Add global error listener for resource loading failures
    document.addEventListener('error', (event: Event) => {
      const target = event.target as any;
      if (target) {
        const src = target.src || target.href || '';
        const errorStr = String(src) + ' ' + String(event.type || '');
        
        if (shouldSuppressError(errorStr)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }, true); // Use capture phase to catch early
  }
}
