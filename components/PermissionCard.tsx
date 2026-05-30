import React from "react";
import { TouchableOpacity, Text, View, StyleSheet, Platform } from "react-native";
import { ChevronRight, LucideIcon } from "lucide-react-native";
import { PermissionStatus } from "@/state/authContext";
import { Shadows } from "@/constants/theme";

interface PermissionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  status?: PermissionStatus;
  onPress: () => void;
}

export default function PermissionCard({ icon: Icon, title, description, status = "pending", onPress }: PermissionCardProps) {
  const isAllowed = status === "allowed";
  
  return (
    <TouchableOpacity 
      style={[styles.card, isAllowed && styles.cardAllowed]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrapper, isAllowed && styles.iconWrapperAllowed]}>
        <Icon color={isAllowed ? "#10B981" : "#5B4EFF"} size={28} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <ChevronRight color={isAllowed ? "#10B981" : "#9CA3AF"} size={24} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)", elevation: 2 }
      : { ...Shadows.md, shadowOpacity: 0.06 }),
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardAllowed: {
    backgroundColor: "#F0FDF4",
    borderColor: "#10B981",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 12px rgba(16, 185, 129, 0.15)", elevation: 4 }
      : { ...Shadows.lg, shadowColor: "#10B981", shadowOpacity: 0.15 }),
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperAllowed: {
    backgroundColor: "#D1FAE5",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  description: {
    fontSize: 14,
    fontWeight: "400",
    color: "#6B7280",
    lineHeight: 20,
  },
});
