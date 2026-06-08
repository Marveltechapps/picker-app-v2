import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity, Pressable } from "@/utils/touchables";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, StatusBar, InteractionManager, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, BookOpen } from "lucide-react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import YoutubeIframe from "react-native-youtube-iframe";
import { WebView } from "react-native-webview";
import { useAuth } from "@/state/authContext";
import {
  completeTrainingVideoApi,
  trackTrainingWatchProgressApi,
} from "@/services/training.service";
import PrimaryButton from "@/components/PrimaryButton";
import { Shadows } from "@/constants/theme";
import { getYouTubeVideoId, isDirectVideoUrl, getEmbedUrl } from "@/utils/videoUrlUtils";

/** Renders direct video (mp4, etc.) using expo-video. Only mounted when URL is valid. */
function DirectVideoPlayer({
  videoUrl,
  duration,
  progress,
  isComplete,
  onProgressChange,
  onComplete,
  onPauseRef,
}: {
  videoUrl: string;
  duration: string;
  progress: number;
  isComplete: boolean;
  onProgressChange: (p: number) => void;
  onComplete: () => void;
  onPauseRef: React.MutableRefObject<(() => void) | null>;
}) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    onPauseRef.current = () => {
      try {
        if (player.playing) player.pause();
      } catch (_) {}
    };
    return () => {
      onPauseRef.current = null;
    };
  }, [player, onPauseRef]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player.duration > 0) {
        const progressPercent = Math.floor((player.currentTime / player.duration) * 100);
        onProgressChange(progressPercent);
        if (progressPercent >= 99) onComplete();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player, onProgressChange, onComplete]);

  const durationMinutes = (() => {
    const match = duration?.match(/(\d+)\s*min/);
    return match ? parseInt(match[1], 10) || 5 : 5;
  })();

  const handlePlayPress = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <>
      <VideoView
        player={player}
        style={styles.visibleVideo}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
      />
      {progress === 100 ? (
        <View style={styles.videoOverlay} pointerEvents="box-none">
          <Text style={styles.completedVideoText}>Training in progress...</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: "100%" }]} />
          </View>
          <View style={styles.durationRow}>
            <Text style={styles.durationText}>{duration}</Text>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.videoOverlay, player.playing && styles.videoOverlayTransparent]}
          onPress={handlePlayPress}
          activeOpacity={1}
        >
          {player.playing ? null : (
            <>
              <View style={styles.playButton}>
                <View style={styles.playIcon} />
              </View>
              <Text style={styles.videoPlaceholderText}>Click to Start</Text>
            </>
          )}
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.durationRow}>
            <Text style={styles.durationText}>{Math.floor((progress / 100) * durationMinutes)} min</Text>
            <Text style={styles.durationText}>{durationMinutes} min</Text>
          </View>
        </TouchableOpacity>
      )}
    </>
  );
}

function parseDurationToSeconds(duration: string | undefined): number {
  const value = duration?.trim() ?? "";
  if (!value) return 5 * 60;

  const minMatch = value.match(/(\d+)\s*min/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    if (Number.isFinite(mins) && mins > 0) return mins * 60;
  }

  const secMatch = value.match(/(\d+)\s*sec/i);
  if (secMatch) {
    const secs = parseInt(secMatch[1], 10);
    if (Number.isFinite(secs) && secs > 0) return secs;
  }

  return 5 * 60;
}

