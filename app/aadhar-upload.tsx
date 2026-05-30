import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Animated, Image } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Upload, CheckCircle2, FileText } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { fetchDocuments, uploadDocument, validateDocumentFile } from "@/utils/documentService";
import Header from "@/components/Header";
import DocumentThumbnail from "@/components/DocumentThumbnail";
import PrimaryButton from "@/components/PrimaryButton";
import ConfirmationModal from "@/components/ConfirmationModal";
import { appNotify } from "@/utils/appNotify";

export default function AadharUploadScreen() {
  const router = useRouter();
  const { documentUploads, updateDocumentUpload, mergeDocumentsFromApi } = useAuth();
  const [uploadingFront, setUploadingFront] = useState<boolean>(false);
  const [uploadingBack, setUploadingBack] = useState<boolean>(false);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [replaceSide, setReplaceSide] = useState<"front" | "back" | null>(null);

  // Pre-fill from API if user already uploaded documents
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDocuments();
        if (cancelled || !res.success || !res.documents?.aadhar) return;
        await mergeDocumentsFromApi(res.documents);
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frontUri = documentUploads.aadhar.front;
  const backUri = documentUploads.aadhar.back;
  const bothUploaded = frontUri !== null && backUri !== null;

  const pickImage = async (side: "front" | "back") => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== "granted") {
        appNotify.permission("Photo Library", "access to your photo library");
        return;
      }

      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 10],
          quality: 0.9, // Higher quality for better clarity
        });
      } catch (pickerError: unknown) {
        if (__DEV__) console.error('Error picking image:', pickerError);
        appNotify.error(
          "Could not open photos. Try again or use the camera.",
          "Photo Picker Error"
        );
        return;
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        
        // Validate file
        const validation = await validateDocumentFile(
          uri,
          asset.fileSize,
          asset.width,
          asset.height
        );

        if (!validation.isValid) {
          appNotify.error(validation.error || "Invalid file", "Validation Error");
          return;
        }
        
        if (side === "front") {
          setUploadingFront(true);
        } else {
          setUploadingBack(true);
        }

        try {
          // Upload to backend (placeholder - replace with actual API)
          const uploadResult = await uploadDocument("aadhar", side, uri);
          
          if (uploadResult.success) {
            // Save to local state
            await updateDocumentUpload("aadhar", side, uri);
          } else {
            appNotify.error(
              uploadResult.error || "Failed to upload document. Please try again.",
              "Upload Failed"
            );
          }
        } catch (error) {
          console.error("Error uploading document:", error);
          appNotify.error("An unexpected error occurred. Please try again.");
        } finally {
          if (side === "front") {
            setUploadingFront(false);
          } else {
            setUploadingBack(false);
          }
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      appNotify.error("Failed to pick image. Please try again.");
      setUploadingFront(false);
      setUploadingBack(false);
    }
  };

  const handleContinue = () => {
    if (bothUploaded) {
      // Navigate back to documents screen or my-documents if coming from profile
      try {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/documents');
        }
      } catch (error) {
        router.replace('/documents');
      }
    }
  };

  const handleReplace = (side: "front" | "back") => {
    setReplaceSide(side);
    setReplaceModalVisible(true);
  };

  const handleReplaceConfirm = () => {
    if (replaceSide) {
      setReplaceModalVisible(false);
      pickImage(replaceSide);
      setReplaceSide(null);
    }
  };

  const handleReplaceCancel = () => {
    setReplaceModalVisible(false);
    setReplaceSide(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Aadhaar Card"
          subtitle="Upload front and back"
          onBackPress={() => {
            try {
              if (router.canGoBack()) router.back();
              else router.push("/documents");
            } catch {
              try { router.push("/documents"); } catch { /* fallback */ }
            }
          }}
        />

        <View style={styles.content}>
          <Text style={styles.subtitle}>Upload front and back</Text>

          <View style={styles.guidelinesContainer}>
            <View style={styles.guidelinesHeader}>
              <FileText color="#6B7280" size={18} strokeWidth={2} />
              <Text style={styles.guidelinesTitle}>Upload Guidelines</Text>
            </View>
            <View style={styles.guidelinesList}>
              <Text style={styles.guidelineText}>• Ensure the document is clear and all text is readable</Text>
              <Text style={styles.guidelineText}>• Use good lighting and avoid shadows</Text>
              <Text style={styles.guidelineText}>• Make sure the entire document is visible in the frame</Text>
              <Text style={styles.guidelineText}>• Both front and back sides must be uploaded</Text>
            </View>
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Front Side</Text>
            <TouchableOpacity
              style={[styles.uploadBox, frontUri && styles.uploadBoxComplete]}
              onPress={() => pickImage("front")}
              activeOpacity={0.7}
            >
              {uploadingFront ? (
                <DocumentThumbnail uri={null} isUploading={true} />
              ) : frontUri ? (
                <View style={styles.uploadedContent}>
                  <View style={styles.uploadedImageWrap}>
                    <Image
                      source={{ uri: frontUri }}
                      style={styles.uploadedImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.uploadedOverlay}>
                    <CheckCircle2 color="#8B5CF6" size={24} strokeWidth={2.5} />
                    <Text style={styles.uploadedText} numberOfLines={1}>Front uploaded</Text>
                    <TouchableOpacity
                      style={styles.replaceButton}
                      onPress={(e) => { e?.stopPropagation?.(); handleReplace("front"); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.replaceButtonText}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPrompt}>
                  <Upload color="#9CA3AF" size={48} strokeWidth={2} />
                  <Text style={styles.uploadPromptText}>Tap to upload front side</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Back Side</Text>
            <TouchableOpacity
              style={[styles.uploadBox, backUri && styles.uploadBoxComplete]}
              onPress={() => pickImage("back")}
              activeOpacity={0.7}
            >
              {uploadingBack ? (
                <DocumentThumbnail uri={null} isUploading={true} />
              ) : backUri ? (
                <View style={styles.uploadedContent}>
                  <View style={styles.uploadedImageWrap}>
                    <Image
                      source={{ uri: backUri }}
                      style={styles.uploadedImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.uploadedOverlay}>
                    <CheckCircle2 color="#8B5CF6" size={24} strokeWidth={2.5} />
                    <Text style={styles.uploadedText} numberOfLines={1}>Back uploaded</Text>
                    <TouchableOpacity
                      style={styles.replaceButton}
                      onPress={(e) => { e?.stopPropagation?.(); handleReplace("back"); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.replaceButtonText}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPrompt}>
                  <Upload color="#9CA3AF" size={48} strokeWidth={2} />
                  <Text style={styles.uploadPromptText}>Tap to upload back side</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <Animated.View style={{ opacity: bothUploaded ? 1 : 0.5 }}>
              <PrimaryButton 
                title="Continue" 
                onPress={handleContinue} 
                disabled={!bothUploaded}
              />
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={replaceModalVisible}
        title={replaceSide ? `Replace ${replaceSide === "front" ? "Front" : "Back"} Side` : "Replace"}
        message={
          replaceSide
            ? `Are you sure you want to replace the ${replaceSide} side of your Aadhaar Card?`
            : ""
        }
        confirmText="Replace"
        cancelText="Cancel"
        onConfirm={handleReplaceConfirm}
        onCancel={handleReplaceCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 24,
  },
  guidelinesContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  guidelinesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  guidelinesTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  guidelinesList: {
    gap: 8,
  },
  guidelineText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#6B7280",
    lineHeight: 18,
  },
  uploadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  uploadBox: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  uploadBoxComplete: {
    borderColor: "#8B5CF6",
    borderStyle: "solid",
    backgroundColor: "#F5F3FF",
  },
  uploadPrompt: {
    alignItems: "center",
  },
  uploadPromptText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 12,
  },
  uploadedContent: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
  },
  uploadedImageWrap: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    overflow: "hidden",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
  },
  uploadedOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(245, 243, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#E9E5FF",
  },
  uploadedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8B5CF6",
    flex: 1,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 20,
  },
  replaceButton: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  replaceButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
