import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Building2, Store, MapPin, Navigation } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useLocation } from "@/state/locationContext";
import { setLocationTypeApi } from "@/services/user.service";
import { getWorkLocations, type WorkLocation } from "@/services/locations.service";
import { calculateDistance } from "@/utils/locationService";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import LocationMapView from "@/components/LocationMapView";

const { height } = Dimensions.get("window");

function formatDistanceKm(distanceMeters: number | null): string | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return null;
  const km = distanceMeters / 1000;
  return km < 1 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

function estimateTravelTime(distanceMeters: number | null): string | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return null;
  const averageSpeedKmh = 30;
  const minutes = Math.max(1, Math.ceil((distanceMeters / 1000 / averageSpeedKmh) * 60));
  return `${minutes} min`;
}

export default function LocationTypeScreen() {
  const router = useRouter();
  const { locationType, setLocationType } = useAuth();
  const { 
    currentLocation, 
    refreshLocation, 
    getFormattedAddress,
    locationPermission,
    isLoading: locationLoading,
    startWatchingLocation,
    stopWatchingLocation
  } = useLocation();
  const [selectedType, setSelectedType] = useState<"warehouse" | "darkstore" | null>(locationType as "warehouse" | "darkstore" | null);
  const [loading, setLoading] = useState<boolean>(false);
  const [backendLoading, setBackendLoading] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [backendLocations, setBackendLocations] = useState<WorkLocation[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Fetch location on mount and start watching for real-time updates
  useEffect(() => {
    if (locationPermission === 'granted') {
      refreshLocation();
      startWatchingLocation();
    }
    return () => {
      stopWatchingLocation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationPermission]);

  useEffect(() => {
    let cancelled = false;
    const loadLocations = async () => {
      setBackendLoading(true);
      setBackendError(null);
      try {
        // Pull the full admin master-data list (warehouse + darkstore).
        const list = await getWorkLocations();
        if (!cancelled) {
          setBackendLocations(Array.isArray(list) ? list : []);
          if (!Array.isArray(list) || list.length === 0) {
            setBackendError("No location records returned by backend.");
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to load nearby locations from server";
          setBackendError(message);
          setBackendLocations([]);
        }
      } finally {
        if (!cancelled) setBackendLoading(false);
      }
    };
    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, []);

  const locationsWithDistance = useMemo(
    () =>
      backendLocations.map((location) => {
        if (!currentLocation || !location.coordinates) {
          return {
            ...location,
            distance: location.distance ?? null,
            distanceDisplay: location.distanceDisplay ?? null,
            travelTime: location.travelTime ?? null,
          };
        }
        const distanceMeters = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          location.coordinates.latitude,
          location.coordinates.longitude
        );
        return {
          ...location,
          distance: distanceMeters / 1000,
          distanceDisplay: formatDistanceKm(distanceMeters),
          travelTime: estimateTravelTime(distanceMeters),
        };
      }),
    [backendLocations, currentLocation]
  );

  const warehouses = useMemo(
    () => locationsWithDistance.filter((location) => location.type === "warehouse"),
    [locationsWithDistance]
  );
  const darkstores = useMemo(
    () => locationsWithDistance.filter((location) => location.type === "darkstore"),
    [locationsWithDistance]
  );
  const nearestWarehouse = useMemo(() => {
    if (warehouses.length === 0) return null;
    return [...warehouses].sort(
      (a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER)
    )[0] ?? null;
  }, [warehouses]);
  const nearestDarkstore = useMemo(() => {
    if (darkstores.length === 0) return null;
    return [...darkstores].sort(
      (a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER)
    )[0] ?? null;
  }, [darkstores]);

  const nearestOverall = useMemo(() => {
    if (locationsWithDistance.length === 0) return null;
    return [...locationsWithDistance]
      .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER))[0] ?? null;
  }, [locationsWithDistance]);

  const nearestForSelectedType = useMemo(() => {
    if (!selectedType) return null;
    const byType = selectedType === "warehouse" ? warehouses : darkstores;
    if (byType.length === 0) return null;
    return [...byType]
      .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER))[0] ?? null;
  }, [selectedType, warehouses, darkstores]);

  const nearestLocation = nearestForSelectedType ?? nearestOverall;

  const mapMarkers = useMemo(
    () =>
      locationsWithDistance
        .filter((location) => !!location.coordinates)
        .slice(0, 40)
        .map((location) => ({
          id: location.locationId,
          latitude: location.coordinates!.latitude,
          longitude: location.coordinates!.longitude,
          title: location.name,
          description:
            [
              location.type === "darkstore" ? "Darkstore" : "Warehouse",
              location.distanceDisplay || null,
            ]
              .filter(Boolean)
              .join(" • ") || undefined,
          pinColor:
            nearestLocation?.locationId === location.locationId
              ? "#6366F1"
              : location.type === "darkstore"
                ? "#F97316"
                : "#111827",
        })),
    [locationsWithDistance, nearestLocation?.locationId]
  );

  const canContinue =
    !!selectedType && (selectedType === "warehouse" ? warehouses.length > 0 : darkstores.length > 0);

  const drawerItems = selectedType === "warehouse" ? warehouses : darkstores;

  const openTypeDrawer = (type: "warehouse" | "darkstore") => {
    setSelectedType(type);
    setDrawerVisible(true);
  };

  const handleContinue = async () => {
    if (!selectedType) return;
    setLoading(true);
    try {
      const result = await setLocationTypeApi(selectedType);
      if (result.success) await setLocationType(selectedType);
      setLoading(false);
      router.replace("/select-work-location");
    } catch {
      setLoading(false);
      await setLocationType(selectedType);
      router.replace("/select-work-location");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.mapBackground}>
        <LocationMapView 
          style={styles.mapView}
          showUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          preferGoogleProvider={true}
          markers={mapMarkers}
        />
        <View style={styles.mapOverlay} />
      </View>

      <Header
        title="Select Location"
        subtitle="Choose where you'll be working"
        onBackPress={() => {
          try {
            if (router.canGoBack()) router.back();
            else router.push("/training");
          } catch {
            try { router.push("/training"); } catch { /* fallback */ }
          }
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>Select Your Work Location</Text>
          <Text style={styles.subtitle}>Choose where you&apos;ll be working today</Text>
        </View>

        <View style={styles.nearestCard}>
          <View style={styles.nearestIcon}>
            <Navigation color="#6366F1" size={20} strokeWidth={2} />
          </View>
          <View style={styles.nearestInfo}>
            <Text style={styles.nearestTitle}>Nearest Location</Text>
            <Text style={styles.nearestLocation} numberOfLines={2}>
              {nearestLocation
                ? nearestLocation.name
                : backendLoading
                  ? "Finding nearest location..."
                  : "No nearby location found"}
            </Text>
          </View>
          <View style={styles.travelInfo}>
            <Text style={styles.travelLabel}>
              {nearestLocation?.distanceDisplay ? nearestLocation.distanceDisplay : "GPS Status"}
            </Text>
            <Text style={styles.travelTime}>
              {backendLoading
                ? "Loading..."
                : nearestLocation?.travelTime
                  ? nearestLocation.travelTime
                  : locationLoading
                    ? "Loading..."
                    : currentLocation
                      ? "Active"
                      : "Inactive"}
            </Text>
          </View>
        </View>
        {backendError ? <Text style={styles.backendError}>{backendError}</Text> : null}

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[
              styles.locationCard,
              selectedType === "warehouse" && styles.locationCardSelected,
              warehouses.length === 0 && styles.locationCardDisabled,
            ]}
            onPress={() => openTypeDrawer("warehouse")}
            activeOpacity={warehouses.length === 0 ? 1 : 0.7}
            disabled={warehouses.length === 0}
          >
            <View style={[
              styles.iconContainer,
              selectedType === "warehouse" && styles.iconContainerSelected
            ]}>
              <Building2 
                color={selectedType === "warehouse" ? "#FFFFFF" : "#6B7280"} 
                size={32} 
                strokeWidth={2}
              />
            </View>
            <Text style={[
              styles.cardTitle,
              selectedType === "warehouse" && styles.cardTitleSelected
            ]}>
              WAREHOUSE
            </Text>
            <Text style={[
              styles.cardSubtitle,
              selectedType === "warehouse" && styles.cardSubtitleSelected
            ]}>
              {nearestWarehouse
                ? `${nearestWarehouse.name}${nearestWarehouse.distanceDisplay ? ` • ${nearestWarehouse.distanceDisplay}` : ""}`
                : backendLoading
                  ? "Loading..."
                  : "No locations"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.locationCard,
              selectedType === "darkstore" && styles.locationCardSelected,
              darkstores.length === 0 && styles.locationCardDisabled,
            ]}
            onPress={() => openTypeDrawer("darkstore")}
            activeOpacity={darkstores.length === 0 ? 1 : 0.7}
            disabled={darkstores.length === 0}
          >
            <View style={[
              styles.iconContainer,
              selectedType === "darkstore" && styles.iconContainerSelected
            ]}>
              <Store 
                color={selectedType === "darkstore" ? "#FFFFFF" : "#6B7280"} 
                size={32} 
                strokeWidth={2}
              />
            </View>
            <Text style={[
              styles.cardTitle,
              selectedType === "darkstore" && styles.cardTitleSelected
            ]}>
              DARKSTORE
            </Text>
            <Text style={[
              styles.cardSubtitle,
              selectedType === "darkstore" && styles.cardSubtitleSelected
            ]}>
              {nearestDarkstore
                ? `${nearestDarkstore.name}${nearestDarkstore.distanceDisplay ? ` • ${nearestDarkstore.distanceDisplay}` : ""}`
                : backendLoading
                  ? "Loading..."
                  : "No locations"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            loading={loading}
          />
        </View>
      </ScrollView>

      <Modal
        visible={drawerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerVisible(false)} />
          <View style={styles.drawerSheet}>
            <View style={styles.drawerHandle} />
            <Text style={styles.drawerTitle}>
              {selectedType === "warehouse" ? "Warehouse Options" : "Darkstore Options"}
            </Text>
            <Text style={styles.drawerSubtitle}>
              Data is loaded from dashboard master data.
            </Text>

            <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
              {drawerItems.length > 0 ? (
                drawerItems.map((item) => (
                  <View key={item.locationId} style={styles.drawerItem}>
                    <View style={styles.drawerItemText}>
                      <Text style={styles.drawerItemTitle}>{item.name}</Text>
                      <Text style={styles.drawerItemMeta} numberOfLines={2}>
                        {[item.address, item.city, item.state].filter(Boolean).join(", ") || "Address not available"}
                      </Text>
                    </View>
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{item.distanceDisplay || "—"}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.drawerEmpty}>No data found for this type.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  mapBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: "#E5E7EB",
    overflow: 'hidden',
  },
  mapView: {
    width: '100%',
    height: '100%',
    minHeight: 200,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    pointerEvents: 'none',
  },
  scrollView: {
    flex: 1,
    marginTop: height * 0.20,
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px -4px 12px rgba(0, 0, 0, 0.1)', elevation: 12 }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 12 }
    ),
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 22,
  },
  nearestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backendError: {
    fontSize: 12,
    color: "#DC2626",
    marginBottom: 12,
  },
  nearestIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  nearestInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nearestTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  nearestLocation: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  travelInfo: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  travelLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  travelTime: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6366F1",
  },
  cardsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  locationCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  locationCardDisabled: {
    opacity: 0.45,
  },
  drawerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "58%",
  },
  drawerHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  drawerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 12,
  },
  drawerList: {
    maxHeight: 320,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#F9FAFB",
  },
  drawerItemText: {
    flex: 1,
    marginRight: 12,
  },
  drawerItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  drawerItemMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  drawerBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  drawerBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
  },
  drawerEmpty: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 20,
  },
  locationCardSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconContainerSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  cardTitleSelected: {
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  cardSubtitleSelected: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 20,
  },
});
