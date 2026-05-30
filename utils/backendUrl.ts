import Constants from "expo-constants";
import { Platform } from "react-native";

const PLACEHOLDER_API = "https://api.example.com";
const DEFAULT_PRODUCTION_ORIGIN = "https://api.selorg.com";
const DEFAULT_DEVELOPMENT_ORIGIN = "http://localhost:3333";
const PICKER_API_BASE_PATH = "/api/v1/picker";
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i;

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOST_PATTERN.test(hostname.trim());
}

function extractHostFromCandidate(candidate: unknown): string | null {
  if (typeof candidate !== "string" || !candidate.trim()) return null;

  const trimmedCandidate = candidate.trim();

  try {
    return new URL(trimmedCandidate).hostname;
  } catch {
    const withoutScheme = trimmedCandidate.replace(/^[a-z]+:\/\//i, "");
    const hostPort = withoutScheme.split("/")[0];
    const host = hostPort.split(":")[0];
    return host || null;
  }
}

function getExpoDevHost(): string | null {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    manifest?: { debuggerHost?: string };
    manifest2?: {
      extra?: {
        expoClient?: { hostUri?: string };
        expoGo?: { debuggerHost?: string };
      };
    };
  };

  const candidates = [
    constants.expoConfig?.hostUri,
    constants.manifest2?.extra?.expoClient?.hostUri,
    constants.manifest2?.extra?.expoGo?.debuggerHost,
    constants.manifest?.debuggerHost,
  ];

  for (const candidate of candidates) {
    const host = extractHostFromCandidate(candidate);
    if (host && !isLocalHostname(host)) {
      return host;
    }
  }

  return null;
}

function resolveLocalHostname(hostname: string): string {
  const expoDevHost = getExpoDevHost();
  if (expoDevHost) return expoDevHost;

  if (Platform.OS === "android") {
    return "10.0.2.2";
  }

  return hostname;
}

function normalizeDevOrigin(rawOrigin: string): string {
  try {
    const url = new URL(rawOrigin);
    if (__DEV__ && isLocalHostname(url.hostname)) {
      url.hostname = resolveLocalHostname(url.hostname);
    }
    return url.origin;
  } catch {
    return rawOrigin.replace(/\/$/, "");
  }
}

function normalizePickerApiBaseUrl(rawBaseUrl: string): string {
  const trimmedBaseUrl = rawBaseUrl.replace(/\/$/, "");

  if (trimmedBaseUrl.endsWith(PICKER_API_BASE_PATH)) {
    return trimmedBaseUrl;
  }

  if (trimmedBaseUrl.endsWith("/api/v1")) {
    return `${trimmedBaseUrl}/picker`;
  }

  return `${trimmedBaseUrl}${PICKER_API_BASE_PATH}`;
}

function shouldUseLocalBackendInDev(envUrl: string | undefined): boolean {
  if (typeof __DEV__ === "undefined" || !__DEV__ || !envUrl) return false;
  if (process.env.EXPO_PUBLIC_USE_PRODUCTION_API === "true") return false;
  try {
    const host = new URL(envUrl).hostname;
    return host === "api.selorg.com";
  } catch {
    return false;
  }
}

function getConfiguredOrigin(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.API_BASE_URL?.trim();
  const defaultOrigin =
    typeof __DEV__ !== "undefined" && __DEV__
      ? DEFAULT_DEVELOPMENT_ORIGIN
      : DEFAULT_PRODUCTION_ORIGIN;
  let configuredOrigin =
    envUrl && envUrl !== PLACEHOLDER_API ? envUrl : defaultOrigin;

  if (shouldUseLocalBackendInDev(envUrl)) {
    configuredOrigin = DEFAULT_DEVELOPMENT_ORIGIN;
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[API] Dev mode: EXPO_PUBLIC_API_URL points at api.selorg.com; using local backend instead.",
        "Set EXPO_PUBLIC_USE_PRODUCTION_API=true to call production."
      );
    }
  }

  return normalizeDevOrigin(configuredOrigin);
}

export function getBackendOrigin(): string {
  return getConfiguredOrigin();
}

export function getPickerApiBaseUrl(): string {
  return normalizePickerApiBaseUrl(getConfiguredOrigin());
}
