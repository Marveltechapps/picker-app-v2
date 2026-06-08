import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableOpacity, TouchableCard } from "@/utils/touchables";
import React, { useCallback, useState, useRef } from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FileText, Eye, Upload, Edit } from "lucide-react-native";
import { fetchDocuments, type DocumentFetchResponse } from "@/utils/documentService";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import Header from "@/components/Header";
import { appNotify } from "@/utils/appNotify";

interface DocumentItem {
  id: string;
  title: string;
  status: "not_uploaded" | "partial" | "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  hasUpload: boolean;
}

export default function MyDocumentsScreen() {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  const [documentsResponse, setDocumentsResponse] = useState<DocumentFetchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const loadDocuments = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const response = await fetchDocuments();
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch documents");
      }
      setDocumentsResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents");
      if (!opts?.silent) setDocumentsResponse(null);
    } finally {
      if (!opts?.silent) setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments({ silent: hasLoadedOnceRef.current });
    }, [loadDocuments])
  );

  const documents: DocumentItem[] = [
    {
      id: "aadhar",
      title: "Aadhar Card",
      status: documentsResponse?.details?.aadhar?.status ?? "not_uploaded",
      rejectionReason: documentsResponse?.details?.aadhar?.rejectionReason ?? null,
      hasUpload: Boolean(documentsResponse?.details?.aadhar?.sides.front.url || documentsResponse?.details?.aadhar?.sides.back.url),
    },
    {
      id: "pan",
      title: "PAN Card",
      status: documentsResponse?.details?.pan?.status ?? "not_uploaded",
      rejectionReason: documentsResponse?.details?.pan?.rejectionReason ?? null,
      hasUpload: Boolean(documentsResponse?.details?.pan?.sides.front.url || documentsResponse?.details?.pan?.sides.back.url),
    },
  ];

  const getStatusLabel = (doc: DocumentItem) => {
    if (doc.status === "approved") return "Approved";
    if (doc.status === "pending") return "Pending review";
    if (doc.status === "rejected") return doc.rejectionReason || "Rejected";
    if (doc.status === "partial") return "Partially uploaded";
    return "Not uploaded";
  };

  const handleDocumentAction = (docId: string) => {
    const doc = documents.find((item) => item.id === docId);
    if (!doc) return;

    if (docId === 'aadhar') {
      if (doc.hasUpload) {
        appNotify.choose(
          "Aadhar Card",
          "What would you like to do?",
          [
            {
              text: "View",
              onPress: () => router.push('/document-detail?docType=aadhar'),
            },
            {
              text: "Update",
              onPress: () => router.push('/aadhar-upload'),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      } else {
        router.push('/aadhar-upload');
      }
    } else if (docId === 'pan') {
      if (doc.hasUpload) {
        appNotify.choose(
          "PAN Card",
          "What would you like to do?",
          [
            {
              text: "View",
              onPress: () => router.push('/document-detail?docType=pan'),
            },
            {
              text: "Update",
              onPress: () => router.push('/pan-upload'),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      } else {
        router.push('/pan-upload');
      }
    }
  };

  const handleViewDocument = (docId: string) => {
    if (docId === 'aadhar') {
      router.push('/document-detail?docType=aadhar');
    } else if (docId === 'pan') {
      router.push('/document-detail?docType=pan');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <Header 
        title="Documents"
        subtitle="View your uploaded documents"
        showBack={canGoBack}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        {...scrollViewTouchProps}
      >
        {loading ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>Loading documents...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadDocuments} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.documentsContainer}>
            {documents.map((doc) => (
              <TouchableCard
                key={doc.id}
                style={styles.documentCard}
                onPress={() => handleDocumentAction(doc.id)}
              >
                <View style={styles.documentLeft}>
                  <View style={styles.iconContainer}>
                    <FileText color={Colors.error[400]} size={28} strokeWidth={2} />
                  </View>
                  <View style={styles.documentInfo}>
                    <View style={styles.titleRow}>
                      <Text style={styles.documentTitle}>{doc.title}</Text>
                      {doc.status === "approved" && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.checkmark}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.documentDate}>{getStatusLabel(doc)}</Text>
                  </View>
                </View>
                {doc.hasUpload ? (
                  <View style={styles.actionButton}>
                    <Eye color={Colors.white} size={18} strokeWidth={2} />
                    <Text style={styles.actionButtonText}>View</Text>
                  </View>
                ) : (
                  <View style={styles.uploadButton}>
                    <Upload color={Colors.white} size={18} strokeWidth={2} />
                    <Text style={styles.uploadButtonText}>Upload</Text>
                  </View>
                )}
              </TouchableCard>
            ))}
          </View>
        )}

        <View style={styles.guidelinesContainer}>
          <View style={styles.guidelinesHeader}>
            <FileText color={Colors.text.secondary} size={20} strokeWidth={2} />
            <Text style={styles.guidelinesTitle}>Document Guidelines</Text>
          </View>
          <View style={styles.guidelinesList}>
            <Text style={styles.guidelineText}>Upload clear, readable copies of documents</Text>
            <Text style={styles.guidelineText}>Ensure all details are visible</Text>
            <Text style={styles.guidelineText}>Verification takes 24-48 hours</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Spacing.xl,
    paddingBottom: 20,
  },
  stateContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  stateText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  documentsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  documentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  documentTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  verifiedBadge: {
    width: Spacing.xl,
    height: Spacing.xl,
    borderRadius: Spacing.xl / 2,
    backgroundColor: Colors.success[400],
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  documentDate: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing['xs-sm'],
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  actionButtonText: {
    fontSize: Typography.fontSize['md-lg'],
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing['xs-sm'],
    backgroundColor: Colors.success[500],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  uploadButtonText: {
    fontSize: Typography.fontSize['md-lg'],
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  guidelinesContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  guidelinesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  guidelinesTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  guidelinesList: {
    gap: Spacing.sm,
  },
  guidelineText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
  },
  bottomSpacer: {
    height: 100,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    ...Shadows.md,
    elevation: 8,
  },
});


