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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, Navigation } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useLocation } from "@/state/locationContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import {
  getWorkLocations,
  setDarkstoreFromCurrentLocation,
  setUserWorkLocation,
  type WorkLocation,
} from "@/services/locations.service";
import { getCurrentLocation } from "@/services/location.service";
import { setLocationTypeApi } from "@/services/user.service";

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
  const { locationType, setLocationType } = useAuth();
  const {
    currentLocation,
    refreshLocation,
    locationPermission,
    isLoading: gpsLoading,
    requestPermission,
    getFormattedAddress,
  } = useLocation();
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [assignedLocation, setAssignedLocation] = useState<WorkLocation | null>(null);
  const autoAssignAttemptedRef = useRef(false);

  const resolveDeviceGps = useCallback(async () => {
    if (locationPermission !== "granted") {
      const granted = await requestPermission();
      if (!granted) {
        return { error: "Location permission is required to set your darkstore." as const };
      }
    }

    let coords = currentLocation;
    if (!coords) {
      await refreshLocation();
      coords = await getCurrentLocation();
    }

    const lat = coords?.latitude;
    const lng = coords?.longitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { error: "Could not detect your current location. Enable GPS and try again." as const };
    }

    const address = getFormattedAddress();
    return {
      gps: {
        latitude: lat,
        longitude: lng,
        address:
          address && !address.startsWith("Location not") && address !== "Resolving…"
            ? address
            : undefined,
        capturedAt: coords.timestamp ?? Date.now(),
      },
    };
  }, [
    currentLocation,
    locationPermission,
    refreshLocation,
    requestPermission,
    getFormattedAddress,
  ]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (locationType === "darkstore") return;
      try {
        const result = await setLocationTypeApi("darkstore");
        if (!cancelled && result.success) {
          await setLocationType("darkstore");
        }
      } catch {
        if (!cancelled) {
          try {
            await setLocationType("darkstore");
          } catch {
            // ignore local state update error
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationType, setLocationType]);

  const assignDarkstoreFromGps = useCallback(async () => {
    setAutoAssigning(true);
    setError(null);
    try {
      const resolved = await resolveDeviceGps();
      if ("error" in resolved) {
        setError(resolved.error);
        return;
      }

      const { gps } = resolved;
      const result = await setDarkstoreFromCurrentLocation(
        gps.latitude,
        gps.longitude,
        { address: gps.address, capturedAt: gps.capturedAt }
      );
      if (!result.success || !result.data?.nearest) {
        setError(result.error ?? "Could not assign a darkstore from your location.");
        return;
      }

      const nearest = result.data.nearest;
      const mapped: WorkLocation = {
        locationId: nearest.locationId,
        name: nearest.name,
        type: "darkstore",
        address: nearest.address,
        city: nearest.city,
        state: nearest.state,
        coordinates: nearest.coordinates,
        distance: nearest.distance ?? null,
        distanceDisplay: nearest.distanceDisplay ?? null,
        travelTime: nearest.travelTime ?? null,
      };
      setAssignedLocation(mapped);
      setSelectedId(mapped.locationId);
    } catch {
      setError("Could not assign darkstore from your current location.");
    } finally {
      setAutoAssigning(false);
    }
  }, [resolveDeviceGps]);

  useEffect(() => {
    if (autoAssignAttemptedRef.current || loading) return;
    autoAssignAttemptedRef.current = true;
    void assignDarkstoreFromGps();
  }, [loading, assignDarkstoreFromGps]);

  const filtered = useMemo(() => {
    let list = locations.filter((l) => l.type === "darkstore");
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q)
    );
  }, [locations, searchQuery]);

  const selected = useMemo(
    () =>
      selectedId
        ? filtered.find((l) => l.locationId === selectedId) ??
          locations.find((l) => l.locationId === selectedId) ??
          assignedLocation
        : assignedLocation,
    [selectedId, filtered, locations, assignedLocation]
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const resolved = await resolveDeviceGps();
      if ("error" in resolved) {
        setError(resolved.error);
        return;
      }

      const { gps } = resolved;
      const result = await setUserWorkLocation(selected.locationId, "darkstore", gps);
      if (!result.success) {
        setError(result.error ?? "Could not save darkstore location. Retry");
        return;
      }

      setAssignedLocation({
        ...selected,
        address: gps.address ?? selected.address,
        coordinates: {
          latitude: gps.latitude,
          longitude: gps.longitude,
        },
      });
      router.replace("/(tabs)");
    } catch {
      setError("Could not save darkstore location. Retry");
    } finally {
      setSaving(false);
    }
  };

  const isBusy = loading || autoAssigning || gpsLoading;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]} edges={["bottom", "left", "right"]}>
      <Header title="Select Work Location" showBack={false} />

      <View style={styles.body}>
        <Text style={[styles.intro, { color: colors.text.secondary }]}>
          Your current GPS position is saved as the official darkstore location when you confirm.
          We use it later to verify you are on site when you start a shift.
        </Text>

        <View style={[styles.assignedCard, { backgroundColor: colors.info[50], borderColor: colors.info[200] }]}>
          <View style={styles.assignedIcon}>
            {autoAssigning ? (
              <ActivityIndicator color={PURPLE} size="small" />
            ) : (
              <Navigation color={PURPLE} size={20} strokeWidth={2} />
            )}
          </View>
          <View style={styles.assignedText}>
            <Text style={[styles.assignedLabel, { color: colors.text.secondary }]}>Assigned darkstore</Text>
            <Text style={[styles.assignedName, { color: colors.text.primary }]} numberOfLines={2}>
              {autoAssigning
                ? "Detecting location..."
                : assignedLocation?.name ?? "Waiting for GPS..."}
            </Text>
            {assignedLocation?.distanceDisplay ? (
              <Text style={[styles.assignedMeta, { color: colors.text.secondary }]}>
                {assignedLocation.distanceDisplay} from you
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => void assignDarkstoreFromGps()}
            disabled={autoAssigning}
            style={[styles.refreshBtn, { borderColor: PURPLE }]}
          >
            <Text style={[styles.refreshBtnText, { color: PURPLE }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

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
            <TouchableOpacity onPress={() => void assignDarkstoreFromGps()}>
              <Text style={[styles.retry, { color: PURPLE }]}>Retry GPS assignment</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void load()}>
              <Text style={[styles.retry, { color: PURPLE, marginTop: 4 }]}>Reload locations</Text>
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
                          { backgroundColor: colors.info[50] },
                        ]}
                      >
                        <MapPin color={colors.info[600]} size={12} />
                        <Text style={[styles.typeBadgeText, { color: colors.info[600] }]}>Darkstore</Text>
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
          title="Confirm & Go to Home"
          onPress={() => void handleConfirm()}
          disabled={!selectedId || saving || isBusy}
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
  assignedCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  assignedIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  assignedText: { flex: 1 },
  assignedLabel: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
  assignedName: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginTop: 2 },
  assignedMeta: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  refreshBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
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
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
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
