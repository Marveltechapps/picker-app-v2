import React, { useCallback, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useFocusEffect, usePathname, useRouter, type Href } from "expo-router";
import { useAuth } from "@/state/authContext";
import { blurActiveElementBeforeNav } from "@/utils/webErrorHandler";
import { resolveStartupRoute } from "@/utils/startupRoute";
import { logRouteTransition } from "@/utils/permissionDebug";

export default function SplashScreen() {
  const { hasCompletedLogin, hasCompletedPermissionOnboarding, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  console.log("CURRENT ROUTE", pathname, "(splash render)", {
    hasCompletedLogin,
    hasCompletedPermissionOnboarding,
    isLoading,
  });

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
          const target = hasCompletedPermissionOnboarding ? "/login" : "/permissions";
          logRouteTransition("splash", "replace (not logged in)", target);
          router.replace(target as Href);
          return;
        }

        const target = await resolveStartupRoute(true);
        if (!cancelled) {
          blurActiveElementBeforeNav();
          logRouteTransition("splash", "replace (logged in)", target);
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
  }, [hasCompletedLogin, hasCompletedPermissionOnboarding, isLoading, router]);

  return (
    <View
      style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <ActivityIndicator size="large" color="#121358" />
    </View>
  );
}
