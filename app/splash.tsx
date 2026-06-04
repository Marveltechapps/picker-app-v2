import React, { useCallback, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useAuth } from "@/state/authContext";
import { blurActiveElementBeforeNav } from "@/utils/webErrorHandler";
import { resolveStartupRoute } from "@/utils/startupRoute";

export default function SplashScreen() {
  const { hasCompletedLogin, isLoading } = useAuth();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      return () => {
        blurActiveElementBeforeNav();
      };
    }, [])
  );

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;

    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      const navigate = async () => {
        if (!hasCompletedLogin) {
          blurActiveElementBeforeNav();
          router.replace("/permissions");
          return;
        }

        const target = await resolveStartupRoute(true);
        if (!cancelled) {
          blurActiveElementBeforeNav();
          router.replace(target as Href);
        }
      };
      navigate().catch(() => {
        if (!cancelled) {
          blurActiveElementBeforeNav();
          router.replace("/login");
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [hasCompletedLogin, isLoading, router]);

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
