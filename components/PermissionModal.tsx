import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Bell, Camera, Battery, MapPin, MapPinned, LucideIcon } from "lucide-react-native";
import { PermissionsState } from "@/state/authContext";
import { Shadows } from "@/constants/theme";

interface PermissionModalProps {
  visible: boolean;
  permissionKey: keyof PermissionsState;
  onAllow: () => void;
  onDontAllow: () => void;
  onConfirmExpoGo?: () => void;
  showExpoGoConfirmButton?: boolean;
}

const PERMISSION_CONFIG: Record<
  keyof PermissionsState,
  {
    icon: LucideIcon;
    title: string;
    body: string;
  }
> = {
  pushNotifications: {
    icon: Bell,
    title: '"Picker Pro" Would Like to Send You Notifications',
    body: "Notifications may include alerts, sounds, and icon badges.",
  },
  camera: {
    icon: Camera,
    title: '"Picker Pro" Would Like to Access the Camera',
    body: "We need your camera to take pictures or upload documents.",
  },
  battery: {
    icon: Battery,
    title: '"Picker Pro" Would Like to Access Battery Usage',
    body: "We need unrestricted battery usage to connect you to nearby Stores.",
  },
  location: {
    icon: MapPin,
    title: '"Picker Pro" Would Like to Access Your Location',
    body: "We need your location to connect you to nearby Stores.",
  },
  backgroundLocation: {
    icon: MapPinned,
    title: '"Picker Pro" Would Like to Access Your Location',
    body: "We require background location for accurate rider location updates and geofence detection.",
  },
};

export default function PermissionModal({ visible, permissionKey, onAllow, onDontAllow, onConfirmExpoGo, showExpoGoConfirmButton }: PermissionModalProps) {
  const config = PERMISSION_CONFIG[permissionKey];
  const Icon = config.icon;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconContainer}>
            <View style={styles.iconWrapper}>
              <Icon color="#5B4EFF" size={36} strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.body}>{config.body}</Text>
          
          {showExpoGoConfirmButton && (
            <Text style={styles.expoGoHint}>
              If you've enabled "Allow all the time" in Settings, tap "Confirm" below.
            </Text>
          )}

          <View style={styles.divider} />

          <View style={[styles.buttonContainer, showExpoGoConfirmButton && styles.buttonContainerThree]}>
            <TouchableOpacity style={[styles.button, styles.buttonLeft]} onPress={onDontAllow} activeOpacity={0.6}>
              <Text style={styles.buttonText}>Don&apos;t Allow</Text>
            </TouchableOpacity>

            {showExpoGoConfirmButton && onConfirmExpoGo && (
              <>
                <View style={styles.buttonDivider} />
                <TouchableOpacity style={styles.button} onPress={onConfirmExpoGo} activeOpacity={0.6}>
                  <Text style={[styles.buttonText, styles.buttonTextWarning]}>Confirm</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.buttonDivider} />

            <TouchableOpacity style={[styles.button, styles.buttonRight]} onPress={onAllow} activeOpacity={0.6}>
              <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)", elevation: 6 }
      : { ...Shadows.xl, shadowOpacity: 0.2 }),
  },
  iconContainer: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 20,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
    lineHeight: 20,
  },
  expoGoHint: {
    fontSize: 13,
    fontWeight: "500",
    color: "#F59E0B",
    textAlign: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 18,
    backgroundColor: "#FEF3C7",
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  buttonContainer: {
    flexDirection: "row",
    height: 56,
  },
  buttonContainerThree: {
    height: 56,
    // Flex will be distributed equally among 3 buttons with dividers
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLeft: {
    borderBottomLeftRadius: 24,
  },
  buttonRight: {
    borderBottomRightRadius: 24,
  },
  buttonDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#5B4EFF",
  },
  buttonTextPrimary: {
    fontWeight: "700",
  },
  buttonTextWarning: {
    color: "#F59E0B",
    fontWeight: "600",
  },
});
