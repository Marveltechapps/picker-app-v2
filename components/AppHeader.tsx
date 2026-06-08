import React, { useState, useEffect } from "react";

import { View, Text, StyleSheet, Image, Platform } from "react-native";

import { TouchableOpacity } from "@/utils/touchables";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { User, Zap, Bell } from "lucide-react-native";

import { useAuth } from "@/state/authContext";

import { IconSizes, Typography, Spacing, ShellColors, SHELL_BAR_MIN_HEIGHT } from "@/constants/theme";

import { getSafeImageSource } from "@/utils/imageUriValidator";
import { getLoginContactLine } from "@/utils/contactDisplay";



function AppHeader() {

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const { userProfile, phoneNumber, loginMethod, loginCountryCode, unreadCount } = useAuth();

  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const contactLine = getLoginContactLine({
    loginMethod,
    phone: phoneNumber,
    email: userProfile?.email,
    countryCode: loginCountryCode,
  });



  useEffect(() => {

    setAvatarLoadFailed(false);

  }, [userProfile?.photoUri]);



  const showAvatar = userProfile?.photoUri && !avatarLoadFailed && getSafeImageSource(userProfile.photoUri);



  return (

    <View

      style={[

        styles.headerShell,

        {

          paddingTop: Math.max(insets.top, Spacing.lg) + Spacing.md,

          paddingBottom: Spacing.lg,

          minHeight: SHELL_BAR_MIN_HEIGHT,

        },

      ]}

    >

      <View style={styles.headerLeft}>

        {showAvatar ? (

          <Image

            source={getSafeImageSource(userProfile!.photoUri)!}

            style={styles.profileImage}

            onError={() => setAvatarLoadFailed(true)}

          />

        ) : (

          <View style={styles.profileIcon}>

            <User color={ShellColors.accent} size={IconSizes.md} strokeWidth={2.5} />

          </View>

        )}

        <View>

          <Text style={styles.headerTitle}>

            {userProfile?.name?.trim() || "User"}

          </Text>

          {contactLine ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {contactLine}
            </Text>
          ) : null}

        </View>

      </View>

      <View style={styles.headerRight}>

        <TouchableOpacity

          style={styles.headerIconBtn}

          activeOpacity={0.7}

          accessibilityRole="button"

          accessibilityLabel="Overtime details"

          onPress={() => {

            try {

              router.push({

                pathname: "/(tabs)/attendance",

                params: { tab: "ot" },

              });

            } catch {

              // Silently handle navigation error

            }

          }}

        >

          <Zap color="#FDE68A" size={IconSizes.md} strokeWidth={2} fill="#FDE68A" />

        </TouchableOpacity>

        <TouchableOpacity

          style={styles.headerIconBtn}

          onPress={() => {

            try {

              router.push("/notifications");

            } catch {

              // Silently handle navigation error

            }

          }}

          activeOpacity={0.7}

        >

          <Bell color={ShellColors.onBrandMuted} size={IconSizes.md} strokeWidth={2} />

          {unreadCount > 0 && <View style={styles.notificationDot} />}

        </TouchableOpacity>

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  headerShell: {

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    paddingHorizontal: Spacing.xl,

    backgroundColor: ShellColors.brand,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: ShellColors.border,

    ...Platform.select({

      ios: {

        shadowColor: ShellColors.accentDark,

        shadowOffset: { width: 0, height: 2 },

        shadowOpacity: 0.1,

        shadowRadius: 5,

      },

      android: {

        elevation: 3,

      },

      web: {

        boxShadow: "0 2px 6px rgba(156, 163, 175, 0.18)",

      },

    }),

  },

  headerLeft: {

    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,

  },

  profileIcon: {

    width: 42,

    height: 42,

    borderRadius: 21,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: ShellColors.brandLight,

    borderWidth: 1,

    borderColor: ShellColors.border,

  },

  profileImage: {

    width: 42,

    height: 42,

    borderRadius: 21,

    borderWidth: 2,

    borderColor: ShellColors.border,

  },

  headerTitle: {

    fontSize: Typography.fontSize.xl,

    fontWeight: Typography.fontWeight.bold as "600",

    color: ShellColors.onBrand,

  },

  headerSubtitle: {

    fontSize: Typography.fontSize.base,

    fontWeight: Typography.fontWeight.medium as "500",

    marginTop: Spacing.xs / 2,

    color: ShellColors.onBrandMuted,

    maxWidth: 200,

  },

  headerRight: {

    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,

  },

  headerIconBtn: {

    width: 40,

    height: 40,

    borderRadius: 20,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: ShellColors.iconBg,

    borderWidth: 1,

    borderColor: ShellColors.border,

    position: "relative" as const,

  },

  notificationDot: {

    position: "absolute" as const,

    top: 8,

    right: 8,

    width: 8,

    height: 8,

    borderRadius: 4,

    backgroundColor: "#EF4444",

    borderWidth: 1,

    borderColor: ShellColors.brand,

  },

});



export default React.memo(AppHeader);

