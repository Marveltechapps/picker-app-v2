import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Header from "@/components/Header";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { CheckCircle2, Edit, Upload } from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";
import { fetchDocuments, type DocumentFetchResponse } from "@/utils/documentService";

export default function DocumentDetailScreen() {
  const router = useRouter();
  const { docType } = useLocalSearchParams<{ docType: string }>();
  const [documentsResponse, setDocumentsResponse] = useState<DocumentFetchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setError(null);
      const response = await fetchDocuments();
      if (!response.success) {
        throw new Error(response.error || "Failed to load document");
      }
      setDocumentsResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
      setDocumentsResponse(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments])
  );

  const detail = docType === "aadhar" ? documentsResponse?.details?.aadhar : documentsResponse?.details?.pan;
  const docData = docType === "aadhar"
    ? {
        title: "Aadhar Card",
        front: detail?.sides.front.url ?? null,
        back: detail?.sides.back.url ?? null,
        uploadRoute: "/aadhar-upload",
      }
    : {
        title: "PAN Card",
        front: detail?.sides.front.url ?? null,
        back: detail?.sides.back.url ?? null,
        uploadRoute: "/pan-upload",
      };

  const statusLabel =
    detail?.status === "approved"
      ? "Approved"
      : detail?.status === "pending"
        ? "Pending review"
        : detail?.status === "rejected"
          ? detail.rejectionReason || "Rejected"
          : detail?.status === "partial"
            ? "Partially uploaded"
            : "Not uploaded";
  const statusColors =
    detail?.status === "approved"
      ? { bg: Colors.success[50], text: Colors.success[600], icon: Colors.success[400] }
      : detail?.status === "rejected"
        ? { bg: Colors.error[50], text: Colors.error[400], icon: Colors.error[400] }
        : { bg: Colors.warning[50], text: Colors.warning[400], icon: Colors.warning[400] };

  const handleReplaceDocument = () => {
    appNotify.confirm(
      "Are you sure you want to replace this document? You'll need to upload both front and back sides again.",
      () => {
        router.push(docData.uploadRoute as Href);
      },
      `Replace ${docData.title}`,
      "Replace",
      true
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header 
        title={docData.title}
        onBackPress={() => {
          try {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/my-documents");
            }
          } catch (error) {
            // Silently handle navigation error
            try {
              router.push("/my-documents");
            } catch {
              // Fallback failed
            }
          }
        }}
      />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusContainer}>
          <View style={[styles.verifiedBadge, { backgroundColor: statusColors.bg }]}>
            <CheckCircle2 color={statusColors.icon} size={20} strokeWidth={2} />
            <Text style={[styles.verifiedText, { color: statusColors.text }]}>{statusLabel}</Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {docData.front && (
          <View style={styles.imageSection}>
            <View style={styles.imageHeader}>
              <Text style={styles.sectionTitle}>Front Side</Text>
            </View>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: docData.front }} 
                style={styles.documentImage}
                resizeMode="contain"
                onError={() => {
                  if (__DEV__) {
                    console.warn('Failed to load document image:', docData.front);
                  }
                }}
              />
            </View>
          </View>
        )}

        {docData.back && (
          <View style={styles.imageSection}>
            <View style={styles.imageHeader}>
              <Text style={styles.sectionTitle}>Back Side</Text>
            </View>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: docData.back }} 
                style={styles.documentImage}
                resizeMode="contain"
                onError={() => {
                  if (__DEV__) {
                    console.warn('Failed to load document image:', docData.back);
                  }
                }}
              />
            </View>
          </View>
        )}

        {!docData.front && !docData.back ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No document uploaded yet.</Text>
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.actionContainer}>
        <PrimaryButton
          title="Replace Document"
          onPress={handleReplaceDocument}
          style={styles.replaceButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  imageSection: {
    marginBottom: Spacing.xl,
  },
  statusContainer: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  imageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.success[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  verifiedText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.success[600],
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error[400],
  },
  imageContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  documentImage: {
    width: "100%",
    height: 400,
    borderRadius: BorderRadius.md,
  },
  bottomSpacer: {
    height: Spacing.xl,
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  actionContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    ...Shadows.md,
    elevation: 8,
  },
  replaceButton: {
    backgroundColor: Colors.error[400],
  },
});

