import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, Platform, ActionSheetIOS, Modal, useWindowDimensions, AccessibilityInfo, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Check, X, Edit2, RotateCw } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import CircularImageCrop from "./CircularImageCrop";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { isValidImageUri, getSafeImageSource } from "@/utils/imageUriValidator";
import { appNotify } from "@/utils/appNotify";

const isMobile = Platform.OS !== "web";

// Constants
const MIN_IMAGE_DIMENSION = 200;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_QUALITY = 0.9;
const SUCCESS_BADGE_DURATION = 2000;

interface ProfileAvatarUploaderProps {
  photoUri: string | null;
  onPhotoSelected: (uri: string) => void;
  maxFileSize?: number; // Optional override for max file size
  minDimension?: number; // Optional override for min dimension
}

const SET_PROFILE_BTN_MIN_HEIGHT = 52;

export default function ProfileAvatarUploader({
  photoUri,
  onPhotoSelected,
  maxFileSize = MAX_FILE_SIZE,
  minDimension = MIN_IMAGE_DIMENSION,
}: ProfileAvatarUploaderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 400;
  const styles = useMemo(() => createStyles(windowWidth, isSmallScreen), [windowWidth, isSmallScreen]);

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showCropEditor, setShowCropEditor] = useState<boolean>(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [croppedImageUri, setCroppedImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState<boolean>(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset avatar load failed when photoUri changes (e.g. new photo selected)
  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [photoUri]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const pickImage = useCallback(async (useCamera: boolean) => {
    try {
      setUploading(true);
      setUploadSuccess(false);
      setShowPreview(false);
      setCroppedImageUri(null);
      setError(null);

      // Request appropriate permissions
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        const permissionType = useCamera ? "camera" : "photo library";
        const errorMessage = `Please allow ${permissionType} access in your device settings to upload your profile photo.`;
        appNotify.confirm(errorMessage, () => Linking.openSettings(), "Permission Required", "Open Settings", false);
        setUploading(false);
        return;
      }

      // Launch image picker or camera
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        allowsEditing: false, // Custom crop editor — full image first, manual crop optional
        quality: IMAGE_QUALITY,
        exif: false,
        mediaTypes: ['images'],
      };

      let result: ImagePicker.ImagePickerResult;
      try {
        result = useCamera
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      } catch (pickerError: unknown) {
        const msg = pickerError instanceof Error ? pickerError.message : 'Failed to open photo picker';
        if (__DEV__) console.error('Error picking image:', pickerError);
        appNotify.error("Could not open photos. Try again or use the camera instead.", "Photo Picker Error");
        setUploading(false);
        return;
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        
        // Validate image dimensions
        if (asset.width && asset.height) {
          if (asset.width < minDimension || asset.height < minDimension) {
            const errorMsg = `Please select an image that is at least ${minDimension}x${minDimension} pixels for better quality.`;
            appNotify.error(errorMsg, "Image Too Small");
            setUploading(false);
            setError(errorMsg);
            return;
          }
        }

        // Check file size if available
        if (asset.fileSize && asset.fileSize > maxFileSize) {
          const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
          const errorMsg = `Please select an image smaller than ${maxSizeMB}MB.`;
          appNotify.error(errorMsg, "File Too Large");
          setUploading(false);
          setError(errorMsg);
          return;
        }

        // Store the selected image and show circular crop editor
        setSelectedImageUri(uri);
        setUploading(false);
        setShowCropEditor(true);
        
        // Announce to screen readers
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
          AccessibilityInfo.announceForAccessibility("Image selected. Opening crop editor.");
        }
      } else {
        // User cancelled
        setUploading(false);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to pick image. Please try again.";
      
      appNotify.error(errorMessage);
      setUploading(false);
      setError(errorMessage);
    }
  }, [minDimension, maxFileSize]);

  const handleCropComplete = (croppedUri: string) => {
    setCroppedImageUri(croppedUri);
    setShowCropEditor(false);
    setShowPreview(true);
  };

  const handleCropCancel = () => {
    setShowCropEditor(false);
    setSelectedImageUri(null);
    setUploading(false);
  };

  const handleConfirmCrop = useCallback(async () => {
    if (!croppedImageUri) return;

    setUploading(true);
    setError(null);
    
    try {
      // Small delay for smooth UX transition
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      // Apply the cropped image
      onPhotoSelected(croppedImageUri);
      setUploadSuccess(true);
      setShowPreview(false);
      setCroppedImageUri(null);
      setSelectedImageUri(null);
      
      // Announce success to screen readers
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility("Profile image updated successfully.");
      }
      
      // Clear previous timeout if exists
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      
      // Reset success badge after duration
      successTimeoutRef.current = setTimeout(() => {
        setUploadSuccess(false);
      }, SUCCESS_BADGE_DURATION);
    } catch (error) {
      console.error("Error applying image:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to set profile image. Please try again.";
      
      appNotify.error(errorMessage);
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [croppedImageUri, onPhotoSelected]);

  const handleRetake = () => {
    setShowPreview(false);
    setCroppedImageUri(null);
    setSelectedImageUri(null);
    // Show picker options again
    setTimeout(() => {
      showImagePickerOptions(!!photoUri);
    }, 300);
  };

  const handleCancelCrop = () => {
    setShowPreview(false);
    setCroppedImageUri(null);
  };

  const showImagePickerOptions = useCallback((isEdit: boolean = false) => {
    const title = isEdit ? "Edit Photo" : "Add Photo";
    const message = isEdit 
      ? "Re-crop current photo or choose a new one" 
      : "Choose an option to add your profile photo";
    
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
          title,
          message,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage(true);
          } else if (buttonIndex === 2) {
            pickImage(false);
          }
        }
      );
    } else {
      appNotify.choose(title, message, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            if (Platform.OS === "android") {
              AccessibilityInfo.announceForAccessibility("Photo selection cancelled.");
            }
          },
        },
        { text: "Take Photo", onPress: () => pickImage(true) },
        { text: "Choose from Library", onPress: () => pickImage(false) },
      ]);
    }
  }, [pickImage]);

  const handleEditPress = () => {
    showImagePickerOptions(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        <TouchableOpacity 
          style={styles.avatarContainer} 
          onPress={photoUri ? undefined : () => showImagePickerOptions(false)}
          activeOpacity={0.7}
          disabled={!!photoUri || uploading}
          accessibilityRole="button"
          accessibilityLabel={photoUri ? "Profile photo" : "Add profile photo"}
          accessibilityHint={photoUri ? "Double tap to edit your profile photo" : "Double tap to add a profile photo"}
        >
          {photoUri && !avatarLoadFailed && isValidImageUri(photoUri) && getSafeImageSource(photoUri) ? (
            <Image 
              source={getSafeImageSource(photoUri)!} 
              style={styles.avatar}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <View style={styles.emptyAvatar}>
              <Camera color="#9CA3AF" size={40} strokeWidth={1.5} />
            </View>
          )}
          
          {uploading && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#121358" />
            </View>
          )}

          {uploadSuccess && !uploading && photoUri && (
            <View style={styles.successBadge}>
              <Check color="#FFFFFF" size={20} strokeWidth={3} />
            </View>
          )}

          {!photoUri && !uploading && (
            <View style={styles.addPhotoButton}>
              <Text style={styles.addPhotoText}>+ Add Photo</Text>
            </View>
          )}

          {/* Error Message Display */}
          {error && !uploading && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Edit Button Overlay - Only visible when photo exists */}
        {photoUri && !uploading && (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleEditPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo"
            accessibilityHint="Double tap to change your profile photo"
          >
            <View style={styles.editButtonInner}>
              <Edit2 color="#FFFFFF" size={16} strokeWidth={2.5} />
              <Text style={[styles.editButtonText, { marginLeft: 4 }]}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Circular Crop Editor Modal */}
      {selectedImageUri && (
        <Modal
          visible={showCropEditor}
          transparent={false}
          animationType="slide"
          onRequestClose={handleCropCancel}
          statusBarTranslucent
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.gray[900] }} edges={["top", "bottom"]}>
            <CircularImageCrop
              imageUri={selectedImageUri}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Crop Preview Modal with Professional UI */}
      <Modal
        visible={showPreview}
        transparent
        animationType="fade"
        onRequestClose={handleCancelCrop}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentWrapper}>
              <View style={styles.previewContainer}>
                <ScrollView
                  style={styles.previewScrollView}
                  contentContainerStyle={styles.previewScrollContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
              {/* Header */}
              <View style={styles.previewHeader}>
                <View style={styles.previewHeaderContent}>
                  <Text style={styles.previewTitle}>Review Profile Photo</Text>
                  <Text style={styles.previewSubtitle}>Confirm before setting your profile image</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCancelCrop}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X color={Colors.gray[500]} size={22} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Circular Preview Image */}
              <View style={styles.previewImageWrapper}>
                <View style={styles.previewImageContainer}>
                  {croppedImageUri && isValidImageUri(croppedImageUri) && getSafeImageSource(croppedImageUri) && (
                    <Image
                      source={getSafeImageSource(croppedImageUri)!}
                      style={styles.previewImage}
                      resizeMode="contain"
                      onError={() => {
                        if (__DEV__) {
                          console.warn("Failed to load cropped image:", croppedImageUri);
                        }
                      }}
                    />
                  )}
                  {uploading && (
                    <View style={styles.previewOverlay}>
                      <ActivityIndicator size="large" color={Colors.primary[500]} />
                      <Text style={styles.uploadingText}>Setting profile image...</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Action Buttons - fixed height on native so button is always visible in Expo Go */}
              <View style={[styles.previewActions, (isSmallScreen || isMobile) && styles.previewActionsColumn]}>
                <View style={[styles.buttonRow, (isSmallScreen || isMobile) && styles.buttonRowFull]}>
                  <TouchableOpacity
                    style={[styles.retakeButton, (isSmallScreen || isMobile) && styles.retakeButtonFull]}
                    onPress={handleRetake}
                    activeOpacity={0.7}
                    disabled={uploading}
                  >
                    <RotateCw color={Colors.gray[500]} size={18} strokeWidth={2} />
                    <Text style={styles.retakeButtonText}>Retake</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      (isSmallScreen || isMobile) && styles.cancelButtonFull,
                      { opacity: uploading ? 0.5 : 1 },
                    ]}
                    onPress={handleCancelCrop}
                    activeOpacity={0.7}
                    disabled={uploading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.setProfileImageButton,
                    (isSmallScreen || isMobile) && styles.setProfileImageButtonFull,
                  ]}
                  onPress={handleConfirmCrop}
                  activeOpacity={0.8}
                  disabled={uploading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {uploading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.setProfileImageLabelWrap}>
                      <Text style={styles.setProfileImageButtonText} numberOfLines={2}>
                        Set Profile Image
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Create responsive styles based on current window dimensions
const createStyles = (windowWidth: number, isSmallScreen: boolean) => {
  const maxContentWidth = Math.min(windowWidth - (isSmallScreen ? 20 : 40), 420);
  const previewImageSize = Math.min(windowWidth - (isSmallScreen ? 80 : 120), 320);
  return StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 32,
  },
  avatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: "relative",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gray[100],
  },
  emptyAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gray[100],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.border.medium,
    borderStyle: "dashed",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  successBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success[400],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.white,
  },
  addPhotoButton: {
    position: "absolute",
    bottom: -32,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  addPhotoText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Platform.OS === 'web' ? 600 : Typography.fontWeight.semibold, // Use number for web
    color: Colors.primary[500],
    marginTop: Spacing.sm,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  editButton: {
    position: "absolute",
    bottom: -8,
    left: "50%",
    marginLeft: -40,
    width: 80,
    height: 32,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary[500],
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
  },
  editButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Platform.OS === 'web' ? 700 : Typography.fontWeight.bold, // Use number for web
    color: Colors.white,
    letterSpacing: Typography.letterSpacing.wide,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  modalSafeArea: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: isSmallScreen ? Spacing.md : Spacing.xl,
  },
  modalContentWrapper: {
    flex: 1,
    width: "100%",
    maxHeight: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    width: "100%",
    maxWidth: maxContentWidth,
    padding: 0,
    overflow: "hidden",
    maxHeight: "90%",
    flex: 1,
    ...Shadows.xl,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    padding: isSmallScreen ? Spacing.lg : Spacing['2xl'],
    paddingBottom: isSmallScreen ? Spacing.md : Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  previewHeaderContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  previewTitle: {
    fontSize: isSmallScreen ? Typography.fontSize.xl : Typography.fontSize['2xl'],
    fontWeight: Platform.OS === 'web' ? 700 : Typography.fontWeight.bold, // Use number for web
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    letterSpacing: Typography.letterSpacing.tight,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  previewSubtitle: {
    fontSize: isSmallScreen ? Typography.fontSize.sm : Typography.fontSize.md,
    fontWeight: Platform.OS === 'web' ? 400 : Typography.fontWeight.regular, // Use number for web
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray[50],
  },
  previewImageWrapper: {
    padding: isSmallScreen ? Spacing.lg : Spacing['2xl'],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray[50],
  },
  previewImageContainer: {
    width: previewImageSize,
    height: previewImageSize,
    borderRadius: previewImageSize / 2,
    overflow: "hidden",
    backgroundColor: Colors.gray[100],
    ...Shadows.lg,
    position: "relative",
    borderWidth: isSmallScreen ? 3 : 4,
    borderColor: Colors.white,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: previewImageSize / 2,
  },
  uploadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontWeight: Platform.OS === 'web' ? 500 : Typography.fontWeight.medium, // Use number for web
    color: Colors.text.secondary,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  previewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    paddingHorizontal: isSmallScreen ? Spacing.lg : Spacing['2xl'],
    paddingVertical: isSmallScreen ? Spacing.lg : Spacing.xl,
    gap: Spacing.md,
    alignItems: "stretch",
    justifyContent: "center",
  },
  previewActionsColumn: {
    flexDirection: "column",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "stretch",
    flex: 1,
    minWidth: 0,
  },
  buttonRowFull: {
    width: "100%",
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.border.medium,
    minHeight: 48,
    flex: 1,
    minWidth: 0,
  },
  retakeButtonFull: {
    flex: 1,
  },
  retakeButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Platform.OS === 'web' ? 600 : Typography.fontWeight.semibold, // Use number for web
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  cancelButton: {
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray[100],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    flex: 1,
    minWidth: 0,
  },
  cancelButtonFull: {
    flex: 1,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Platform.OS === 'web' ? 600 : Typography.fontWeight.semibold, // Use number for web
    color: Colors.text.secondary,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  previewScrollView: {
    flex: 1,
    minHeight: 0,
    maxHeight: "100%",
  },
  previewScrollContent: {
    flexGrow: 1,
    paddingBottom: isSmallScreen ? Spacing.xl : Spacing["2xl"],
  },
  setProfileImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary[650],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg + 2,
    paddingHorizontal: Spacing.xl,
    minHeight: SET_PROFILE_BTN_MIN_HEIGHT,
    width: "100%",
    flexBasis: "100%",
    alignSelf: "stretch",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 12px rgba(18, 19, 88, 0.3)" }
      : { ...Shadows.lg, shadowColor: Colors.primary[650], shadowOpacity: 0.3 }),
  },
  setProfileImageButtonFull: {
    width: "100%",
    alignSelf: "stretch",
  },
  setProfileImageLabelWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
    width: "100%",
    minWidth: 0,
  },
  setProfileImageButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: Typography.letterSpacing.wide,
    lineHeight: 22,
    includeFontPadding: false,
    textAlign: "center",
    flexWrap: "wrap",
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === "web"
      ? { WebkitFontSmoothing: "antialiased" as any, MozOsxFontSmoothing: "grayscale" as any }
      : {}),
  },
  errorContainer: {
    position: "absolute",
    bottom: -50,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Platform.OS === 'web' ? 500 : Typography.fontWeight.medium, // Use number for web
    color: Colors.error[500],
    textAlign: "center",
    backgroundColor: Colors.error[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error[200],
    maxWidth: "100%",
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === 'web' ? {
      WebkitFontSmoothing: 'antialiased' as any,
      MozOsxFontSmoothing: 'grayscale' as any,
    } : {}),
  },
  });
};
