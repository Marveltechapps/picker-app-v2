import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { User, Zap, Bell } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useColors } from "@/contexts/ColorsContext";
import { IconSizes, Typography, Spacing } from "@/constants/theme";
import { getSafeImageSource } from "@/utils/imageUriValidator";

export default function AppHeader() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userProfile, phoneNumber, unreadCount } = useAuth();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [userProfile?.photoUri]);

  const showAvatar = userProfile?.photoUri && !avatarLoadFailed && getSafeImageSource(userProfile.photoUri);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, paddingTop: Math.max(insets.top, Spacing.lg) }]}>
      <View style={styles.headerLeft}>
        {showAvatar ? (
          <Image
            source={getSafeImageSource(userProfile!.photoUri)!}
            style={styles.profileImage}
            onError={() => setAvatarLoadFailed(true)}
          />
        ) : (
          <View style={[styles.profileIcon, { backgroundColor: colors.primary[200] }]}>
            <User color={colors.primary[600]} size={IconSizes.md} strokeWidth={2.5} />
          </View>
        )}
        <View>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            {userProfile?.name?.trim() || "User"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.text.secondary }]}>
            ID: {phoneNumber ? phoneNumber.slice(-6) : "------"}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <Zap color={colors.secondary[400]} size={IconSizes.md} strokeWidth={2} fill={colors.secondary[400]} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => {
            try {
              router.push("/notifications");
            } catch {
              // Silently handle navigation error
            }
          }}
          activeOpacity={0.7}
        >
          <Bell color={colors.text.secondary} size={IconSizes.md} strokeWidth={2} />
          {unreadCount > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: 0,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  profileIcon: {
    width: Spacing["4xl"],
    height: Spacing["4xl"],
    borderRadius: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: Spacing["4xl"],
    height: Spacing["4xl"],
    borderRadius: Spacing.xl,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold as "600",
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium as "500",
    marginTop: Spacing.xs / 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
  },
  notificationDot: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
});
