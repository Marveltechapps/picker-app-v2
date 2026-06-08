import { TouchableOpacity, touchableCardDefaults } from "@/utils/touchables";
import React from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { BookOpen, ChevronRight, CheckCircle2 } from "lucide-react-native";

interface TrainingVideoCardProps {
  title: string;
  duration: string;
  completed: boolean;
  onPress: () => void;
}

export default function TrainingVideoCard({
  title,
  duration,
  completed,
  onPress,
}: TrainingVideoCardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        completed && styles.containerCompleted,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.85}
      delayPressIn={touchableCardDefaults.delayPressIn}
      pressRetentionOffset={touchableCardDefaults.pressRetentionOffset}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      testID={`training-video-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.touchable, { transform: [{ scale: scaleAnim }] }]}
      >
        <View
          style={[
            styles.iconContainer,
            completed && styles.iconContainerCompleted,
          ]}
        >
          <BookOpen
            color={completed ? "#10B981" : "#121358"}
            size={28}
            strokeWidth={2}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.duration}>{duration}</Text>
            {completed ? (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>Completed</Text>
              </View>
            ) : (
              <View style={styles.watchNowBadge}>
                <Text style={styles.watchNowText}>Watch Now</Text>
              </View>
            )}
          </View>
        </View>

        {completed ? (
          <CheckCircle2 color="#10B981" size={28} strokeWidth={2.5} />
        ) : (
          <ChevronRight color="#9CA3AF" size={28} strokeWidth={2} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#121358",
    marginBottom: 16,
    overflow: "hidden",
  },
  containerCompleted: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  touchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  iconContainerCompleted: {
    backgroundColor: "#D1FAE5",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  duration: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 12,
  },
  watchNowBadge: {
    backgroundColor: "#121358",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  watchNowText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  completedBadge: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  completedText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
