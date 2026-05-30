/**
 * Utility to validate and sanitize image URIs for web compatibility
 * Prevents ERR_FILE_NOT_FOUND errors on web platform
 */

import { Platform } from "react-native";

import { getBackendOrigin } from "@/utils/backendUrl";

/**
 * UUID pattern (8-4-4-4-12 format)
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if URI is valid for the current platform
 */
export function isValidImageUri(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== "string") return false;

  // Reject bare UUIDs (no protocol, no path, just UUID)
  // Example: "8b2939fe-6206-44ec-9aff-2c979434cbb7"
  if (UUID_PATTERN.test(uri.trim())) {
    if (__DEV__) {
      console.warn('[imageUriValidator] Rejected bare UUID:', uri);
    }
    return false;
  }

  // On web, file:// URIs don't work
  if (Platform.OS === "web") {
    // Reject file:// protocol
    if (uri.startsWith("file://")) {
      return false;
    }
    
    // Reject Windows absolute paths (C:\, D:\, etc.)
    if (uri.match(/^[A-Za-z]:\\/)) {
      return false;
    }
    
    // Reject bare UUIDs or invalid paths that look like file system paths
    // But allow web-relative paths starting with /
    if (uri.startsWith("/")) {
      // Allow web asset paths
      if (uri.startsWith("/assets/") || 
          uri.startsWith("/static/") || 
          uri.startsWith("/_expo/") ||
          uri.startsWith("/images/")) {
        return true;
      }
      // Reject if it looks like a local file path (has file extension but no web context)
      if (uri.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) && !uri.includes("/assets") && !uri.includes("/static")) {
        // This might be a local file path, reject it
        return false;
      }
    }

    // Reject strings that look like UUIDs with slashes or other invalid formats
    // Example: "8b2939fe-6206-44ec-9aff-2c979434cbb7:1" or similar
    if (uri.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) && 
        !uri.startsWith("http") && 
        !uri.startsWith("data") && 
        !uri.startsWith("blob") &&
        !uri.startsWith("/")) {
      if (__DEV__) {
        console.warn('[imageUriValidator] Rejected UUID-like string without valid protocol:', uri);
      }
      return false;
    }
  }

  // Must be a valid URL format (http, https, data, blob, or valid relative path)
  const validProtocols = ["http://", "https://", "data:", "blob:"];
  const hasValidProtocol = validProtocols.some(protocol => uri.startsWith(protocol));
  
  // Allow relative paths that start with / (web assets)
  const isRelativeWebPath = Platform.OS === "web" && uri.startsWith("/");
  
  // Allow protocol-relative URLs (//example.com/image.jpg)
  const isProtocolRelative = uri.startsWith("//");
  
  // On native platforms, allow file:// and content:// URIs
  const isNativeFileUri = Platform.OS !== "web" && (uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("ph://"));
  
  return hasValidProtocol || isRelativeWebPath || isProtocolRelative || isNativeFileUri;
}

/**
 * Get a safe image source object
 * Returns null if URI is invalid
 */
export function getSafeImageSource(uri: string | null | undefined): { uri: string } | null {
  if (!uri || typeof uri !== "string") return null;

  // If it's a relative path from the backend, prepend the base URL (if needed, though normally the backend should provide absolute URLs).
  // For simplicity, we just allow anything that looks like a URL or a path.
  let safeUri = uri;
  if (uri.startsWith("/uploads/")) {
    const baseUrl = getBackendOrigin();
    safeUri = `${baseUrl}${uri}`;
  }

  if (!isValidImageUri(safeUri)) {
    // Attempt one more fallback for generic paths if it starts with a slash
    if (safeUri.startsWith("/")) {
      const baseUrl = getBackendOrigin();
      return { uri: `${baseUrl}${safeUri}` };
    }
    return null;
  }
  return { uri: safeUri };
}
