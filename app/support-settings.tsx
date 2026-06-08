import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableCard, Pressable } from "@/utils/touchables";
import React, { useState, useMemo } from "react";
import { StyleSheet, Text, View, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  HelpCircle,
  MessageCircle,
  Info,
  Bell,
  FileText,
  Shield,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import { useTranslation } from "@/utils/i18n";
import { useColors, ColorsContextValue } from "@/contexts/ColorsContext";
import { setupPushNotificationsComplete } from "@/utils/notificationService";
import { useAuth } from "@/state/authContext";
import { appNotify } from "@/utils/appNotify";

export default function SupportSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const { phoneNumber } = useAuth();
  const [isSettingUpNotifications, setIsSettingUpNotifications] = useState(false);
  const [pushConfirmVisible, setPushConfirmVisible] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const helpItems = [
    {
      icon: HelpCircle,
      title: t("supportSettings.helpItems.faqs"),
      bgColor: "#EEEEF5",
      iconColor: "#121358",
      onPress: () => router.push("/faqs" as any),
    },
    {
      icon: MessageCircle,
      title: t("supportSettings.helpItems.contactSupport"),
      bgColor: "#D1FAE5",
      iconColor: "#10B981",
      onPress: () => router.push("/contact-support" as any),
    },
  ];

  const settingsItems = [
    {
      icon: Info,
      title: t("supportSettings.settingsItems.appVersion"),
      value: "1.2.0",
      bgColor: "#E5E7EB",
      iconColor: "#6B7280",
      isInfo: true,
    },
  ];

  const handlePushNotificationPress = () => {
    setPushConfirmVisible(true);
  };

  const handlePushNo = () => {
    setPushConfirmVisible(false);
  };

  const handlePushYes = async () => {
    if (isSettingUpNotifications) return;
    setPushConfirmVisible(false);
    setIsSettingUpNotifications(true);
    try {
      const result = await setupPushNotificationsComplete(phoneNumber || undefined, true);
      if (result.success) {
        appNotify.success(
          'You will now receive push notifications from Picker Pro.',
          'Push Notifications Enabled'
        );
      } else {
        appNotify.error(
          result.error || 'Unable to set up push notifications. Please try again later.',
          'Push Notifications'
        );
      }
    } catch (error) {
      console.error('Error handling push notification press:', error);
      appNotify.error(
        'Something went wrong. Please try again later.',
        'Push Notifications'
      );
    } finally {
      setIsSettingUpNotifications(false);
    }
  };

  const notificationItems = [
    {
      icon: Bell,
      title: t("supportSettings.notificationItems.pushNotifications"),
      bgColor: "#FEE2E2",
      iconColor: "#EF4444",
      onPress: handlePushNotificationPress,
      disabled: isSettingUpNotifications,
    },
  ];

  const aboutItems = [
    {
      icon: FileText,
      title: t("supportSettings.aboutItems.termsConditions"),
      bgColor: "#FEF3C7",
      iconColor: "#FACC15",
      onPress: () => router.push("/terms-conditions" as any),
    },
    {
      icon: Shield,
      title: t("supportSettings.aboutItems.privacyPolicy"),
      bgColor: "#FFEDD5",
      iconColor: "#F97316",
      onPress: () => router.push("/privacy-policy" as any),
    },
  ];

  const renderSection = (title: string, items: any[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <TouchableCard
              style={styles.settingItem}
              activeOpacity={item.isInfo || item.disabled ? 1 : 0.7}
              onPress={item.onPress}
              disabled={item.isInfo || item.disabled}
            >
              <View style={[styles.iconWrapper, { backgroundColor: item.bgColor }]}>
                <item.icon color={item.iconColor} size={24} strokeWidth={2} />
              </View>
              <Text style={[styles.settingTitle, item.disabled && styles.settingTitleDisabled]}>
                {item.title}
              </Text>
              {item.value && (
                <Text style={styles.settingValue}>{item.value}</Text>
              )}
              {item.disabled && (
                <Text style={styles.settingValue}>Setting up...</Text>
              )}
              {!item.isInfo && !item.disabled && (
                <ChevronRight color={colors.border.medium} size={20} strokeWidth={2} />
              )}
            </TouchableCard>
            {index < items.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header 
        title={t("supportSettings.title")} 
        subtitle={t("supportSettings.subtitle")} 
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        {...scrollViewTouchProps}
      >
        {renderSection(t("supportSettings.sections.helpSupport"), helpItems)}
        {renderSection(t("supportSettings.sections.appSettings"), settingsItems)}
        {renderSection(t("supportSettings.sections.notifications"), notificationItems)}
        {renderSection(t("supportSettings.sections.about"), aboutItems)}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={pushConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={handlePushNo}
      >
        <View style={styles.pushModalOverlay}>
          <Pressable style={styles.pushModalBackdrop} onPress={handlePushNo} />
          <View style={styles.pushModalCard}>
            <View style={styles.pushModalIconWrap}>
              <Bell color="#121358" size={32} strokeWidth={2} />
            </View>
            <Text style={styles.pushModalTitle}>{t("supportSettings.notificationItems.pushNotifications")}</Text>
            <Text style={styles.pushModalMessage}>Would you like to enable push notifications?</Text>
            <View style={styles.pushModalButtons}>
              <Pressable
                style={({ pressed }) => [styles.pushModalButton, styles.pushModalButtonNo, pressed && styles.pushModalButtonPressed]}
                onPress={handlePushNo}
              >
                <Text style={styles.pushModalButtonTextNo}>No</Text>
              </Pressable>
              <View style={styles.pushModalButtonDivider} />
              <Pressable
                style={({ pressed }) => [styles.pushModalButton, styles.pushModalButtonYes, pressed && styles.pushModalButtonPressed]}
                onPress={handlePushYes}
              >
                <Text style={styles.pushModalButtonTextYes}>Yes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorsContextValue) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.text.tertiary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: "hidden",
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text.primary,
  },
  settingTitleDisabled: {
    opacity: 0.6,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: colors.text.secondary,
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: 76,
  },
  bottomSpacer: {
    height: 20,
  },
  pushModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pushModalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pushModalCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.15)" }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }),
  },
  pushModalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  pushModalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  pushModalMessage: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  pushModalButtons: {
    flexDirection: "row",
    width: "100%",
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pushModalButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pushModalButtonNo: {
    backgroundColor: colors.background,
  },
  pushModalButtonYes: {
    backgroundColor: "#121358",
  },
  pushModalButtonPressed: {
    opacity: 0.85,
  },
  pushModalButtonDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  pushModalButtonTextNo: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text.secondary,
  },
  pushModalButtonTextYes: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
