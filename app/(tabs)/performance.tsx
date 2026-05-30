import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Target, Clock, Package, TrendingUp } from "lucide-react-native";
import { getAttendanceStats, type AttendanceStats } from "@/services/attendance.service";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";

export default function PerformanceScreen() {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getAttendanceStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const perf = stats?.performance;
  const accuracy = perf?.accuracy ?? 0;
  const speed = perf?.speed ?? 0;
  const topPercent = perf?.topPercent ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5B4EFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#5B4EFF"]} />
        }
      >
        <Text style={styles.title}>My Performance</Text>
        <Text style={styles.subtitle}>Orders, time, and accuracy metrics</Text>

        <View style={styles.cards}>
          <View style={styles.card}>
            <Package size={28} color="#5B4EFF" />
            <Text style={styles.cardValue}>{stats?.todayOrders ?? 0}</Text>
            <Text style={styles.cardLabel}>Today's Orders</Text>
          </View>
          <View style={styles.card}>
            <Target size={28} color="#10B981" />
            <Text style={styles.cardValue}>{accuracy}%</Text>
            <Text style={styles.cardLabel}>Accuracy</Text>
          </View>
        </View>

        <View style={styles.cards}>
          <View style={styles.card}>
            <Clock size={28} color="#F59E0B" />
            <Text style={styles.cardValue}>{speed}</Text>
            <Text style={styles.cardLabel}>Speed Score</Text>
          </View>
          <View style={styles.card}>
            <TrendingUp size={28} color="#8B5CF6" />
            <Text style={styles.cardValue}>Top {topPercent}%</Text>
            <Text style={styles.cardLabel}>Performance</Text>
          </View>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Today's Earnings</Text>
          <Text style={styles.earningsValue}>
            ₹{stats?.todayEarnings ?? 0}
          </Text>
          {stats?.todayIncentives ? (
            <Text style={styles.incentives}>+ ₹{stats.todayIncentives} incentives</Text>
          ) : null}
        </View>

        {stats?.hubName && (
          <Text style={styles.hubName}>Hub: {stats.hubName}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: "700",
    color: "#111827",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: Spacing.xl,
  },
  cards: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginTop: Spacing.sm,
  },
  cardLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  earningsCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  earningsValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#5B4EFF",
    marginTop: Spacing.sm,
  },
  incentives: {
    fontSize: 12,
    color: "#10B981",
    marginTop: Spacing.sm,
  },
  hubName: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: Spacing.xl,
    textAlign: "center",
  },
});
