import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import { Check, MapPin, Shield, Clock } from "lucide-react-native";
import { Colors } from "@/constants/theme";

interface ShiftSuccessSheetProps {
  visible: boolean;
  verificationMethod: "face" | "fingerprint";
  userName: string;
  locationLabel: string;
  shiftLabel?: string;
  onStartWork: () => void;
  startWorkLoading?: boolean;
  onClose: () => void;
  onBack: () => void;
}

export default function ShiftSuccessSheet({ 
  visible, 
  verificationMethod, 
  userName,
  locationLabel,
  shiftLabel,
  onStartWork, 
  startWorkLoading = false,
  onClose, 
  onBack 
}: ShiftSuccessSheetProps) {
  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: true 
    });
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Shift Ready" height="85%" onBack={onBack}>
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.content} pointerEvents="box-none">
          <View style={styles.successIconContainer}>
            <View style={styles.successIcon}>
              <Check color="#10B981" size={30} strokeWidth={3} />
            </View>
          </View>

          <Text style={styles.title}>Welcome {userName}!</Text>
          <Text style={styles.subtitle}>You&apos;re verified and ready to start your shift.</Text>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.detailIcon}>
                  <MapPin color="#10B981" size={20} strokeWidth={2} />
                </View>
                <Text style={styles.detailLabel}>Location</Text>
              </View>
              <View style={styles.detailValueWrap}>
                <Text
                  style={styles.detailValue}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {locationLabel}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.detailIcon}>
                  <Shield color="#10B981" size={20} strokeWidth={2} />
                </View>
                <Text style={styles.detailLabel}>Verification</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Check color="#10B981" size={16} strokeWidth={2.5} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={styles.detailIcon}>
                  <Clock color="#10B981" size={20} strokeWidth={2} />
                </View>
                <Text style={styles.detailLabel}>{shiftLabel ? "Shift" : "Time"}</Text>
              </View>
              <Text style={styles.detailValue}>{shiftLabel || getCurrentTime()}</Text>
            </View>
          </View>

          <View style={styles.methodCard}>
            <Text style={styles.methodLabel}>Verification Method</Text>
            <Text style={styles.methodValue}>
              {verificationMethod === "face" ? "Face Recognition" : "Fingerprint Scan"}
            </Text>
          </View>
        </View>

        <View style={styles.footer} pointerEvents="auto" collapsable={false}>
          <TouchableOpacity
            style={[styles.startWorkButton, startWorkLoading && styles.startWorkButtonDisabled]}
            onPress={onStartWork}
            disabled={startWorkLoading}
            activeOpacity={0.8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Start Work"
            accessibilityState={{ disabled: startWorkLoading }}
          >
            {startWorkLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.startWorkButtonText}>Start Work</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: "center",
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#D1FAE5",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  detailValueWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#064E3B",
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
    textAlign: "right",
    width: "100%",
  },
  divider: {
    height: 1,
    backgroundColor: "#A7F3D0",
    marginVertical: 12,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#10B981",
  },
  methodCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#6B7280",
    marginBottom: 4,
  },
  methodValue: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  startWorkButton: {
    minHeight: 52,
    width: "100%",
    backgroundColor: Colors.primary[650],
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
