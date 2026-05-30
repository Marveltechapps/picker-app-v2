import React from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import { Check, X } from "lucide-react-native";

// Safely get screen dimensions (may not be available in Expo Go initially)
const getScreenDimensions = () => {
  try {
    const { width } = Dimensions.get("window");
    return { isMobile: Platform.OS !== 'web' && width < 768 };
  } catch (error) {
    // Fallback if Dimensions not available
    return { isMobile: true };
  }
};

const { isMobile } = getScreenDimensions();

export interface ChecklistItem {
  label: string;
  status: boolean;
}

interface VerificationChecklistProps {
  items: ChecklistItem[];
}

export default function VerificationChecklist({ items }: VerificationChecklistProps) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={index} style={styles.item}>
          <View style={[styles.iconContainer, item.status && styles.iconContainerActive]}>
            {item.status ? (
              <Check color="#10B981" size={18} strokeWidth={2.5} />
            ) : (
              <X color="#EF4444" size={18} strokeWidth={2.5} />
            )}
          </View>
          <Text style={[styles.label, item.status && styles.labelActive]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: isMobile ? 12 : 16, // Tighter gap on mobile
    width: '100%',
    maxWidth: 400, // Limit width for better centering
    alignSelf: 'center', // Center the container
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: isMobile ? 10 : 12, // Tighter gap on mobile
  },
  iconContainer: {
    width: isMobile ? 24 : 28, // Smaller icon on mobile
    height: isMobile ? 24 : 28,
    borderRadius: isMobile ? 12 : 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerActive: {
    backgroundColor: "#D1FAE5",
  },
  label: {
    fontSize: isMobile ? 14 : 15, // Smaller font on mobile
    fontWeight: "500",
    color: "#6B7280",
    flex: 1, // Allow text to wrap
  },
  labelActive: {
    color: "#111827",
    fontWeight: "600",
  },
});
