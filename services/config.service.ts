/**
 * Picker Config Service
 * Fetches app config from backend (dashboard-managed). Caches with TTL in AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, ApiClientError } from "@/utils/apiClient";

export interface PickerConfig {
  basePayPerHour: number;
  overtimeMultiplier: number;
  currency: string;
  shiftGeoRadiusKm: number;
  walkInBufferMinutes: number;
  defaultShiftDurationHours: number;
  documentMaxSizeBytes: number;
  documentMinDimensionPx: number;
  documentAllowedExtensions: string[];
  heartbeatIntervalMs: number;
  websocketTimeoutMs?: number;
  websocketReconnectionAttempts?: number;
  websocketReconnectionDelayMs?: number;
  websocketReconnectionDelayMaxMs?: number;
  defaultHubName?: string;
}

const DEFAULTS: PickerConfig = {
  basePayPerHour: 100,
  overtimeMultiplier: 1.25,
  currency: "INR",
  shiftGeoRadiusKm: 3,
  walkInBufferMinutes: 15,
  defaultShiftDurationHours: 8,
  documentMaxSizeBytes: 10 * 1024 * 1024,
  documentMinDimensionPx: 200,
  documentAllowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
  heartbeatIntervalMs: 30 * 1000,
};

const CONFIG_CACHE_KEY = "picker_config_cache";
const CONFIG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** In-memory fallback when AsyncStorage unavailable */
let cachedConfig: PickerConfig | null = null;
let cacheExpiry = 0;

function mergeWithDefaults(data: Partial<PickerConfig> | null): PickerConfig {
  if (!data || typeof data !== "object") return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    ...data,
    documentAllowedExtensions:
      Array.isArray(data.documentAllowedExtensions) && data.documentAllowedExtensions.length > 0
        ? data.documentAllowedExtensions
        : DEFAULTS.documentAllowedExtensions,
  };
}

/**
 * Fetch config from API. Uses AsyncStorage cache (1h TTL) then in-memory.
 */
export async function getPickerConfig(): Promise<PickerConfig> {
  const now = Date.now();
  try {
    const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached) as { data: PickerConfig; timestamp: number };
      if (Date.now() - timestamp < CONFIG_CACHE_TTL_MS) {
        const merged = mergeWithDefaults(data);
        cachedConfig = merged;
        cacheExpiry = timestamp + CONFIG_CACHE_TTL_MS;
        return merged;
      }
    }
  } catch {
    /* use network */
  }

  if (cachedConfig && cacheExpiry > now) {
    return cachedConfig;
  }

  try {
    const res = await apiGet<{ success: boolean; data: Partial<PickerConfig> }>("/config");
    const data = (res as { success: boolean; data?: Partial<PickerConfig> }).data;
    const merged = mergeWithDefaults(data ?? null);
    cachedConfig = merged;
    cacheExpiry = now + CONFIG_CACHE_TTL_MS;
    try {
      await AsyncStorage.setItem(
        CONFIG_CACHE_KEY,
        JSON.stringify({ data: merged, timestamp: Date.now() })
      );
    } catch {
      /* ignore */
    }
    return merged;
  } catch (e) {
    if (e instanceof ApiClientError) {
      return mergeWithDefaults(null);
    }
    throw e;
  }
}

/**
 * Clear persisted and in-memory config (e.g. logout).
 */
export async function clearPickerConfigCache(): Promise<void> {
  cachedConfig = null;
  cacheExpiry = 0;
  try {
    await AsyncStorage.removeItem(CONFIG_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @deprecated Use clearPickerConfigCache
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
  void AsyncStorage.removeItem(CONFIG_CACHE_KEY).catch(() => {});
}
