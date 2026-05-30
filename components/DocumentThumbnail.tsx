import React from "react";
import { View, Image, StyleSheet, ActivityIndicator, Platform, Text } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { Shadows } from "@/constants/theme";
import { isValidImageUri, getSafeImageSource } from "@/utils/imageUriValidator";

interface DocumentThumbnailProps {
  uri: string | null;
  isUploading?: boolean;
}

export default function DocumentThumbnail({ uri, isUploading }: DocumentThumbnailProps) {
  if (isUploading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#8B5CF6" />
      </View>
    );
  }

  if (!uri || !isValidImageUri(uri)) {
    return null;
  }

  const [imageError, setImageError] = React.useState(false);
  const imageSource = getSafeImageSource(uri);

  if (imageError || !imageSource) {
    return (
      <View style={styles.container}>
        <View style={styles.errorPlaceholder}>
          <Text style={styles.errorText}>?</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image 
        source={imageSource} 
        style={styles.image}
        onError={() => {
          if (__DEV__) {
            console.warn('Failed to load document thumbnail:', uri);
          }
          setImageError(true);
        }}
      />
      <View style={styles.checkBadge}>
        <CheckCircle2 color="#FFFFFF" size={16} strokeWidth={2.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)", elevation: 1 }
      : { ...Shadows.sm, shadowOpacity: 0.1 }),
  },
  errorPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#9CA3AF",
  },
});
