import { Pressable } from "@/utils/touchables";
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "./BottomSheetModal";
import {
  Check,
  MapPin,
  Shield,
  Clock,
  Building2,
  Fingerprint,
  Camera,
  User,
  ChevronLeft,
} from "lucide-react-native";
import { Colors } from "@/constants/theme";

interface ShiftSuccessSheetProps {
  visible: boolean;
  verificationMethod: "face" | "fingerprint";
  userName: string;
  locationLabel: string;
  darkstoreName?: string;
  shiftLabel?: string;
  onStartWork: () => void;
  startWorkLoading?: boolean;
  onClose: () => void;
  onBack: () => void;
}

function DetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <View style={styles.detailIcon}>{icon}</View>
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export default function ShiftSuccessSheet({
  visible,
  verificationMethod,
  userName,
  locationLabel,
  darkstoreName,
  shiftLabel,
  onStartWork,
  startWorkLoading = false,
  onClose,
  onBack,
}: ShiftSuccessSheetProps) {
  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const methodLabel =
    verificationMethod === "face" ? "Face Recognition" : "Fingerprint Scan";
  const MethodIcon = verificationMethod === "face" ? Camera : Fingerprint;
  const storeLabel = darkstoreName?.trim() || "Assigned darkstore";

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Shift Ready"
      height="92%"
      placement="top"
      hideHeader
      scrollable
      onBack={onBack}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={["#10B981", "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={onBack}
              style={styles.navChip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft color="#FFFFFF" size={22} strokeWidth={2.5} />
            </Pressable>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>ALL STEPS COMPLETE</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.navChip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeChipText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.heroIconWrap}>
            <Check color="#FFFFFF" size={36} strokeWidth={3} />
          </View>
          <Text style={styles.heroTitle}>Shift ready</Text>
          <Text style={styles.heroSubtitle}>
            Location and identity verified. Review your details below, then start your shift.
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconWrap}>
              <User color="#10B981" size={22} strokeWidth={2.5} />
            </View>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeLabel}>Picker</Text>
              <Text style={styles.welcomeName}>{userName}</Text>
            </View>
            <View style={styles.verifiedPill}>
              <Check color="#10B981" size={14} strokeWidth={3} />
              <Text style={styles.verifiedPillText}>Verified</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Shift details</Text>
            <DetailRow
              icon={<Clock color="#10B981" size={18} strokeWidth={2} />}
              label="Shift"
              value={shiftLabel || "Assigned shift"}
            />
            <View style={styles.divider} />
            <DetailRow
              icon={<Clock color="#10B981" size={18} strokeWidth={2} />}
              label="Ready at"
              value={getCurrentTime()}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Location verification</Text>
            <DetailRow
              icon={<Building2 color="#10B981" size={18} strokeWidth={2} />}
              label="Darkstore"
              value={storeLabel}
            />
            <View style={styles.divider} />
            <DetailRow
              icon={<MapPin color="#10B981" size={18} strokeWidth={2} />}
              label="Your location"
              value={locationLabel || "Location confirmed"}
            />
            <View style={styles.divider} />
            <View style={styles.statusRow}>
              <Shield color="#10B981" size={18} strokeWidth={2} />
              <Text style={styles.statusText}>Location verified</Text>
              <Check color="#10B981" size={16} strokeWidth={3} />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Identity verification</Text>
            <DetailRow
              icon={<MethodIcon color="#10B981" size={18} strokeWidth={2} />}
              label="Method"
              value={methodLabel}
            />
            <View style={styles.divider} />
            <View style={styles.statusRow}>
              <Shield color="#10B981" size={18} strokeWidth={2} />
              <Text style={styles.statusText}>Identity verified</Text>
              <Check color="#10B981" size={16} strokeWidth={3} />
            </View>
          </View>

          <View style={styles.summaryBanner}>
            <Text style={styles.summaryLabel}>You are cleared to start</Text>
            <Text style={styles.summaryText}>
              Tap Start Work to punch in and begin picking orders at {storeLabel}.
            </Text>
          </View>

          <Pressable
            style={[styles.startWorkButton, startWorkLoading && styles.startWorkButtonDisabled]}
            onPress={onStartWork}
            disabled={startWorkLoading}
            accessibilityRole="button"
            accessibilityLabel="Start Work"
            accessibilityState={{ disabled: startWorkLoading }}
          >
            {startWorkLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.startWorkButtonText}>Start Work</Text>
            )}
          </Pressable>
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
    alignItems: "center",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
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
  navChip: {
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
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 21,
    textAlign: "center",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 14,
  },
  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  welcomeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeContent: {
    flex: 1,
    minWidth: 0,
  },
  welcomeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  welcomeName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verifiedPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  detailRow: {
    gap: 8,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 22,
    paddingLeft: 42,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 2,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
  summaryBanner: {
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#065F46",
    lineHeight: 21,
  },
  startWorkButton: {
    minHeight: 52,
    width: "100%",
    backgroundColor: Colors.primary[650],
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    ...(Platform.OS === "web" ? { cursor: "pointer" as const } : {}),
  },
  startWorkButtonDisabled: {
    opacity: 0.7,
  },
  startWorkButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
