/**
 * useOfflineQueue Hook
 *
 * - Loads offline queue from storage on mount
 * - Subscribes to NetInfo for network changes
 * - When network becomes connected: processes queue
 * - When AppState becomes 'active': processes queue (reconnect after background)
 * - Exposes queue length and isProcessing for sync indicator
 */

import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { processQueue } from "@/utils/queueAwareApi";

function runProcessQueue() {
  processQueue().then(({ processed }) => {
    if (processed > 0 && __DEV__) {
      console.log(`[OfflineQueue] Synced ${processed} items`);
    }
  });
}

export function useOfflineQueue() {
  const { items, isProcessing, loadFromStorage } = useOfflineQueueStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        runProcessQueue();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        NetInfo.fetch().then((state) => {
          if (state.isConnected && state.isInternetReachable !== false) {
            runProcessQueue();
          }
        });
      }
    });
    return () => sub.remove();
  }, []);

  return {
    pendingCount: items.length,
    isProcessing,
  };
}
