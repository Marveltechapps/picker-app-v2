import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "./PrimaryButton";
import { apiGet } from "@/utils/apiClient";

interface LegalContentProps {
  type: "terms" | "privacy";
  onAccept: () => void;
}

interface ContentPageResponse {
  title?: string;
  body?: string;
}

const FALLBACK_CONTENT: Record<"terms" | "privacy", { title: string; body: string }> = {
  terms: {
    title: "Terms & Conditions",
    body:
      "By accessing and using this Picker application, you accept and agree to be bound by these terms. " +
      "Please use the app only for authorized work-related purposes and follow warehouse policies.",
  },
  privacy: {
    title: "Privacy Policy",
    body:
      "We collect only required personal and operational data to provide service, process attendance, " +
      "and ensure compliance. We do not sell personal information.",
  },
};

export default function LegalContent({ type, onAccept }: LegalContentProps) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(FALLBACK_CONTENT[type].title);
  const [body, setBody] = useState(FALLBACK_CONTENT[type].body);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiGet<ContentPageResponse>(`/content/page/${encodeURIComponent(type)}`);
        if (!active) return;
        const nextBody = (res?.body || "").trim();
        setTitle((res?.title || FALLBACK_CONTENT[type].title).trim() || FALLBACK_CONTENT[type].title);
        setBody(nextBody || FALLBACK_CONTENT[type].body);
      } catch {
        if (!active) return;
        setTitle(FALLBACK_CONTENT[type].title);
        setBody(FALLBACK_CONTENT[type].body);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [type]);

  const paragraphs = useMemo(
    () =>
      body
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean),
    [body]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#6B7280" />
          </View>
        ) : paragraphs.length > 0 ? (
          paragraphs.map((paragraph, idx) => (
            <Text key={`${type}-${idx}`} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))
        ) : (
          <Text style={styles.paragraph}>{FALLBACK_CONTENT[type].body}</Text>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <PrimaryButton title="I Understand" onPress={onAccept} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  loaderWrap: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  paragraph: {
    fontSize: 15,
    fontWeight: "400",
    color: "#4B5563",
    lineHeight: 24,
    marginBottom: 12,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
});
