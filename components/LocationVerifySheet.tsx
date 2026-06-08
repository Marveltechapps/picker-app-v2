import { Pressable } from "@/utils/touchables";
/**
 * LocationVerifySheet — shift start step 1: darkstore geofence verification.
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "./BottomSheetModal";
import {
  MapPin,
  Check,
  Building2,
  Navigation,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  LocateFixed,
} from "lucide-react-native";
import { useLocation } from "@/state/locationContext";
import { useVerifyLocation } from "@/hooks/useVerifyLocation";
import {
  getWorkLocationCurrent,
  type WorkLocationCurrent,
} from "@/services/location.service";
import { SHIFT_GEOFENCE_RADIUS_M } from "@/constants/locationVerification";
import { LOCATION_TIMEOUT_MS } from "@/utils/locationService";
import { distanceMetersToPoint } from "@/utils/googleMapsLocation";

interface LocationVerifySheetProps {
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

function formatCoords(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "Not available";
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function formatLocationType(type: string | null | undefined): string {
  if (!type?.trim()) return "Darkstore";
  return type
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function LocationVerifySheet({ visible, onSuccess, onClose }: LocationVerifySheetProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const {
    getFormattedAddress,
    getAccuracyDisplay,
    currentLocation,
    locationPermission,
    refreshLocation,
  } = useLocation();

  const {
    state: verificationState,
    error: verificationError,
    isVerifying,
    triggerVerification,
    resetVerification,
  } = useVerifyLocation({
    onError: (error) => {
      console.warn("[LocationVerifySheet] Verification error:", error);
    },
    timeoutMs: LOCATION_TIMEOUT_MS,
  });

  const animationRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocationCurrent | null>(null);
  const [locationRefreshing, setLocationRefreshing] = useState(false);

  useEffect(() => {
    if (!visible) {
      setWorkLocation(null);
      return;
    }
    void getWorkLocationCurrent().then(setWorkLocation);
    setLocationRefreshing(true);
    void refreshLocation().finally(() => setLocationRefreshing(false));
  }, [visible, refreshLocation]);

  useEffect(() => {
    if (!visible) {
      resetVerification();
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      pulseAnim.stopAnimation();
      return;
    }

    resetVerification();
  }, [visible, resetVerification, pulseAnim]);

  useEffect(() => {
    if (!isVerifying) {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      pulseAnim.stopAnimation();
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    animation.start();
    animationRef.current = animation;

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      pulseAnim.stopAnimation();
    };
  }, [isVerifying, pulseAnim]);

  const handleVerifyPress = () => {
    void triggerVerification();
  };

  const handleRetry = () => {
    resetVerification();
    void triggerVerification();
  };

  const handleContinue = () => {
    onSuccess();
  };

  const hubLabel = workLocation?.hubName?.trim() || "Your darkstore";
  const addressLabel =
    workLocation?.address?.trim() || getFormattedAddress() || "Address loading…";
  const locationTypeLabel = formatLocationType(workLocation?.locationType);
  const hubCoords = formatCoords(workLocation?.latitude, workLocation?.longitude);
  const currentCoords = formatCoords(
    currentLocation?.latitude,
    currentLocation?.longitude
  );
  const currentAddress = getFormattedAddress() || "Detecting your address…";
  const permissionLabel =
    locationPermission === "granted"
      ? "Granted"
      : locationPermission === "denied"
        ? "Denied"
        : "Not granted";

  const distanceFromHub =
    currentLocation?.latitude != null &&
    currentLocation?.longitude != null &&
    workLocation?.latitude != null &&
    workLocation?.longitude != null
      ? `${Math.round(
          distanceMetersToPoint(
            currentLocation.latitude,
            currentLocation.longitude,
            workLocation.latitude!,
            workLocation.longitude!
          )
        )}m`
      : "Calculating…";

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Location Verification"
      height="92%"
      placement="top"
      hideHeader
      scrollable
      closeOnBackdropPress={verificationState !== "verifying"}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={["#121358", "#121358"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 1 OF 2</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeChip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeChipText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>Verify your location</Text>
          <Text style={styles.heroSubtitle}>
            Review your darkstore details below, then confirm you are on-site before continuing.
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.hubCard}>
            <View style={styles.hubIconWrap}>
              <Building2 color="#121358" size={22} strokeWidth={2} />
            </View>
            <View style={styles.hubContent}>
              <Text style={styles.hubLabel}>Assigned darkstore</Text>
              <Text style={styles.hubName}>{hubLabel}</Text>
              <View style={styles.hubAddressRow}>
                <MapPin color="#9CA3AF" size={14} strokeWidth={2} />
                <Text style={styles.hubAddress}>{addressLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.detailsCardTitle}>Darkstore details</Text>
            <DetailRow label="Location type" value={locationTypeLabel} />
            <DetailRow label="Store GPS" value={hubCoords} />
            <DetailRow
              label="Geofence"
              value={`Within ${SHIFT_GEOFENCE_RADIUS_M}m of store GPS`}
            />
            {workLocation?.hubId ? (
              <DetailRow label="Store ID" value={workLocation.hubId} />
            ) : null}
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailsCardHeader}>
              <Text style={styles.detailsCardTitle}>Your current position</Text>
              {locationRefreshing ? (
                <ActivityIndicator size="small" color="#121358" />
              ) : null}
            </View>
            <DetailRow label="Your address" value={currentAddress} />
            <DetailRow label="Your GPS" value={currentCoords} />
            <DetailRow label="GPS accuracy" value={getAccuracyDisplay()} />
            <DetailRow label="Distance to store" value={distanceFromHub} />
            <DetailRow label="Location access" value={permissionLabel} />
          </View>

          <View style={styles.geofencePill}>
            <Navigation color="#121358" size={16} strokeWidth={2.5} />
            <Text style={styles.geofenceText}>
              Must be within {SHIFT_GEOFENCE_RADIUS_M}m of darkstore GPS
            </Text>
          </View>

          {isVerifying ? (
            <View style={styles.statusCard}>
              <Animated.View style={[styles.verifyRing, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.verifyRingInner}>
                  <MapPin color="#121358" size={36} strokeWidth={2.5} />
                </View>
              </Animated.View>
              <Text style={styles.statusTitle}>Checking GPS position…</Text>
              <Text style={styles.statusSubtitle}>
                Stand near the store entrance for the best signal. This usually takes a few seconds.
              </Text>
              <ActivityIndicator size="small" color="#121358" style={styles.spinner} />
            </View>
          ) : verificationState === "resolved" ? (
            <View style={[styles.statusCard, styles.statusCardSuccess]}>
              <View style={styles.successIconWrap}>
                <Check color="#FFFFFF" size={32} strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>Location verified</Text>
              <Text style={styles.successSubtitle}>You are at {hubLabel}</Text>

              <View style={styles.metricsGrid}>
                <View style={styles.metricTile}>
                  <ShieldCheck color="#10B981" size={18} strokeWidth={2} />
                  <Text style={styles.metricLabel}>GPS accuracy</Text>
                  <Text style={styles.metricValueGreen}>{getAccuracyDisplay()}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricTile}>
                  <MapPin color="#121358" size={18} strokeWidth={2} />
                  <Text style={styles.metricLabel}>Distance</Text>
                  <Text style={styles.metricValueBlue}>{distanceFromHub}</Text>
                </View>
              </View>

              <View style={styles.nextStepBanner}>
                <Text style={styles.nextStepLabel}>Up next</Text>
                <Text style={styles.nextStepText}>Identity verification (Step 2 of 2)</Text>
              </View>

              <Pressable style={styles.primaryButton} onPress={handleContinue}>
                <Text style={styles.primaryButtonText}>Continue to identity verification</Text>
                <ChevronRight color="#FFFFFF" size={20} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : verificationState === "failed" ? (
            <View style={[styles.statusCard, styles.statusCardError]}>
              <View style={styles.errorIconWrap}>
                <AlertCircle color="#FFFFFF" size={32} strokeWidth={2.5} />
              </View>
              <Text style={styles.errorTitle}>Could not verify location</Text>
              <Text style={styles.errorMessage}>
                {verificationError || "Unable to confirm you are within the darkstore geofence."}
              </Text>
              <Text style={styles.errorHint}>
                Enable location, move outdoors or closer to the entrance, and ensure GPS accuracy is
                under 200m before retrying.
              </Text>
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <RefreshCw color="#FFFFFF" size={18} strokeWidth={2.5} />
                <Text style={styles.retryButtonText}>Retry verification</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.idleCard}>
              <View style={styles.idleIconWrap}>
                <LocateFixed color="#121358" size={28} strokeWidth={2.5} />
              </View>
              <Text style={styles.idleTitle}>Ready to verify</Text>
              <Text style={styles.idleSubtitle}>
                Check the darkstore and your GPS details above. When you are at the store, tap the
                button below to verify your location.
              </Text>
              <Pressable style={styles.primaryButton} onPress={handleVerifyPress}>
                <MapPin color="#FFFFFF" size={18} strokeWidth={2.5} />
                <Text style={styles.primaryButtonText}>Verify my location</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  stepBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  closeChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeChipText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
    lineHeight: 21,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 14,
  },
  hubCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#121358",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  hubIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
  },
  hubContent: {
    flex: 1,
    minWidth: 0,
  },
  hubLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  hubName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  hubAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  hubAddress: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  detailsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    lineHeight: 20,
  },
  geofencePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#EEEEF5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D8DAEB",
  },
  geofenceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4338CA",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 4,
  },
  statusCardSuccess: {
    borderColor: "#A7F3D0",
    backgroundColor: "#FAFFFE",
  },
  statusCardError: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFBFB",
  },
  idleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 4,
  },
  idleIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  idleSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  verifyRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  verifyRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#D8DAEB",
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  statusSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 12,
  },
  spinner: {
    marginTop: 4,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#059669",
    marginBottom: 6,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  metricsGrid: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  metricTile: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  metricDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValueGreen: {
    fontSize: 15,
    fontWeight: "800",
    color: "#10B981",
  },
  metricValueBlue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#121358",
  },
  nextStepBanner: {
    width: "100%",
    backgroundColor: "#EEEEF5",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D8DAEB",
    marginBottom: 16,
  },
  nextStepLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#121358",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  nextStepText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3730A3",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#121358",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    fontWeight: "400",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#121358",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
