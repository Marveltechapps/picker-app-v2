import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";

import React, { useState, useEffect, useRef, useCallback } from "react";

import { StyleSheet, Text, View, ActivityIndicator } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useFocusEffect } from "@react-navigation/native";

import { Target, Clock, Package, TrendingUp } from "lucide-react-native";

import { getAttendanceStats, type AttendanceStats } from "@/services/attendance.service";

import { Typography, Spacing, BorderRadius } from "@/constants/theme";

import { usePullToRefresh } from "@/utils/pullToRefresh";



export default function PerformanceScreen() {

  const [stats, setStats] = useState<AttendanceStats | null>(null);

  const [loading, setLoading] = useState(true);

  const hasLoadedOnceRef = useRef(false);



  const load = useCallback(async (options?: { fresh?: boolean; silent?: boolean }) => {

    const fresh = options?.fresh ?? false;

    const silent = options?.silent ?? false;

    if (!silent && !hasLoadedOnceRef.current) setLoading(true);

    try {

      const data = await getAttendanceStats({ fresh });

      setStats(data);

    } catch {

      if (!silent) setStats(null);

    } finally {

      setLoading(false);

      hasLoadedOnceRef.current = true;

    }

  }, []);



  useEffect(() => {

    load();

  }, [load]);



  const { refreshControl } = usePullToRefresh(() => load({ fresh: true, silent: true }));



  useFocusEffect(

    useCallback(() => {

      if (hasLoadedOnceRef.current) {

        void load({ fresh: true, silent: true });

      }

    }, [load])

  );



  const perf = stats?.performance;

  const accuracy = perf?.accuracy ?? 0;

  const speed = perf?.speed ?? 0;

  const topPercent = perf?.topPercent ?? 0;



  return (

    <SafeAreaView style={styles.container} edges={["left", "right"]}>

      <ScrollView

        style={styles.scroll}

        contentContainerStyle={styles.content}

        {...scrollViewTouchProps}

        refreshControl={refreshControl}

      >

        <Text style={styles.title}>My Performance</Text>

        <Text style={styles.subtitle}>Orders, time, and accuracy metrics</Text>



        {loading && !stats ? (

          <View style={styles.loadingRow}>

            <ActivityIndicator size="small" color="#121358" />

            <Text style={styles.loadingText}>Loading metrics…</Text>

          </View>

        ) : null}



        <View style={styles.cards}>

          <View style={styles.card}>

            <Package size={28} color="#121358" />

            <Text style={styles.cardValue}>{stats?.todayOrders ?? "—"}</Text>

            <Text style={styles.cardLabel}>Today's Orders</Text>

          </View>

          <View style={styles.card}>

            <Target size={28} color="#10B981" />

            <Text style={styles.cardValue}>{loading && !stats ? "—" : `${accuracy}%`}</Text>

            <Text style={styles.cardLabel}>Accuracy</Text>

          </View>

        </View>



        <View style={styles.cards}>

          <View style={styles.card}>

            <Clock size={28} color="#F59E0B" />

            <Text style={styles.cardValue}>{loading && !stats ? "—" : speed}</Text>

            <Text style={styles.cardLabel}>Speed Score</Text>

          </View>

          <View style={styles.card}>

            <TrendingUp size={28} color="#121358" />

            <Text style={styles.cardValue}>

              {loading && !stats ? "—" : `Top ${topPercent}%`}

            </Text>

            <Text style={styles.cardLabel}>Performance</Text>

          </View>

        </View>



        <View style={styles.earningsCard}>

          <Text style={styles.earningsLabel}>Today's Earnings</Text>

          <Text style={styles.earningsValue}>

            {loading && !stats ? "—" : `₹${stats?.todayEarnings ?? 0}`}

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

  loadingRow: {

    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,

    marginBottom: Spacing.md,

  },

  loadingText: {

    fontSize: 14,

    color: "#6B7280",

  },

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

    backgroundColor: "#EEEEF5",

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

    color: "#121358",

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