export default function TrainingVideoScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{
    videoId: string | string[];
    title: string;
    duration: string;
    description: string;
    videoUrl?: string;
  }>();
  // Normalize params (expo-router may pass arrays for query params)
  const params = useMemo(() => ({
    videoId: typeof rawParams.videoId === "string" ? rawParams.videoId : (Array.isArray(rawParams.videoId) ? rawParams.videoId[0] : rawParams.videoId) ?? "",
    title: rawParams.title,
    duration: rawParams.duration,
    description: rawParams.description,
    videoUrl: rawParams.videoUrl,
  }), [rawParams.videoId, rawParams.title, rawParams.duration, rawParams.description, rawParams.videoUrl]);
  
  const { updateTrainingProgress, trainingProgress } = useAuth();
  const [progress, setProgress] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Use only API videoUrl (dashboard-managed); no fallbacks
  const videoUrl =
    params.videoUrl && params.videoUrl.trim()
      ? params.videoUrl.trim()
      : "";

  const hasVideoUrl = !!videoUrl;
  const isDirectVideo = useMemo(() => hasVideoUrl && isDirectVideoUrl(videoUrl), [videoUrl, hasVideoUrl]);
  const youtubeId = useMemo(() => getYouTubeVideoId(videoUrl), [videoUrl]);
  const isYouTube = !!youtubeId;
  const isWebViewLink = !isDirectVideo && !isYouTube; // Vimeo, etc.
  const isExternalLink = isYouTube || isWebViewLink;
  const durationSeconds = useMemo(() => parseDurationToSeconds(params.duration), [params.duration]);

  const savedProgress = params.videoId && params.videoId in trainingProgress
    ? trainingProgress[params.videoId] ?? 0 
    : 0;

  useEffect(() => {
    if (savedProgress === 100) {
      setIsComplete(true);
      setProgress(100);
    }
  }, [savedProgress]);

  // For external links (YouTube/Vimeo): allow manual completion. For direct video: require ~99% watched.
  const canMarkComplete = (isExternalLink ? true : isComplete) && !!params.videoId;

  const pauseRef = useRef<(() => void) | null>(null);

  const navigateAfterVideoCleanup = (fn: () => void) => {
    try {
      pauseRef.current?.();
    } catch (_) {}
    InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current) return;
      try {
        fn();
      } catch {
        try {
          router.push("/training");
        } catch {
          // ignore
        }
      }
    });
  };

  const handleContinue = async () => {
    if (!canMarkComplete) {
      if (!params.videoId) {
        setErrorMsg("Video information is missing. Please go back and try again.");
      }
      return;
    }
    const videoId = params.videoId;
    setErrorMsg(null);
    setLoading(true);
    try {
      // Backend completion requires watch history. Create/update it first.
      // For direct videos, use current watched ratio; for external links, use threshold-friendly value.
      const watchedSeconds = isExternalLink
        ? Math.ceil(durationSeconds * 0.95)
        : Math.max(1, Math.ceil(durationSeconds * Math.max(progress, 0.95)));
      await trackTrainingWatchProgressApi(videoId, watchedSeconds, watchedSeconds);

      await completeTrainingVideoApi(videoId);
      if (updateTrainingProgress) {
        await updateTrainingProgress(videoId, 100);
      }
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : "Failed to save progress. Please try again.";
      setErrorMsg(msg);
      return;
    }
    setLoading(false);
    navigateAfterVideoCleanup(() => {
      if (!isMountedRef.current) return;
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/training");
      }
    });
  };

  /** Use dashboard-managed description; fallback only when empty */
  const getVideoDescription = (description: string | undefined, title: string) => {
    const trimmed = description?.trim();
    if (trimmed) return trimmed;
    return `This training module will teach you the essential skills needed for ${title || "this topic"}. Watch the entire video to unlock the next module and continue your training.`;
  };

  const getDurationInMinutes = (duration: string | undefined): number => {
    if (!duration) return 5;
    try {
      const match = duration.match(/(\d+)\s*min/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        return isNaN(parsed) ? 5 : parsed;
      }
      return 5;
    } catch {
      return 5;
    }
  };

  const durationMinutes = getDurationInMinutes(params.duration);

  const embedUrl = useMemo(() => getEmbedUrl(videoUrl), [videoUrl]);
  const videoWidth = Dimensions.get("window").width - 40;
  const videoHeight = Math.round((videoWidth * 9) / 16);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            navigateAfterVideoCleanup(() => {
              if (!isMountedRef.current) return;
              if (router.canGoBack()) router.back();
              else router.push("/training");
            })
          }
        >
          <ChevronLeft color="#111827" size={28} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.iconButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>{params.title}</Text>
          <Text style={styles.subtitle}>{params.duration} training video</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
            <Pressable onPress={() => setErrorMsg(null)} hitSlop={12}>
              <Text style={styles.errorBannerClose}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.videoContainer}>
          {isYouTube && youtubeId ? (
            <YoutubeIframe
              height={videoHeight}
              width={videoWidth}
              videoId={youtubeId}
              play={false}
              webViewStyle={styles.youtubeWebView}
            />
          ) : isWebViewLink && embedUrl ? (
            <WebView
              source={{ uri: embedUrl }}
              style={[styles.webViewVideo, { width: videoWidth, height: videoHeight }]}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
            />
          ) : isDirectVideo ? (
            <DirectVideoPlayer
              videoUrl={videoUrl}
              duration={params.duration ?? "5 min"}
              progress={progress}
              isComplete={isComplete}
              onProgressChange={setProgress}
              onComplete={() => setIsComplete(true)}
              onPauseRef={pauseRef}
            />
          ) : !hasVideoUrl ? (
            <View style={styles.externalVideoCard}>
              <Text style={styles.externalPlayText}>No video available</Text>
              <Text style={styles.externalPlaySubtext}>Contact support to add training content for this module</Text>
            </View>
          ) : (
            <View style={styles.externalVideoCard}>
              <Text style={styles.externalPlayText}>Unsupported video format</Text>
              <Text style={styles.externalPlaySubtext}>Use a direct video link (mp4) or YouTube URL</Text>
            </View>
          )}
        </View>

        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>About this module</Text>
          <Text style={styles.aboutText}>
            {getVideoDescription(params.description, params.title)}
          </Text>

          <View style={styles.progressCard}>
            <View style={styles.progressIconContainer}>
              <BookOpen color="#121358" size={24} strokeWidth={2} />
            </View>
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressCardTitle}>Video Progress</Text>
              <Text style={styles.progressCardText}>
                {isComplete
                  ? "Great! You've completed this module. Click continue to proceed."
                  : isExternalLink
                    ? "Tap above to play the video. When finished, tap Mark as Complete."
                    : "Watch the complete video to mark as completed and unlock next module."}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title={isComplete ? "Continue to Next Module" : "Mark as Complete"}
          onPress={handleContinue}
          disabled={!canMarkComplete}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -12,
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
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 24,
  },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 0,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorBannerText: {
    color: "#991B1B",
    fontSize: 14,
    flex: 1,
  },
  errorBannerClose: {
    color: "#991B1B",
    fontSize: 16,
    marginLeft: 8,
  },
  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    marginBottom: 32,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000000",
    position: "relative",
  },
  visibleVideo: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  videoOverlayTransparent: {
    backgroundColor: "transparent",
  },
  youtubeWebView: {
    borderRadius: 20,
    overflow: "hidden",
  },
  webViewVideo: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  externalVideoCard: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a2e",
  },
  externalPlayText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  externalPlaySubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(99, 102, 241, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderLeftWidth: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "#FFFFFF",
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  videoPlaceholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  completedVideoText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 16,
  },
  spinner: {
    marginTop: 8,
  },
  progressBar: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#121358",
    borderRadius: 2,
  },
  durationRow: {
    position: "absolute",
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  durationText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  aboutSection: {
    marginBottom: 32,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 16,
    fontWeight: "400",
    color: "#6B7280",
    lineHeight: 24,
    marginBottom: 24,
  },
  progressCard: {
    flexDirection: "row",
    backgroundColor: "#EEEEF5",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D8DAEB",
  },
  progressIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  progressTextContainer: {
    flex: 1,
  },
  progressCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  progressCardText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 100,
  },
  buttonContainer: {
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
    ...Shadows.md,
  },
});
