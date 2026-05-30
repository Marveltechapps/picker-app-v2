import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { BookOpen } from "lucide-react-native";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { useAuth } from "@/state/authContext";
import {
  getTrainingVideoByIdApi,
  getTrainingVideosApi,
  completeTrainingModuleApi,
  updateTrainingProgressApi,
  trackTrainingWatchProgressApi,
  type TrainingVideoItem,
} from "@/services/training.service";
import { isDirectVideoUrl } from "@/utils/videoUrlUtils";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";

function strParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}

function intParam(v: string | string[] | undefined, fallback: number): number {
  const s = strParam(v);
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function TrainingModuleScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{
    moduleId?: string | string[];
    title?: string | string[];
    videoUrl?: string | string[];
    estimatedMins?: string | string[];
  }>();

  const moduleId = strParam(raw.moduleId);
  const titleParam = strParam(raw.title);
  const videoUrlParam = strParam(raw.videoUrl).trim();
  const estimatedMins = intParam(raw.estimatedMins, 15);

  const { updateTrainingProgress } = useAuth();
  const [meta, setMeta] = useState<TrainingVideoItem | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [videos, setVideos] = useState<TrainingVideoItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const completionSentRef = useRef(false);

  const displayTitle = titleParam || meta?.title || "Training";
  const resolvedUrl = useMemo(() => {
    const u = videoUrlParam || meta?.videoUrl || "";
    return u.trim();
  }, [videoUrlParam, meta?.videoUrl]);

  const canPlayNative = !!resolvedUrl && isDirectVideoUrl(resolvedUrl);
  const durationSeconds = meta?.duration ?? estimatedMins * 60;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!moduleId) {
        setMeta(null);
        setMetaLoading(false);
        return;
      }
      setMetaLoading(true);
      try {
        const [m, list] = await Promise.all([
          getTrainingVideoByIdApi(moduleId),
          getTrainingVideosApi(),
        ]);
        if (cancelled) return;
        setMeta(m);
        setVideos(Array.isArray(list) ? list : []);
        if (m?.completed) {
          setCompleted(true);
          setProgress(1);
          completionSentRef.current = true;
        }
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const nextModule = useMemo(() => {
    if (!moduleId || videos.length === 0) return null;
    const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((v) => v.videoId === moduleId);
    if (idx < 0) return null;
    for (let j = idx + 1; j < sorted.length; j++) {
      if (!sorted[j].completed) return sorted[j];
    }
    return null;
  }, [moduleId, videos]);

  const markComplete = useCallback(async () => {
    if (!moduleId || completionSentRef.current) return;
    completionSentRef.current = true;
    setCompleting(true);
    setCompleteError(null);
    try {
      const watched = Math.max(
        Math.ceil(durationSeconds * 0.92),
        Math.ceil(durationSeconds * 0.8)
      );
      await trackTrainingWatchProgressApi(moduleId, watched, watched);
      await updateTrainingProgressApi({ [moduleId]: 100 });
      await completeTrainingModuleApi(moduleId);
      if (updateTrainingProgress) {
        await updateTrainingProgress(moduleId, 100);
      }
      setCompleted(true);
      setProgress(1);
    } catch (e) {
      completionSentRef.current = false;
      setCompleteError(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setCompleting(false);
    }
  }, [moduleId, durationSeconds, updateTrainingProgress]);

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if ("error" in status && status.error) {
          if (__DEV__) console.warn("[TrainingModule] playback error", status.error);
        }
        return;
      }
      setVideoLoading(false);
      const dur = status.durationMillis ?? 0;
      const pos = status.positionMillis ?? 0;
      const ratio = dur > 0 ? pos / dur : 0;
      setProgress(ratio);
      if (ratio >= 0.9 && !completionSentRef.current) {
        void markComplete();
      }
    },
    [markComplete]
  );

  const estimatedLabel = meta?.durationDisplay ?? `${estimatedMins} mins`;

  const goNext = () => {
    if (!nextModule) {
      router.replace("/training");
      return;
    }
    router.replace({
      pathname: "/training-module",
      params: {
        moduleId: nextModule.videoId,
        title: nextModule.title,
        videoUrl: nextModule.videoUrl || "",
        estimatedMins: String(Math.max(1, Math.round((nextModule.duration ?? 300) / 60))),
      },
    });
  };

  if (!moduleId) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
        <Header title="Training" showBack onBackPress={() => router.replace("/training")} />
        <View style={styles.centered}>
          <Text style={styles.muted}>Missing module. Go back to training list.</Text>
          <PrimaryButton title="Back to Training" onPress={() => router.replace("/training")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header
        title={displayTitle}
        showBack
        onBackPress={() => {
          try {
            if (router.canGoBack()) router.back();
            else router.replace("/training");
          } catch {
            router.replace("/training");
          }
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {metaLoading ? (
          <View style={styles.videoBox}>
            <ActivityIndicator size="large" color={Colors.primary[650]} />
          </View>
        ) : canPlayNative ? (
          <View style={styles.videoBox}>
            <Video
              style={styles.video}
              source={{ uri: resolvedUrl }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              onLoadStart={() => setVideoLoading(true)}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />
            {videoLoading ? (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary[650]} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <BookOpen color={Colors.gray[400]} size={40} strokeWidth={2} />
            <Text style={styles.placeholderTitle}>No video available</Text>
            <Text style={styles.placeholderSub}>
              This module does not have a direct video file yet. Use the full training player for
              YouTube or other links.
            </Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{displayTitle}</Text>
          <Text style={styles.infoMeta}>Estimated time: {estimatedLabel}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{Math.round(progress * 100)}% watched</Text>
        </View>

        {completeError ? <Text style={styles.errorText}>{completeError}</Text> : null}

        {completed ? (
          <View style={styles.completeBanner}>
            <Text style={styles.completeBannerText}>Module Complete ✓</Text>
          </View>
        ) : null}

        <Text style={styles.sectionHeading}>Key Takeaways</Text>
        <View style={styles.bullets}>
          <Text style={styles.bullet}>• Always scan items before picking</Text>
          <Text style={styles.bullet}>• Report damaged goods immediately</Text>
          <Text style={styles.bullet}>• Follow aisle navigation order</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {completed ? (
        <View style={styles.footer}>
          <PrimaryButton
            title={nextModule ? "Next Module" : "Back to Training"}
            onPress={goNext}
            loading={completing}
          />
        </View>
      ) : null}
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  centered: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  muted: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  videoBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    backgroundColor: Colors.gray[900],
    marginBottom: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" ? {} : { ...Shadows.sm }),
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  placeholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.gray[100],
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  placeholderTitle: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  placeholderSub: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: Spacing.lg,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)" }
      : { ...Shadows.sm }),
  },
  infoTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  infoMeta: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray[200],
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary[650],
    borderRadius: BorderRadius.full,
  },
  progressLabel: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },
  errorText: {
    color: Colors.error[600],
    fontSize: Typography.fontSize.md,
    marginBottom: Spacing.md,
  },
  completeBanner: {
    backgroundColor: Colors.success[50],
    borderWidth: 1,
    borderColor: Colors.success[200],
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  completeBannerText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.success[600],
    textAlign: "center",
  },
  sectionHeading: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  bullets: { gap: Spacing.sm, marginBottom: Spacing.lg },
  bullet: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    lineHeight: 22,
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
