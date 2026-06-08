import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableOpacity, TouchableCard, Pressable } from "@/utils/touchables";
import ModalGestureRoot from "@/components/ModalGestureRoot";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, StatusBar, Image, Modal, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  Clock,
  CreditCard,
  FileText,
  Settings,
  BookOpen,
  ChevronRight,
  LogOut,
  Briefcase,
  AlertCircle,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react-native";
import ExitConfirmModal from "@/components/ExitConfirmModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Colors, Typography, Spacing, BorderRadius, Shadows, IconSizes } from "@/constants/theme";
import { useAuth } from "@/state/authContext";
import { getSafeImageSource } from "@/utils/imageUriValidator";
import {
  getProfileOverviewApi,
  type ProfileDocumentDetail,
  type ProfileOverviewData,
} from "@/services/profileOverview.service";
import {
  DEVICE_ASSIGNED_LABEL,
  NO_DEVICE_ASSIGNED_LABEL,
  isDeviceAssignedRecord,
} from "@/services/device.service";
import { pickerWebSocketService } from "@/utils/websocket.service";
import { appNotify } from "@/utils/appNotify";
import { requestAccountDeletion } from "@/services/account.service";
import { makeRefreshControl } from "@/utils/pullToRefresh";
import { getLoginContactLine, getProfileContactSubtitle } from "@/utils/contactDisplay";

