import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/state/authContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { getWorkLocations, setUserWorkLocation, type WorkLocation } from "@/services/locations.service";

const PURPLE = "#5B4EFF";

function LocationSkeleton() {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonLineLg} />
      <View style={styles.skeletonLineSm} />
      <View style={styles.skeletonBadge} />
    </Animated.View>
  );
}

export default function SelectWorkLocationScreen() {
  const router = useRouter();
  const colors = useColors();
  const { locationType } = useAuth();
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getWorkLocations();
      setLocations(list);
    } catch {
      setError("Failed to load locations. Retry");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = locations;
    if (locationType === "warehouse" || locationType === "darkstore") {
      list = list.filter((l) => l.type === locationType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q));
  }, [locations, locationType, searchQuery]);

  const selected = useMemo(
    () => (selectedId ? filtered.find((l) => l.locationId === selectedId) ?? locations.find((l) => l.locationId === selectedId) : null),
    [selectedId, filtered, locations]
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await setUserWorkLocation(selected.locationId, selected.type);
      setSaving(false);
      if (!result.success) {
        setError(result.error ?? "Could not save location. Retry");
        return;
      }
      router.replace("/select-shift");
    } catch {
      setSaving(false);
      setError("Could not save location. Retry");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]} edges={["bottom", "left", "right"]}>
      <Header title="Select Work Location" showBack={false} />

      <View style={styles.body}>
        <Text style={[styles.intro, { color: colors.text.secondary }]}>
          Select the warehouse or darkstore where you will be working.
        </Text>

        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: colors.background,
              borderColor: colors.border.medium,
              color: colors.text.primary,
            },
          ]}
          placeholder="Search by name"
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {error ? (
          <View style={styles.errorWrap}>
            <Text style={[styles.errorText, { color: colors.error[500] }]}>{error}</Text>
            <TouchableOpacity onPress={() => void load()}>
              <Text style={[styles.retry, { color: PURPLE }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <>
              <LocationSkeleton />
              <LocationSkeleton />
              <LocationSkeleton />
            </>
          ) : filtered.length === 0 && !error ? (
            <Text style={[styles.empty, { color: colors.text.secondary }]}>No locations match your search.</Text>
          ) : !loading && filtered.length > 0 ? (
            filtered.map((loc) => {
              const isSelected = selectedId === loc.locationId;
              return (
                <TouchableOpacity
                  key={loc.locationId}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.background,
                      borderColor: isSelected ? PURPLE : colors.border.medium,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedId(loc.locationId)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardText}>
                      <Text style={[styles.cardName, { color: colors.text.primary }]}>{loc.name}</Text>
                      <Text style={[styles.cardAddr, { color: colors.text.secondary }]} numberOfLines={2}>
                        {[loc.address, loc.city, loc.state].filter(Boolean).join(", ") || "—"}
                      </Text>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: loc.type === "darkstore" ? colors.info[50] : colors.gray[100] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            { color: loc.type === "darkstore" ? colors.info[600] : colors.gray[700] },
                          ]}
                        >
                          {loc.type === "darkstore" ? "Darkstore" : "Warehouse"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: isSelected ? PURPLE : colors.border.dark,
                          backgroundColor: isSelected ? "rgba(91, 78, 255, 0.08)" : "transparent",
                        },
                      ]}
                    >
                      {isSelected ? <View style={[styles.radioInner, { backgroundColor: PURPLE }]} /> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : null}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border.light }]}>
        <PrimaryButton
          title="Confirm Location"
          onPress={() => void handleConfirm()}
          disabled={!selectedId || saving}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.xl },
  intro: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  search: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.lg,
    marginBottom: Spacing.md,
  },
  errorWrap: { marginBottom: Spacing.md },
  errorText: { fontSize: Typography.fontSize.md, marginBottom: Spacing.xs },
  retry: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  skeletonCard: {
    backgroundColor: "#E5E7EB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  skeletonLineLg: { height: 16, width: "70%", backgroundColor: "#D1D5DB", borderRadius: 6, marginBottom: 10 },
  skeletonLineSm: { height: 12, width: "90%", backgroundColor: "#D1D5DB", borderRadius: 6, marginBottom: 12 },
  skeletonBadge: { height: 22, width: 100, backgroundColor: "#D1D5DB", borderRadius: BorderRadius.sm },
  empty: { textAlign: "center", marginTop: Spacing["2xl"], fontSize: Typography.fontSize.md },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  cardText: { flex: 1 },
  cardName: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginBottom: 4 },
  cardAddr: { fontSize: Typography.fontSize.md, marginBottom: Spacing.sm },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  bottomSpacer: { height: 100 },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["2xl"],
    borderTopWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px -2px 8px rgba(0, 0, 0, 0.05)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
});
