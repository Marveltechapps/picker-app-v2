import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - timestamp > ttlMs) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
}

export async function clearCached(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function clearAllCached(prefix: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter((k) => k.startsWith(prefix));
    if (matching.length > 0) {
      await AsyncStorage.multiRemove(matching);
    }
  } catch {
    /* ignore */
  }
}
