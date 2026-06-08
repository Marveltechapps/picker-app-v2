import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Phone, Mail, Calendar, MessageCircle, User, MapPin, FileText } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/state/authContext";
import Header from "@/components/Header";
import { Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import { appNotify } from "@/utils/appNotify";
import { getProfileApi } from "@/services/user.service";
import { getProfileOverviewApi } from "@/services/profileOverview.service";
import { buildLoginContactCards } from "@/utils/contactDisplay";

const CONTACT_ICONS = {
  email: Mail,
  phone: Phone,
  mobile: Phone,
  whatsapp: MessageCircle,
} as const;

const CONTACT_COLORS = {
  email: { bg: "#FEF3C7", icon: "#FACC15" },
  phone: { bg: "#DCFCE7", icon: "#10B981" },
  mobile: { bg: "#DCFCE7", icon: "#10B981" },
  whatsapp: { bg: "#DCFCE7", icon: "#10B981" },
} as const;

export default function PersonalInformationScreen() {
  const router = useRouter();
  const { phoneNumber, loginMethod, loginCountryCode, userProfile } = useAuth();
  const colors = useColors();
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profileLoginMethod, setProfileLoginMethod] = useState(loginMethod);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [profileGender, setProfileGender] = useState<string | null>(null);
  const [profileLocationType, setProfileLocationType] = useState<string | null>(null);
  const [documentsSummary, setDocumentsSummary] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [data, overview] = await Promise.all([
            getProfileApi({ bypassCache: true }),
            getProfileOverviewApi({ sync: true }).catch(() => null),
          ]);
          if (!active) return;
          if (data) {
            setProfilePhone(data.phone ?? null);
            setProfileEmail(data.email ?? null);
            if (data.loginMethod) setProfileLoginMethod(data.loginMethod);
            setProfileName(data.name?.trim() || null);
            setProfileAge(typeof data.age === "number" ? data.age : null);
            setProfileGender(data.gender ?? null);
            setProfileLocationType(data.locationType ?? null);
          }
          if (overview) {
            const { aadhar, pan } = overview.documentDetails;
            const docStatus = (status: string) =>
              status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            const parts = [
              aadhar.status !== "not_uploaded" ? `Aadhaar: ${docStatus(aadhar.status)}` : null,
              pan.status !== "not_uploaded" ? `PAN: ${docStatus(pan.status)}` : null,
            ].filter(Boolean);
            setDocumentsSummary(parts.length > 0 ? parts.join(" · ") : "No documents uploaded");
            if (!data?.locationType && overview.picker.locationType) {
              setProfileLocationType(overview.picker.locationType);
            }
          }
        } catch {
          /* keep auth context values */
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

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

  const contactCards = useMemo(
    () =>
      buildLoginContactCards({
        loginMethod: profileLoginMethod ?? loginMethod,
        phone: profilePhone ?? phoneNumber,
        email: profileEmail ?? userProfile?.email,
        countryCode: loginCountryCode,
      }),
    [
      profileLoginMethod,
      loginMethod,
      profilePhone,
      phoneNumber,
      profileEmail,
      userProfile?.email,
      loginCountryCode,
    ]
  );

  const handleEditInfo = () => {
    try {
      router.push("/edit-profile");
    } catch {
      try {
        router.replace("/edit-profile");
      } catch {
        try {
          appNotify.error("Unable to open edit screen. Please try again.");
        } catch {
          /* no-op */
        }
      }
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollView: {
          flex: 1,
        },
        content: {
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing["2xl"],
          paddingBottom: Spacing["2xl"],
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
      }),
    [colors]
  );

  const formatGender = (value: string | null) => {
    if (!value) return null;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const formatLocationType = (value: string | null) => {
    if (!value) return null;
    return value
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const profileCards = [
    profileName
      ? { key: "name", label: "Full Name", value: profileName, Icon: User, bgColor: "#EEEEF5", iconColor: "#121358" }
      : null,
    profileAge != null
      ? { key: "age", label: "Age", value: String(profileAge), Icon: User, bgColor: "#F0F0F7", iconColor: "#121358" }
      : null,
    profileGender
      ? {
          key: "gender",
          label: "Gender",
          value: formatGender(profileGender) ?? profileGender,
          Icon: User,
          bgColor: "#E4E5F0",
          iconColor: "#121358",
        }
      : null,
    profileLocationType
      ? {
          key: "location",
          label: "Work Location",
          value: formatLocationType(profileLocationType) ?? profileLocationType,
          Icon: MapPin,
          bgColor: "#DCFCE7",
          iconColor: "#10B981",
        }
      : null,
    documentsSummary
      ? {
          key: "documents",
          label: "Documents",
          value: documentsSummary,
          Icon: FileText,
          bgColor: "#FFEDD5",
          iconColor: "#F97316",
        }
      : null,
  ].filter((card): card is NonNullable<typeof card> => card !== null);

  const allCards = [
    ...profileCards,
    ...contactCards.map((card) => {
      const palette = CONTACT_COLORS[card.key as keyof typeof CONTACT_COLORS] ?? CONTACT_COLORS.mobile;
      const Icon = CONTACT_ICONS[card.key as keyof typeof CONTACT_ICONS] ?? Phone;
      return {
        ...card,
        Icon,
        bgColor: palette.bg,
        iconColor: palette.icon,
      };
    }),
    {
      key: "joining",
      label: "Joining Date",
      value: joiningDate,
      Icon: Calendar,
      bgColor: "#FFEDD5",
      iconColor: "#F97316",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Personal Information" subtitle="Contact details & location" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {allCards.map((card, index) => (
          <View key={card.key} style={[styles.infoCard, index === 0 && styles.firstCard]}>
            <View style={[styles.iconWrapper, { backgroundColor: card.bgColor }]}>
              <card.Icon color={card.iconColor} size={24} strokeWidth={2} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{card.label}</Text>
              <Text style={styles.infoValue}>{card.value}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={handleEditInfo}>
          <Text style={styles.editButtonText}>Edit Information</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
