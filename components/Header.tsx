import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, LucideIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Typography, Spacing, IconSizes } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightIcon?: LucideIcon;
  onRightPress?: () => void;
  rightIconColor?: string;
}

export default function Header({
  title,
  subtitle,
  showBack = true,
  onBackPress,
  rightIcon: RightIcon,
  onRightPress,
  rightIconColor,
}: HeaderProps) {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const defaultRightIconColor = rightIconColor || colors.text.primary;
  const statusBarStyle = "dark-content" as const;
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xl,
      paddingTop: Math.max(insets.top, Spacing.lg),
      paddingBottom: Spacing.xl,
      backgroundColor: colors.card,
    },
    backButton: {
      width: Spacing.iconButton,
      height: Spacing.iconButton,
      alignItems: "center",
      justifyContent: "center",
    },
    titleContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.sm,
      height: 48,
    },
    title: {
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text.primary,
      letterSpacing: Typography.letterSpacing.normal,
      textAlign: "center",
    },
    subtitle: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.regular,
      color: colors.text.secondary,
      marginTop: Spacing.xs,
      textAlign: "center",
    },
    rightButton: {
      width: Spacing.iconButton,
      height: Spacing.iconButton,
      alignItems: "center",
      justifyContent: "center",
    },
  }), [colors, insets.top]);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      try {
        if (router.canGoBack()) {
          router.back();
        } else {
          // If no back history, navigate to root (backend-driven)
          router.push("/");
        }
      } catch (error) {
        // Silently handle navigation error
        try {
          router.push("/");
        } catch {
          // Fallback failed
        }
      }
    }
  };

  return (
    <>
      <StatusBar 
        barStyle={statusBarStyle} 
        backgroundColor={colors.card}
      />
      <View style={styles.container}>
        {showBack ? (
          <Pressable style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]} onPress={handleBackPress}>
            <ChevronLeft color={colors.text.primary} size={IconSizes.xl} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {RightIcon ? (
          <Pressable style={({ pressed }) => [styles.rightButton, pressed && { opacity: 0.7 }]} onPress={onRightPress}>
            <RightIcon color={defaultRightIconColor} size={24} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.rightButton} />
        )}
      </View>
    </>
  );
}
