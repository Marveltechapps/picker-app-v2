import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CheckCircle2, XCircle, Clock } from "lucide-react-native";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import {
  fetchDocuments,
  type DocumentFetchResponse,
  type DocumentSideDetail,
} from "@/utils/documentService";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type RowBadge = "approved" | "rejected" | "pending" | "not_uploaded";

type SummaryKind = "approved" | "rejected" | "pending";

function firstDate(...dates: (string | null | undefined)[]): string | null {
  const parsed = dates
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (parsed.length === 0) return null;
  const min = Math.min(...parsed);
  return new Date(min).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sideEarliestUpload(side?: DocumentSideDetail | null): string | null {
  if (!side) return null;
  return firstDate(side.uploadedAt, side.updatedAt);
}

function docRowFromDetail(
  label: string,
  docType: "aadhar" | "pan",
  res: DocumentFetchResponse
): {
  title: string;
  uploadDate: string | null;
  badge: RowBadge;
  reason: string | null;
  reuploadRoute: "/aadhar-upload" | "/pan-upload";
} {
  const detail = res.details?.[docType];
  const reuploadRoute = docType === "aadhar" ? "/aadhar-upload" : "/pan-upload";

  if (!detail) {
    const hasFront = !!res.documents?.[docType]?.front;
    const hasBack = !!res.documents?.[docType]?.back;
    if (!hasFront && !hasBack) {
      return { title: label, uploadDate: null, badge: "not_uploaded", reason: null, reuploadRoute };
    }
    return { title: label, uploadDate: null, badge: "pending", reason: null, reuploadRoute };
  }

  const uploadDate = firstDate(
    sideEarliestUpload(detail.sides?.front),
    sideEarliestUpload(detail.sides?.back)
  );

  const status = detail.status;
  if (status === "approved") {
    return { title: label, uploadDate, badge: "approved", reason: null, reuploadRoute };
  }
  if (status === "rejected") {
    const reason =
      detail.rejectionReason ||
      detail.sides?.front?.rejectionReason ||
      detail.sides?.back?.rejectionReason ||
      null;
    return { title: label, uploadDate, badge: "rejected", reason, reuploadRoute };
  }
  if (status === "not_uploaded") {
    return { title: label, uploadDate, badge: "not_uploaded", reason: null, reuploadRoute };
  }
  return { title: label, uploadDate, badge: "pending", reason: null, reuploadRoute };
}

function computeSummary(rows: { badge: RowBadge }[]): SummaryKind {
  const anyRejected = rows.some((r) => r.badge === "rejected");
  const allApproved = rows.length > 0 && rows.every((r) => r.badge === "approved");
  if (allApproved) return "approved";
  if (anyRejected) return "rejected";
  return "pending";
}

export default function DocumentVerificationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DocumentFetchResponse | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchDocuments();
      if (!res.success) {
        setError(res.error || "Could not load documents");
        setPayload(null);
        return;
      }
      setPayload(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load documents");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {};
    }, [load])
  );

  const rows = useMemo(() => {
    if (!payload) return [];
    return [
      docRowFromDetail("Aadhaar Card (Front + Back)", "aadhar", payload),
      docRowFromDetail("PAN Card (Front + Back)", "pan", payload),
    ];
  }, [payload]);

  const summary = useMemo(() => computeSummary(rows), [rows]);

  const bottomPrimary =
    summary === "approved"
      ? { title: "Continue to Training", onPress: () => router.replace("/training") }
      : { title: "Back to Documents", onPress: () => router.replace("/documents") };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header
        title="Document Verification"
        showBack
        onBackPress={() => {
          try {
            if (router.canGoBack()) router.back();
            else router.replace("/documents");
          } catch {
            router.replace("/documents");
          }
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary[650]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton title="Retry" onPress={() => void load()} />
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {summary === "approved" ? (
              <View style={[styles.summaryCard, styles.summaryApproved]}>
                <CheckCircle2 color={Colors.success[600]} size={28} strokeWidth={2.2} />
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryTitle}>All Documents Approved</Text>
                  <Text style={styles.summarySubtitle}>Your documents have been verified</Text>
                </View>
              </View>
            ) : summary === "rejected" ? (
              <View style={[styles.summaryCard, styles.summaryRejected]}>
                <XCircle color={Colors.error[500]} size={28} strokeWidth={2.2} />
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryTitle}>Action Required</Text>
                  <Text style={styles.summarySubtitle}>
                    Some documents were rejected. Please re-upload.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.summaryCard, styles.summaryPending]}>
                <Clock color={Colors.warning[500]} size={28} strokeWidth={2.2} />
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryTitle}>Under Review</Text>
                  <Text style={styles.summarySubtitle}>
                    Your documents are being verified. This usually takes 1-2 business days.
                  </Text>
                </View>
              </View>
            )}

            {rows.map((row) => (
              <View key={row.title} style={styles.docCard}>
                <Text style={styles.docTitle}>{row.title}</Text>
                <Text style={styles.docDate}>
                  {row.uploadDate ? `Uploaded: ${row.uploadDate}` : "Upload date: —"}
                </Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.badge,
                      row.badge === "approved" && styles.badgeApproved,
                      row.badge === "rejected" && styles.badgeRejected,
                      row.badge === "pending" && styles.badgePending,
                      row.badge === "not_uploaded" && styles.badgeGray,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        row.badge === "approved" && styles.badgeTextApproved,
                        row.badge === "rejected" && styles.badgeTextRejected,
                        row.badge === "pending" && styles.badgeTextPending,
                        row.badge === "not_uploaded" && styles.badgeTextGray,
                      ]}
                    >
                      {row.badge === "not_uploaded"
                        ? "Not Uploaded"
                        : row.badge.charAt(0).toUpperCase() + row.badge.slice(1)}
                    </Text>
                  </View>
                </View>
                {row.badge === "rejected" && row.reason ? (
                  <Text style={styles.rejectReason}>{row.reason}</Text>
                ) : null}
                {row.badge === "rejected" ? (
                  <TouchableOpacity
                    style={styles.reuploadBtn}
                    onPress={() => router.push(row.reuploadRoute)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.reuploadBtnText}>Re-upload</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton title={bottomPrimary.title} onPress={bottomPrimary.onPress} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.lg,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)" }
      : { ...Shadows.sm }),
  },
  summaryApproved: {
    backgroundColor: Colors.success[50],
    borderColor: Colors.success[200],
  },
  summaryRejected: {
    backgroundColor: Colors.error[50],
    borderColor: Colors.error[200],
  },
  summaryPending: {
    backgroundColor: Colors.warning[50],
    borderColor: Colors.warning[200],
  },
  summaryTextWrap: { flex: 1 },
  summaryTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  summarySubtitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  docCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)" }
      : { ...Shadows.sm }),
  },
  docTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  docDate: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  badgeRow: { flexDirection: "row", alignItems: "center" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeApproved: { backgroundColor: Colors.success[100] },
  badgeRejected: { backgroundColor: Colors.error[100] },
  badgePending: { backgroundColor: Colors.warning[100] },
  badgeGray: { backgroundColor: Colors.gray[100] },
  badgeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  badgeTextApproved: { color: Colors.success[600] },
  badgeTextRejected: { color: Colors.error[600] },
  badgeTextPending: { color: Colors.warning[500] },
  badgeTextGray: { color: Colors.gray[600] },
  rejectReason: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.error[600],
    lineHeight: 20,
  },
  reuploadBtn: {
    marginTop: Spacing.lg,
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card,
  },
  reuploadBtnText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary[650],
  },
  bottomSpacer: { height: Spacing["5xl"] },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    backgroundColor: Colors.card,
    ...Shadows.md,
  },
});
