import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Smartphone, Camera, CheckCircle2, AlertCircle } from "lucide-react-native";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import {
  getAssignedDevice,
  returnDevice,
  returnDeviceWithPhoto,
  AssignedDevice,
  DeviceCondition,
  DEVICE_STATUS_POLL_MS,
} from "@/services/device.service";
import { ApiClientError } from "@/utils/apiClient";
import { appNotify } from "@/utils/appNotify";

const CONDITION_OPTIONS: { value: DeviceCondition; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "other", label: "Other" },
];

export default function ReturnDeviceScreen() {
  const router = useRouter();
  const [device, setDevice] = useState<AssignedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [condition, setCondition] = useState<DeviceCondition>("good");
  const [conditionNotes, setConditionNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevice = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const assigned = await getAssignedDevice({ sync: true });
      setDevice(assigned);
      if (!assigned) setError("No device assigned to you");
      else setError(null);
    } catch (err) {
      setDevice(null);
      setError(err instanceof Error ? err.message : "Failed to load assigned device");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDevice();
      const timer = setInterval(() => void loadDevice({ silent: true }), DEVICE_STATUS_POLL_MS);
      return () => clearInterval(timer);
    }, [loadDevice])
  );

  const hhdActive = device?.hhdActive === true || device?.inUseOnHhd === true;

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        appNotify.permission("Camera", "camera access to take a photo");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUri(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      appNotify.error(err instanceof Error ? err.message : "Could not open camera");
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        appNotify.permission("Photo Library", "access to your photo library");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUri(result.assets[0].uri);
        setError(null);
      }
    } catch (err) {
      appNotify.error(err instanceof Error ? err.message : "Could not open gallery");
    }
  };

  const handleSubmit = async () => {
    if (!device || hhdActive) return;
    setSubmitting(true);
    setError(null);
    try {
      const notes = conditionNotes.trim() || undefined;
      if (photoUri) {
        await returnDeviceWithPhoto(
          device.deviceId,
          condition,
          notes,
          photoUri
        );
      } else {
        await returnDevice({
          deviceId: device.deviceId,
          condition,
          conditionNotes: notes,
        }        );
      }
      router.replace("/(tabs)");
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to return device";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const navigateBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      router.replace("/(tabs)");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <Header title="Return Device" showBack onBackPress={navigateBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <Header title="Return Device" showBack onBackPress={navigateBack} />
        <View style={styles.noDeviceContainer}>
          <AlertCircle color="#EF4444" size={48} strokeWidth={2} />
          <Text style={styles.noDeviceTitle}>No Device Assigned</Text>
          <Text style={styles.noDeviceText}>
            You don't have a device assigned. Return to the home screen or collect
            a device from your supervisor.
          </Text>
          <PrimaryButton title="Go to Home" onPress={() => router.replace("/(tabs)")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Return Device" showBack onBackPress={navigateBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Smartphone color="#8B5CF6" size={56} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>Return HHD Device</Text>
          <Text style={styles.subtitle}>
            Device: {device.deviceId}
          </Text>

          {hhdActive ? (
            <View style={styles.hhdActiveBanner}>
              <AlertCircle color="#B45309" size={22} strokeWidth={2.5} />
              <Text style={styles.hhdActiveText}>
                The HHD app is still logged in with your number on this device. Log out of the
                HHD app before returning it.
              </Text>
            </View>
          ) : null}

          {/* Condition dropdown */}
          <Text style={styles.label}>Condition</Text>
          <View style={styles.conditionRow}>
            {CONDITION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.conditionOption,
                  condition === opt.value && styles.conditionOptionSelected,
                ]}
                onPress={() => setCondition(opt.value)}
              >
                <Text
                  style={[
                    styles.conditionOptionText,
                    condition === opt.value && styles.conditionOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Condition notes */}
          <Text style={styles.label}>Condition notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any notes about the device condition..."
            placeholderTextColor="#9CA3AF"
            value={conditionNotes}
            onChangeText={setConditionNotes}
            multiline
            numberOfLines={3}
          />

          {/* Photo capture */}
          <Text style={styles.label}>Condition photo (optional)</Text>
          {photoUri ? (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.photoActionButton}
                  onPress={takePhoto}
                >
                  <Camera color="#6366F1" size={20} strokeWidth={2} />
                  <Text style={styles.photoActionText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoActionButton}
                  onPress={() => setPhotoUri(null)}
                >
                  <Text style={styles.photoActionTextRemove}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoPlaceholder}
              onPress={takePhoto}
              activeOpacity={0.7}
            >
              <Camera color="#8B5CF6" size={40} strokeWidth={2} />
              <Text style={styles.photoPlaceholderText}>Take photo</Text>
              <Text style={styles.photoPlaceholderSubtext}>or</Text>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  pickFromGallery();
                }}
              >
                <Text style={styles.photoGalleryLink}>Choose from gallery</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <AlertCircle color="#EF4444" size={20} strokeWidth={2} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={hhdActive ? "Log out of HHD first" : "Return Device"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || hhdActive}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  conditionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  conditionOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  conditionOptionSelected: {
    borderColor: "#8B5CF6",
    backgroundColor: "#F5F3FF",
  },
  conditionOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  conditionOptionTextSelected: {
    color: "#8B5CF6",
  },
  notesInput: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  photoPlaceholder: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
  },
  photoPlaceholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
  },
  photoPlaceholderSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  photoGalleryLink: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
    marginTop: 4,
  },
  photoPreviewContainer: {
    marginBottom: 24,
  },
  photoPreview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  photoActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  photoActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  photoActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
  },
  photoActionTextRemove: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
  hhdActiveBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 20,
  },
  hhdActiveText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#B91C1C",
    fontWeight: "500",
  },
  noDeviceContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  noDeviceTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  noDeviceText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px -2px 8px rgba(0, 0, 0, 0.05)", elevation: 8 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
});
