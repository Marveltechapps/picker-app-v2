import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ChevronRight, CheckCircle2, Upload } from "lucide-react-native";
import { isValidImageUri, getSafeImageSource } from "@/utils/imageUriValidator";

interface DocumentCardProps {
  title: string;
  subtitle: string;
  icon: string;
  isComplete: boolean;
  frontUri?: string | null;
  backUri?: string | null;
  onPress: () => void;
}

export default function DocumentCard({
  title,
  subtitle,
  icon,
  isComplete,
  frontUri,
  backUri,
  onPress,
}: DocumentCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isComplete && styles.cardComplete]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, isComplete && styles.iconContainerComplete]}>
          <Text style={styles.iconEmoji}>{icon}</Text>
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {isComplete && (
              <CheckCircle2 color="#10B981" size={20} strokeWidth={2.5} />
            )}
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {isComplete && frontUri && isValidImageUri(frontUri) && (
            <View style={styles.thumbnailContainer}>
              {getSafeImageSource(frontUri) && (
                <Image 
                  source={getSafeImageSource(frontUri)!} 
                  style={styles.thumbnail}
                  onError={(e) => {
                    if (__DEV__) {
                      console.warn('Failed to load document image:', frontUri);
                    }
                  }}
                />
              )}
              {backUri && isValidImageUri(backUri) && getSafeImageSource(backUri) && (
                <Image 
                  source={getSafeImageSource(backUri)!} 
                  style={styles.thumbnail}
                  onError={(e) => {
                    if (__DEV__) {
                      console.warn('Failed to load document image:', backUri);
                    }
                  }}
                />
              )}
            </View>
          )}

          {!isComplete && (
            <View style={styles.uploadPrompt}>
              <Upload color="#8B5CF6" size={16} strokeWidth={2} />
              <Text style={styles.uploadText}>Tap to upload</Text>
            </View>
          )}
        </View>

        <ChevronRight color="#9CA3AF" size={24} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    overflow: "hidden",
  },
  cardComplete: {
    borderColor: "#8B5CF6",
    backgroundColor: "#F5F3FF",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  iconContainerComplete: {
    backgroundColor: "#EDE9FE",
  },
  iconEmoji: {
    fontSize: 32,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginRight: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 8,
  },
  thumbnailContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  thumbnail: {
    width: 60,
    height: 40,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: "#F3F4F6",
  },
  uploadPrompt: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8B5CF6",
    marginLeft: 6,
  },
});
