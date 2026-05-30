import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Smartphone, Battery, AlertCircle, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import { getAssignedDevice, type AssignedDevice } from "@/services/device.service";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";

export default function DeviceStatusScreen() {
  const router = useRouter();
  const [device, setDevice] = useState<AssignedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assigned = await getAssignedDevice();
        if (!cancelled) setDevice(assigned);
      } catch {
        if (!cancelled) setDevice(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
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
    return () => { cancelled = true; };
  }, []);

  const batteryPct = batteryLevel != null ? Math.round(batteryLevel * 100) : null;
  const batteryHealthy = batteryPct == null || batteryPct > 20;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Device Status" showBack onBackPress={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#5B4EFF" />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Smartphone size={24} color="#5B4EFF" />
                <View style={styles.cardContent}>
                  <Text style={styles.cardLabel}>Device ID</Text>
                  <Text style={styles.cardValue}>{device?.deviceId ?? "No device assigned"}</Text>
                </View>
              </View>
            </View>

            {batteryPct != null && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Battery
                    size={24}
                    color={batteryHealthy ? "#10B981" : "#EF4444"}
                  />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardLabel}>Battery</Text>
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
              <Text style={styles.cardValue}>
                {device?.status ?? "No device"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => router.push("/contact-support")}
              activeOpacity={0.7}
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
            </TouchableOpacity>
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
