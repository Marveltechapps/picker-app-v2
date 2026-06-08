import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { Spacing, Typography } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import { fetchPickerPrivacy, type LegalDocument } from "@/services/legal.service";
import { ApiClientError } from "@/utils/apiClient";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPickerPrivacy();
      setDoc(data);
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong";
      setError(message);
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.card,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Spacing.xl,
        },
        errorText: {
          fontSize: Typography.fontSize.base,
          fontWeight: Typography.fontWeight.regular,
          color: colors.text.secondary,
          textAlign: "center",
          marginBottom: Spacing.lg,
          lineHeight: Typography.lineHeight.normal * Typography.fontSize.base,
        },
        retryText: {
          fontSize: Typography.fontSize.base,
          fontWeight: Typography.fontWeight.semibold,
          color: colors.primary[650],
          textDecorationLine: "underline",
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.md,
        },
        docTitle: {
          fontSize: Typography.fontSize["md-lg"],
          fontWeight: Typography.fontWeight.bold,
          color: colors.text.primary,
          marginBottom: Spacing.sm,
        },
        effective: {
          fontSize: Typography.fontSize.base,
          fontWeight: Typography.fontWeight.medium,
          color: colors.text.secondary,
          marginBottom: Spacing.xl,
        },
        body: {
          fontSize: Typography.fontSize.base,
          fontWeight: Typography.fontWeight.regular,
          color: colors.text.primary,
          lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.base,
        },
        footer: {
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.md,
          paddingBottom: Math.max(insets.bottom, Spacing.xl),
          backgroundColor: colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border.light,
        },
      }),
    [colors, insets.bottom]
  );

  return (
    <View style={styles.root}>
      <Header title="Privacy Policy" showBack />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[650]} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : doc ? (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.docTitle}>{doc.title}</Text>
            <Text style={styles.effective}>Effective: {doc.effectiveDate}</Text>
            {doc.contentFormat === "html" || doc.contentFormat === "markdown" ? (
              <Text style={styles.body}>{doc.content}</Text>
            ) : (
              <Text style={styles.body} selectable>
                {doc.content}
              </Text>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Close" variant="outline" onPress={() => router.back()} />
          </View>
        </>
      ) : null}
    </View>
  );
}
