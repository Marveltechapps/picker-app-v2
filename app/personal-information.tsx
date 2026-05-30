import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Phone, Mail, Calendar } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/state/authContext";
import Header from "@/components/Header";
import { Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import { appNotify } from "@/utils/appNotify";

export default function PersonalInformationScreen() {
  const router = useRouter();
  const { phoneNumber, userProfile } = useAuth();
  const colors = useColors();

  const formatJoiningDate = (createdAt: string | undefined): string => {
    if (!createdAt) return "—";
    try {
      const d = new Date(createdAt);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "—";
    }
  };

  const joiningDate = formatJoiningDate(userProfile?.createdAt);

  const handleEditInfo = () => {
    try {
      router.push("/edit-profile");
    } catch (error) {
      // If push fails, try replace
      try {
        router.replace("/edit-profile");
      } catch {
        // If both fail, show error to user
        try {
          appNotify.error("Unable to open edit screen. Please try again.");
        } catch {
          // Silently handle alert error
        }
      }
    }
  };

  const infoCards = [
    {
      icon: Phone,
      label: "Phone",
      value: phoneNumber || "—",
      bgColor: "#DCFCE7",
      iconColor: "#10B981",
    },
    {
      icon: Mail,
      label: "Email",
      value: userProfile?.email || "—",
      bgColor: "#FEF3C7",
      iconColor: "#FACC15",
    },
    {
      icon: Calendar,
      label: "Joining Date",
      value: joiningDate,
      bgColor: "#FFEDD5",
      iconColor: "#F97316",
    },
  ];

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['2xl'],
    },
    infoCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      marginBottom: Spacing.lg,
      ...Shadows.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    firstCard: {
      marginTop: 20,
    },
    iconWrapper: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.lg,
    },
    infoTextContainer: {
      flex: 1,
    },
    infoLabel: {
      fontSize: Typography.fontSize.md,
      fontWeight: Typography.fontWeight.regular,
      color: colors.text.tertiary,
      marginBottom: Spacing.xs,
    },
    infoValue: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    editButton: {
      backgroundColor: colors.primary[500],
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.lg,
    },
    editButtonText: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.white,
    },
  }), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Personal Information" subtitle="Contact details & location" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {infoCards.map((card, index) => (
          <View key={index} style={[styles.infoCard, index === 0 && styles.firstCard]}>
            <View style={[styles.iconWrapper, { backgroundColor: card.bgColor }]}>
              <card.icon color={card.iconColor} size={24} strokeWidth={2} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{card.label}</Text>
              <Text style={styles.infoValue}>{card.value}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.editButton}
          activeOpacity={0.7}
          onPress={handleEditInfo}
          disabled={false}
        >
          <Text style={styles.editButtonText}>Edit Information</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
