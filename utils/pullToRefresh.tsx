import React, { useCallback, useState } from "react";
import { RefreshControl } from "react-native";
import { BaseColors } from "@/constants/theme";

export const PULL_REFRESH_TINT = BaseColors.primary[650];

export function makeRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[PULL_REFRESH_TINT]}
      tintColor={PULL_REFRESH_TINT}
    />
  );
}

/** Pull-to-refresh state + RefreshControl for screens that load data manually. */
export function usePullToRefresh(refreshFn: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return {
    refreshing,
    onRefresh,
    refreshControl: makeRefreshControl(refreshing, onRefresh),
  };
}
