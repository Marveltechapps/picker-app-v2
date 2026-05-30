/**
 * Offline Queue Store (Zustand + AsyncStorage persistence)
 *
 * Stores failed API calls for retry when network is restored.
 * Each item: { id, actionType, endpoint, method, body, idempotencyKey, timestamp, retries }
 * Processes queue in order on reconnect; removes on success; keeps on failure with backoff.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OFFLINE_QUEUE_STORAGE_KEY } from "@/constants/storageKeys";

const STORAGE_KEY = OFFLINE_QUEUE_STORAGE_KEY;

export interface OfflineQueueItem {
  id: string;
  actionType: string;
  endpoint: string;
  method: string;
  body: unknown;
  idempotencyKey: string;
  timestamp: number;
  retries: number;
}

interface OfflineQueueState {
  items: OfflineQueueItem[];
  isProcessing: boolean;
  addItem: (item: Omit<OfflineQueueItem, "id" | "timestamp" | "retries">) => void;
  removeItem: (id: string) => void;
  incrementRetries: (id: string) => void;
  setProcessing: (value: boolean) => void;
  loadFromStorage: () => Promise<void>;
  persistToStorage: () => Promise<void>;
}

function generateId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set, get) => ({
  items: [],
  isProcessing: false,

  addItem: (item) => {
    const newItem: OfflineQueueItem = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
      retries: 0,
    };
    set((s) => ({ items: [...s.items, newItem] }));
    get().persistToStorage();
  },

  removeItem: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    get().persistToStorage();
  },

  incrementRetries: (id) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, retries: i.retries + 1 } : i)),
    }));
    get().persistToStorage();
  },

  setProcessing: (value) => set({ isProcessing: value }),

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OfflineQueueItem[];
        if (Array.isArray(parsed)) set({ items: parsed });
      }
    } catch {
      // Ignore parse errors
    }
  },

  persistToStorage: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().items));
    } catch {
      // Ignore
    }
  },
}));

export const MAX_RETRIES = 5;
