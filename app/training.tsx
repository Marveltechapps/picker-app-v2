import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LogOut, Zap } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import Header from "@/components/Header";
import TrainingVideoCard from "@/components/TrainingVideoCard";
import PrimaryButton from "@/components/PrimaryButton";
import ExitConfirmModal from "@/components/ExitConfirmModal";
import { getTrainingVideosApi, type TrainingVideoItem } from "@/services/training.service";
import { appNotify } from "@/utils/appNotify";

export default function TrainingVideosScreen() {
  const router = useRouter();
  const { trainingProgress, logout, completeTraining } = useAuth();
  const { onboardingState } = useOnboardingState();
  const hasCompletedTraining = onboardingState?.hasCompletedTraining ?? false;
  const [loading, setLoading] = useState<boolean>(false);
  const [exitModalVisible, setExitModalVisible] = useState<boolean>(false);
  const [exitLoading, setExitLoading] = useState<boolean>(false);
  const [videos, setVideos] = useState<TrainingVideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState<boolean>(true);

  // Refetch when screen is focused (initial load and when returning from a video)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setVideosLoading(true);
      getTrainingVideosApi()
        .then((list) => {
          if (!cancelled) setVideos(list ?? []);
        })
        .finally(() => {
          if (!cancelled) setVideosLoading(false);
        });
      return () => { cancelled = true; };
    }, [])
  );

  // Merge API data with auth context so "Continue to Next Module" immediately reflects as Completed
  const effectiveVideos = videos.map((v) => ({
    ...v,
    completed: v.completed || (trainingProgress[v.videoId] === 100),
  }));
  const completedCount = effectiveVideos.filter((v) => v.completed).length;
  const totalCount = effectiveVideos.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const handleVideoPress = useCallback(
    (video: TrainingVideoItem) => {
      router.push({
        pathname: "/training-video" as any,
        params: {
          videoId: video.videoId,
          title: video.title,
          duration: video.durationDisplay,
          description: video.description ?? "",
          videoUrl: video.videoUrl || undefined,
        },
      });
    },
    [router]
  );

  const handleLogout = () => setExitModalVisible(true);

  const handleExitConfirm = async () => {
    try {
      setExitLoading(true);
      await logout();
      setExitModalVisible(false);
      router.replace("/login");
    } catch {
      setExitLoading(false);
      setExitModalVisible(false);
      appNotify.error("Failed to logout. Please try again.");
    } finally {
      setExitLoading(false);
    }
  };

  const handleContinue = () => {
    if (allComplete && !hasCompletedTraining) {
      router.push("/final-assessment");
    }
  };

  // New design for users who have completed training (accessed from profile)
  if (hasCompletedTraining) {
    return (
      <View style={styles.container}>
        <Header 
          title="Training Module"
          subtitle="Learn how to work like a Pro"
          showBack={true}
          rightIcon={LogOut}
          onRightPress={handleLogout}
          rightIconColor={Colors.text.secondary}
        />
        {videosLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary[600]} />
          </View>
        ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.newVideosSection}>
            {effectiveVideos.map((video) => (
              <TouchableOpacity
                key={video.videoId}
                style={styles.simpleVideoCard}
                onPress={() => handleVideoPress(video)}
                activeOpacity={0.7}
              >
                <View style={styles.simpleCardContent}>
                  <View style={styles.simpleCardTextContainer}>
                    <Text style={styles.simpleCardTitle}>{video.title}</Text>
                    <Text style={styles.simpleCardDuration}>{video.durationDisplay} training video</Text>
                  </View>
                  {video.completed && (
                    <View style={styles.simpleCardBadge}>
                      <Text style={styles.simpleCardBadgeText}>✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
        )}

        <ExitConfirmModal
          visible={exitModalVisible}
          onConfirm={handleExitConfirm}
          onCancel={() => !exitLoading && setExitModalVisible(false)}
          loading={exitLoading}
        />
      </View>
    );
  }

  // Original login flow design
  return (
    <View style={styles.container}>
      <Header 
        title="Training Module"
        subtitle="Learn how to work like a Pro"
        showBack={true}
      />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Training Progress</Text>
          <Text style={styles.progressCount}>{completedCount}/{totalCount}</Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill,
                { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }
              ]}
            />
          </View>
        </View>

        <View style={styles.videosSection}>
          {videosLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary[600]} />
            </View>
          ) : effectiveVideos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No training modules</Text>
              <Text style={styles.emptyText}>Contact support to get training content.</Text>
            </View>
          ) : (
            effectiveVideos.map((video) => (
              <TrainingVideoCard
                key={video.videoId}
                title={video.title}
                duration={video.durationDisplay}
                completed={video.completed}
                onPress={() => handleVideoPress(video)}
              />
            ))
          )}
        </View>

        {allComplete && (
          <View style={styles.congratsCard}>
            <View style={styles.congratsIconContainer}>
              <Zap color="#F59E0B" size={24} strokeWidth={2.5} fill="#F59E0B" />
            </View>
            <View style={styles.congratsTextContainer}>
              <Text style={styles.congratsTitle}>Congratulations! 🎉</Text>
              <Text style={styles.congratsText}>
                You&apos;ve completed all training modules! You&apos;re now ready to start your final assessment.
              </Text>
            </View>
          </View>
        )}

        {!allComplete && (
          <View style={styles.motivationCard}>
            <View style={styles.motivationIconContainer}>
              <Zap color="#F59E0B" size={24} strokeWidth={2.5} fill="#F59E0B" />
            </View>
            <View style={styles.motivationTextContainer}>
              <Text style={styles.motivationTitle}>Keep Going!</Text>
              <Text style={styles.motivationText}>
                Complete all modules to unlock your Picker Certification and start your first shift.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title={allComplete ? "Start Final Assessment" : `Complete ${totalCount - completedCount} More Module${totalCount - completedCount === 1 ? '' : 's'}`}
          onPress={handleContinue}
          disabled={!allComplete}
          loading={loading}
        />
      </View>

      <ExitConfirmModal
        visible={exitModalVisible}
        onConfirm={handleExitConfirm}
        onCancel={() => !exitLoading && setExitModalVisible(false)}
        loading={exitLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  titleSection: {
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
  },
  subtitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.lg,
  },
  progressCard: {
    backgroundColor: Colors.primary[600],
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  progressTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  progressCount: {
    fontSize: Spacing['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    height: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xs,
  },
  videosSection: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  motivationCard: {
    flexDirection: "row",
    backgroundColor: Colors.warning[50],
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.warning[100],
    marginBottom: Spacing['2xl'],
  },
  motivationIconContainer: {
    width: Spacing['5xl'],
    height: Spacing['5xl'],
    borderRadius: Spacing['2xl'],
    backgroundColor: Colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  motivationTextContainer: {
    flex: 1,
  },
  motivationTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.warning[500],
    marginBottom: Spacing.xs,
  },
  motivationText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.warning[500],
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
  },
  congratsCard: {
    flexDirection: "row",
    backgroundColor: Colors.success[50],
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.success[200],
    marginBottom: Spacing['2xl'],
  },
  congratsIconContainer: {
    width: Spacing['5xl'],
    height: Spacing['5xl'],
    borderRadius: Spacing['2xl'],
    backgroundColor: Colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  congratsTextContainer: {
    flex: 1,
  },
  congratsTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success[600],
    marginBottom: Spacing.xs,
  },
  congratsText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.success[500],
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
  simplifiedVideoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  simplifiedVideoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  simplifiedVideoDuration: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  // New design styles for profile navigation
  newVideosSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  simpleVideoCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    ...Shadows.md,
  },
  simpleCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  simpleCardTextContainer: {
    flex: 1,
  },
  simpleCardTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing['xs-sm'],
    letterSpacing: Typography.letterSpacing.normal,
  },
  simpleCardDuration: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  simpleCardBadge: {
    width: Spacing['3xl'],
    height: Spacing['3xl'],
    borderRadius: Spacing.lg,
    backgroundColor: Colors.success[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.success[200],
    marginLeft: Spacing.md,
  },
  simpleCardBadgeText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success[500],
  },
  emptyContainer: {
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: "center",
  },
});
