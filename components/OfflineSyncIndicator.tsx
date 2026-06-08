/**
 * OfflineSyncIndicator
 *
 * Small indicator shown when offline queue has pending items.
 * Displays "Syncing..." when processing, or "Offline - X pending" when idle with queue.
 */

import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { CloudOff, Cloud } from "lucide-react-native";

interface OfflineSyncIndicatorProps {
  pendingCount: number;
  isProcessing: boolean;
}

export function OfflineSyncIndicator({ pendingCount, isProcessing }: OfflineSyncIndicatorProps) {
  if (pendingCount === 0) return null;

  return (
    <View style={styles.container}>
      {isProcessing ? (
        <>
          <Cloud size={14} color="#121358" />
          <Text style={styles.text}>Syncing...</Text>
        </>
      ) : (
        <>
          <CloudOff size={14} color="#F59E0B" />
          <Text style={styles.text}>
            Offline – {pendingCount} pending
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
      : { elevation: 2 }),
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
});