function formatMemberSince(createdAt: string | null | undefined): string {
  if (!createdAt) return "—";
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatTitleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDocumentStatusLabel(status: ProfileDocumentDetail["status"]): string {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  if (status === "partial") return "Incomplete";
  return "Not uploaded";
}

function getDocumentsSubtitle(
  summary: ProfileOverviewData["documents"],
  details: ProfileOverviewData["documentDetails"]
): string {
  const docLines = [
    details.aadhar.status !== "not_uploaded" ? `Aadhaar: ${formatDocumentStatusLabel(details.aadhar.status)}` : null,
    details.pan.status !== "not_uploaded" ? `PAN: ${formatDocumentStatusLabel(details.pan.status)}` : null,
  ].filter(Boolean);

  if (docLines.length > 0) return docLines.join(" · ");

  if (summary.rejectedCount > 0) return `${summary.rejectedCount} rejected`;
  if (summary.pendingCount > 0) return `${summary.pendingCount} pending review`;
  if (summary.partialCount > 0) return `${summary.partialCount} incomplete upload`;
  if (summary.approvedCount === summary.requiredCount && summary.requiredCount > 0) return "All documents approved";
  if (summary.uploadedCount > 0) return `${summary.uploadedCount}/${summary.requiredCount} uploaded`;
  return "No documents uploaded";
}

function getBankSubtitle(data: ProfileOverviewData["bank"]): string {
  if (data.defaultAccountMasked && data.hasVerifiedAccount) {
    return `${data.defaultAccountMasked} verified`;
  }
  if (data.defaultAccountMasked) return data.defaultAccountMasked;
  if (data.upiId) return data.upiId;
  return "No payout method added";
}

function getTrainingSubtitle(data: ProfileOverviewData["training"]): string {
  if (data.totalVideos === 0) return "No training assigned";
  if (data.completed) return "Training completed";
  return `${data.completedVideos}/${data.totalVideos} completed`;
}

function getDeviceSubtitle(data: ProfileOverviewData["device"]): string {
  if (!isDeviceAssignedRecord(data)) return NO_DEVICE_ASSIGNED_LABEL;
  const hhdActive = data.inUseOnHhd === true || data.hhdActive === true;
  if (data.deviceId) {
    return hhdActive
      ? `${data.deviceId} • ${DEVICE_ASSIGNED_LABEL} · HHD Active`
      : `${data.deviceId} • ${DEVICE_ASSIGNED_LABEL}`;
  }
  return DEVICE_ASSIGNED_LABEL;
}

function getReturnDeviceSubtitle(data: ProfileOverviewData["device"]): string {
  const hhdActive = data.inUseOnHhd === true || data.hhdActive === true;
  if (!isDeviceAssignedRecord(data)) return "No device assigned";
  if (!data.deviceId) return hhdActive ? "HHD logged in — device in use" : "Device assigned";
  if (data.inUseOnHhd || data.hhdActive) {
    return `${data.deviceId} • Log out of HHD to return`;
  }
  return `Assigned ${data.deviceId} • Ready to return`;
}

function getSupportSubtitle(data: ProfileOverviewData["support"], notifications: ProfileOverviewData["notifications"]): string {
  if (data.openTicketsCount > 0) return `${data.openTicketsCount} open tickets`;
  if (notifications.unreadCount > 0) return `${notifications.unreadCount} unread notifications`;
  return "No open issues";
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, loginMethod, loginCountryCode, phoneNumber, userProfile } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["profile", "overview"],
    queryFn: () => getProfileOverviewApi({ sync: true }),
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const handlePullRefresh = useCallback(() => {
    void refetchRef.current();
  }, []);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [deletionModalVisible, setDeletionModalVisible] = useState(false);
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void refetchRef.current();
      const onDeviceChange = () => {
        void refetchRef.current();
      };
      pickerWebSocketService.connect();
      pickerWebSocketService.on("DEVICE_ASSIGNED", onDeviceChange);
      pickerWebSocketService.on("DEVICE_UNASSIGNED", onDeviceChange);
      return () => {
        pickerWebSocketService.off("DEVICE_ASSIGNED", onDeviceChange);
        pickerWebSocketService.off("DEVICE_UNASSIGNED", onDeviceChange);
      };
    }, [])
  );

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [data?.picker.photoUri]);

  const handleMenuPress = (title: string) => {
    const routes: Record<string, string> = {
      "Device Status": "/device-status",
      "Return Device": "/return-device",
      "Inventory Mismatch": "/inventory-mismatch",
      "Personal Information": "/personal-information",
      "Work History": "/work-history",
      "Bank Account": "/bank-details",
      Payouts: "/payouts",
      Documents: "/my-documents",
      "Support & Settings": "/support-settings",
      Training: "/training",
    };
    const path = routes[title];
    if (!path) return;
    try {
      router.push(path as import("expo-router").Href);
    } catch (err) {
      if (__DEV__) console.warn("[Profile] Navigation failed:", path, err);
    }
  };

  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      setLogoutModalVisible(false);
      // Post-logout navigation is handled centrally in _layout (avoids splash → login flash).
    } catch {
      setLogoutModalVisible(false);
      setErrorModalVisible(true);
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletionSubmitting(true);
    try {
      const res = await requestAccountDeletion();
      if (res.success) {
        setDeleteConfirmModalVisible(false);
        setDeletionModalVisible(true);
      } else {
        appNotify.error(res.message || "Could not submit deletion request.");
      }
    } catch {
      appNotify.error("Could not submit deletion request. Please try again.");
    } finally {
      setDeletionSubmitting(false);
    }
  };

  const handleDeleteAccountPress = () => {
    setDeleteConfirmModalVisible(true);
  };

  const completeDeletionLogout = async () => {
    setDeletionModalVisible(false);
    try {
      await logout();
    } catch {
      /* _layout still routes to login when auth clears */
    }
  };

  const menuItems = useMemo(() => {
    if (!data) return [];
    return [
      {
        icon: Smartphone,
        title: "Device Status",
        subtitle: getDeviceSubtitle(data.device),
        bgColor: "#EEEEF5",
        iconColor: "#121358",
      },
      {
        icon: Briefcase,
        title: "Return Device",
        subtitle: getReturnDeviceSubtitle(data.device),
        bgColor: "#E4E5F0",
        iconColor: "#4F46E5",
      },
      {
        icon: AlertCircle,
        title: "Inventory Mismatch",
        subtitle: "Report product qty mismatch",
        bgColor: "#FEF3C7",
        iconColor: "#F59E0B",
      },
      {
        icon: User,
        title: "Personal Information",
        subtitle: getProfileContactSubtitle({
          loginMethod: data.picker.loginMethod ?? undefined,
          phone: data.picker.phone,
          email: data.picker.email,
        }),
        bgColor: "#EEEEF5",
        iconColor: "#121358",
      },
      {
        icon: Clock,
        title: "Work History",
        subtitle: "View attendance & shift records",
        bgColor: "#DCFCE7",
        iconColor: "#10B981",
      },
      {
        icon: CreditCard,
        title: "Bank Account",
        subtitle: getBankSubtitle(data.bank),
        bgColor: "#FEF3C7",
        iconColor: "#FACC15",
      },
      {
        icon: Wallet,
        title: "Payouts",
        subtitle: "View earnings & payment history",
        bgColor: "#EEEEF5",
        iconColor: "#121358",
      },
      {
        icon: FileText,
        title: "Documents",
        subtitle: getDocumentsSubtitle(data.documents, data.documentDetails),
        bgColor: "#FFEDD5",
        iconColor: "#F97316",
      },
      {
        icon: Settings,
        title: "Support & Settings",
        subtitle: getSupportSubtitle(data.support, data.notifications),
        bgColor: "#FEE2E2",
        iconColor: "#EF4444",
      },
      {
        icon: BookOpen,
        title: "Training",
        subtitle: getTrainingSubtitle(data.training),
        bgColor: "#FEF3C7",
        iconColor: "#FACC15",
      },
    ];
  }, [data]);

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text style={styles.centerStateText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <View style={styles.centerState}>
          <Text style={styles.centerStateTitle}>Profile unavailable</Text>
          <Text style={styles.centerStateText}>We couldn't load your profile data.</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.8} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = data.picker.name?.trim() || "—";
  const contactLine = getLoginContactLine({
    loginMethod: data.picker.loginMethod ?? loginMethod,
    phone: phoneNumber ?? data.picker.phone,
    email: data.picker.email ?? userProfile?.email,
    countryCode: loginCountryCode,
  });
  const memberSince = formatMemberSince(data.picker.joinedAt);
  const roleLabel = data.picker.role || "—";
  const locationLabel = data.picker.locationType ? formatTitleCase(data.picker.locationType) : null;
  const accountStatusLabel = data.picker.status ? formatTitleCase(data.picker.status) : null;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={makeRefreshControl(isRefetching, handlePullRefresh)}
        {...scrollViewTouchProps}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {data.picker.photoUri && !avatarLoadFailed && getSafeImageSource(data.picker.photoUri) ? (
              <Image
                source={getSafeImageSource(data.picker.photoUri)!}
                style={styles.avatar}
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={40} color="#FFFFFF" strokeWidth={2} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              {contactLine ? (
                <Text style={styles.profileContact} numberOfLines={1}>
                  {contactLine}
                </Text>
              ) : null}
              <View style={styles.roleBadge}>
                <Briefcase color="#FFFFFF" size={14} strokeWidth={2} />
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.memberSince}>
            <Text style={styles.memberSinceLabel}>Member Since</Text>
            <Text style={styles.memberSinceValue}>{memberSince}</Text>
          </View>
          {(accountStatusLabel || locationLabel) ? (
            <View style={styles.profileMetaRow}>
              {accountStatusLabel ? (
                <View style={styles.profileMetaItem}>
                  <Text style={styles.profileMetaLabel}>Account Status</Text>
                  <Text style={styles.profileMetaValue}>{accountStatusLabel}</Text>
                </View>
              ) : null}
              {locationLabel ? (
                <View style={styles.profileMetaItem}>
                  <Text style={styles.profileMetaLabel}>Work Location</Text>
                  <Text style={styles.profileMetaValue}>{locationLabel}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableCard
              key={index}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.title)}
            >
              <View style={[styles.menuIconWrapper, { backgroundColor: item.bgColor }]}>
                <item.icon color={item.iconColor} size={IconSizes.lg} strokeWidth={2} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight color={Colors.text.tertiary} size={IconSizes.lg} strokeWidth={2} />
            </TouchableCard>
          ))}
        </View>

        <View style={styles.accountActionsRow}>
          <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogoutPress}>
            <LogOut color={Colors.error[500]} size={IconSizes.md} strokeWidth={2} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteAccountButton, deletionSubmitting && styles.accountActionDisabled]}
            activeOpacity={0.7}
            onPress={handleDeleteAccountPress}
            disabled={deletionSubmitting}
          >
            <Trash2 color={Colors.white} size={IconSizes.md} strokeWidth={2} />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <ExitConfirmModal
        visible={logoutModalVisible}
        onConfirm={handleLogoutConfirm}
        onCancel={() => !logoutLoading && setLogoutModalVisible(false)}
        loading={logoutLoading}
      />

      <ConfirmationModal
        visible={deleteConfirmModalVisible}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone. Your account will be permanently deleted within 30 days."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteAccount}
        onCancel={() => !deletionSubmitting && setDeleteConfirmModalVisible(false)}
        loading={deletionSubmitting}
      />

      <Modal visible={deletionModalVisible} transparent animationType="fade" onRequestClose={() => {}}>
        <ModalGestureRoot>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => {}} />
            <View style={styles.logoutModalCard} collapsable={false}>
            <Text style={styles.logoutModalTitle}>Deletion Request Submitted</Text>
            <Text style={styles.logoutModalMessage}>
              Your account will be deleted within 30 days. You have been logged out.
            </Text>
            <TouchableOpacity style={styles.logoutModalOkButton} onPress={completeDeletionLogout} activeOpacity={0.85}>
              <Text style={styles.logoutModalOkButtonText}>OK</Text>
            </TouchableOpacity>
            </View>
          </View>
        </ModalGestureRoot>
      </Modal>

      {/* Error modal */}
      <Modal visible={errorModalVisible} transparent animationType="fade" onRequestClose={() => setErrorModalVisible(false)}>
        <ModalGestureRoot>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setErrorModalVisible(false)} />
            <View style={styles.logoutModalCard} collapsable={false}>
            <View style={[styles.logoutModalIconWrap, styles.logoutModalIconError]}>
              <AlertCircle color={Colors.error[400]} size={40} strokeWidth={2} />
            </View>
            <Text style={styles.logoutModalTitle}>Error</Text>
            <Text style={styles.logoutModalMessage}>Failed to logout. Please try again.</Text>
            <TouchableOpacity style={styles.logoutModalOkButton} onPress={() => setErrorModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.logoutModalOkButtonText}>OK</Text>
            </TouchableOpacity>
            </View>
          </View>
        </ModalGestureRoot>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  centerStateTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  centerStateText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  retryButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  retryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    marginTop: Spacing['3xl'],
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    marginTop: Spacing.xs / 2,
  },
  notificationButton: {
    width: Spacing.iconButton,
    height: Spacing.iconButton,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: Spacing['sm-md'],
    right: Spacing['sm-md'],
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: Spacing.xs,
    backgroundColor: Colors.error[400],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  profileCard: {
    marginTop: 0,
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: Colors.white,
    marginRight: Spacing.lg,
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  profileName: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  profileContact: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.accent.purple,
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing['xs-sm'],
    borderRadius: BorderRadius.sm,
    gap: Spacing['xs-sm'],
  },
  roleText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
  },
  memberSince: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    paddingTop: Spacing.lg,
  },
  memberSinceLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.accent.purple,
    marginBottom: Spacing.xs,
  },
  memberSinceValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  profileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  profileMetaItem: {
    minWidth: "45%",
    flexGrow: 1,
  },
  profileMetaLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.accent.purple,
    marginBottom: Spacing.xs,
  },
  profileMetaValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  menuContainer: {
    gap: Spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  menuIconWrapper: {
    width: Spacing['5xl'],
    height: Spacing['5xl'],
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs / 2,
  },
  menuSubtitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.tertiary,
  },
  accountActionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.md,
    marginTop: Spacing['2xl'],
  },
  logoutButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.error[50],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.error[100],
  },
  logoutText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.error[500],
  },
  deleteAccountButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.error[500],
    borderRadius: BorderRadius.lg,
  },
  deleteAccountText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  accountActionDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoutModalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(139, 92, 246, 0.08)" }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 }),
  },
  logoutModalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoutModalIconError: {
    backgroundColor: Colors.error[50],
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text.primary,
    marginBottom: 10,
    textAlign: "center",
  },
  logoutModalMessage: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  logoutModalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  logoutModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutModalBtnCancel: {
    backgroundColor: Colors.gray[100],
  },
  logoutModalBtnConfirm: {
    backgroundColor: Colors.error[400],
  },
  logoutModalBtnPressed: {
    opacity: 0.85,
  },
  logoutModalBtnCancelText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text.primary,
  },
  logoutModalBtnConfirmText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  logoutModalOkButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: 120,
    alignItems: "center",
  },
  logoutModalOkButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.white,
  },
});
