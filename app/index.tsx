import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { blurActiveElementBeforeNav } from "@/utils/webErrorHandler";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      blurActiveElementBeforeNav();
      router.replace("/splash");
    });
    return () => cancelAnimationFrame(frame);
  }, [router]);

  return (
    <View
      style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <ActivityIndicator size="large" color="#5B4EFF" />
    </View>
  );
}
