import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableCard } from "@/utils/touchables";
import React, { useState, useCallback, useRef } from "react";
import { StyleSheet, Text, View, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Smartphone,
  Battery,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
} from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Header from "@/components/Header";
import HsdDeviceRequestOtpCard from "@/components/HsdDeviceRequestOtpCard";
import {
  getAssignedDevice,
  DEVICE_STATUS_POLL_MS,
  DEVICE_ASSIGNED_LABEL,
  NO_DEVICE_ASSIGNED_LABEL,
  isDeviceAssignedRecord,
  type AssignedDevice,
} from "@/services/device.service";
import { Spacing, BorderRadius } from "@/constants/theme";
import { pickerWebSocketService } from "@/utils/websocket.service";

export default function DeviceStatusScreen() {
  const router = useRouter();
  const [device, setDevice] = useState<AssignedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const loadAssignedDevice = useCallback(async (opts?: { silent?: boolean; sync?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const assigned = await getAssignedDevice({ sync: opts?.sync });
      setDevice(assigned);
    } catch (err) {
      setDevice(null);
      if (err instanceof Error && err.message) {
        setLoadError(err.message);
      } else {
        setLoadError("Could not load device status. Pull to refresh or try again.");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAssignedDevice({
        silent: hasLoadedOnceRef.current,
        sync: hasLoadedOnceRef.current,
      });
      pollTimerRef.current = setInterval(() => {
        void loadAssignedDevice({ silent: true, sync: true });
      }, DEVICE_STATUS_POLL_MS);
      return () => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }, [loadAssignedDevice])
  );

  useFocusEffect(
    useCallback(() => {
      const onDeviceChange = () => {
        void loadAssignedDevice({ silent: true, sync: true });
      };
      pickerWebSocketService.connect();
      pickerWebSocketService.on("DEVICE_ASSIGNED", onDeviceChange);
      pickerWebSocketService.on("DEVICE_UNASSIGNED", onDeviceChange);
      return () => {
        pickerWebSocketService.off("DEVICE_ASSIGNED", onDeviceChange);
        pickerWebSocketService.off("DEVICE_UNASSIGNED", onDeviceChange);
      };
    }, [loadAssignedDevice])
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;
      let cancelled = false;
      (async () => {
        try {
          const { getBatteryLevelAsync } = await import("expo-battery");
          const level = await getBatteryLevelAsync();
          if (!cancelled) setBatteryLevel(level);
        } catch {
          if (!cancelled) setBatteryLevel(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const hhdActive = device?.hhdActive === true || device?.inUseOnHhd === true;
  const hasDeviceRecord = isDeviceAssignedRecord(device);
  const isDashboardAssigned = hasDeviceRecord;
  const hsdBattery =
    device?.hsdBatteryLevel != null ? device.hsdBatteryLevel : null;
  const batteryPct =
    hsdBattery != null
      ? Math.round(hsdBattery)
      : batteryLevel != null
        ? Math.round(batteryLevel * 100)
        : null;
  const batteryHealthy = batteryPct == null || batteryPct > 20;
  const statusLabel = !hasDeviceRecord
    ? NO_DEVICE_ASSIGNED_LABEL
    : hhdActive
      ? `${DEVICE_ASSIGNED_LABEL} · HHD Active`
      : DEVICE_ASSIGNED_LABEL;
  const deviceIdLabel = hasDeviceRecord
    ? device?.deviceId ?? "—"
    : NO_DEVICE_ASSIGNED_LABEL;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Device Status" showBack onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        {...scrollViewTouchProps}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#121358" />
          </View>
        ) : (
          <>
            {refreshing ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator size="small" color="#121358" />
                <Text style={styles.refreshText}>Syncing with dashboard…</Text>
              </View>
            ) : null}

            {loadError && !hasDeviceRecord ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
            ) : null}

            {isDashboardAssigned && hhdActive ? (
              <View style={styles.assignedBanner}>
                <CheckCircle2 size={22} color="#059669" strokeWidth={2.5} />
                <View style={styles.assignedBannerText}>
                  <Text style={styles.assignedTitle}>Device active on HHD</Text>
                  <Text style={styles.assignedSubtitle}>
                    Your assigned handheld is online and the HHD app is running.
                  </Text>
                </View>
              </View>
            ) : null}

            {isDashboardAssigned && !hhdActive ? (
              <View style={styles.assignedBanner}>
                <CheckCircle2 size={22} color="#059669" strokeWidth={2.5} />
                <View style={styles.assignedBannerText}>
                  <Text style={styles.assignedTitle}>{DEVICE_ASSIGNED_LABEL}</Text>
                  <Text style={styles.assignedSubtitle}>
                    Your manager assigned this device in the dashboard. Open the HHD app on the
                    handheld when you start picking.
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Smartphone size={24} color="#121358" />
                <View style={styles.cardContent}>
                  <Text style={styles.cardLabel}>Device ID</Text>
                  <Text style={styles.cardValue}>{deviceIdLabel}</Text>
                </View>
              </View>
            </View>

            {device?.serial ? (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Smartphone size={24} color="#121358" />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardLabel}>Serial number</Text>
                    <Text style={styles.cardValue}>{device.serial}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {batteryPct != null && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Battery
                    size={24}
                    color={batteryHealthy ? "#10B981" : "#EF4444"}
                  />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardLabel}>
                      {hsdBattery != null ? "HHD device battery" : "Battery"}
                    </Text>
                    <Text
                      style={[
                        styles.cardValue,
                        { color: batteryHealthy ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      {batteryPct}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Status</Text>
              <Text
                style={[
                  styles.cardValue,
                  hasDeviceRecord
                    ? styles.statusAssigned
                    : styles.statusUnassigned,
                ]}
              >
                {statusLabel}
              </Text>
              {device?.assignedAt ? (
                <Text style={styles.assignedAtText}>
                  Assigned{" "}
                  {new Date(device.assignedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
              ) : null}
            </View>

            <HsdDeviceRequestOtpCard />

            <TouchableCard
              style={styles.reportCard}
              onPress={() => router.push("/contact-support")}
            >
              <View style={styles.reportRow}>
                <AlertCircle size={24} color="#F59E0B" />
                <View style={styles.reportContent}>
                  <Text style={styles.reportTitle}>Report Issue</Text>
                  <Text style={styles.reportSubtitle}>
                    Report device or app issues to support
                  </Text>
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
              </View>
            </TouchableCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  loading: {
    padding: Spacing.xl * 2,
    alignItems: "center",
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  refreshText: {
    fontSize: 12,
    color: "#6B7280",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
    lineHeight: 18,
  },
  assignedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  assignedBannerText: { flex: 1 },
  assignedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 2,
  },
  assignedSubtitle: {
    fontSize: 13,
    color: "#047857",
    lineHeight: 18,
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  waitingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 2,
  },
  waitingSubtitle: {
    fontSize: 13,
    color: "#B45309",
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  cardContent: { flex: 1 },
  cardLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  statusAssigned: {
    color: "#059669",
  },
  statusUnassigned: {
    color: "#6B7280",
  },
  statusWaiting: {
    color: "#B45309",
  },
  assignedAtText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  reportContent: { flex: 1 },
  reportTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  reportSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
});
