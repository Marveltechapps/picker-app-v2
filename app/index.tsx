import React, { useEffect } from "react";

import { View, ActivityIndicator } from "react-native";

import { usePathname, useRouter, useSegments, type Href } from "expo-router";

import { blurActiveElementBeforeNav } from "@/utils/webErrorHandler";

import { logRouteTransition } from "@/utils/permissionDebug";

import { useAuth } from "@/state/authContext";



/**

 * Root bootstrap route only. Must not hijack tab navigation when the user is

 * already inside (tabs) — that conflict caused / → splash redirects mid-session.

 */

export default function Index() {

  const router = useRouter();

  const pathname = usePathname();

  const segments = useSegments();

  const { hasCompletedLogin, isLoading } = useAuth();



  console.log("CURRENT ROUTE", pathname, "(index render)");



  useEffect(() => {

    if (isLoading) return;

    if (segments[0] === "(tabs)") return;



    const frame = requestAnimationFrame(() => {

      blurActiveElementBeforeNav();

      const target: Href = hasCompletedLogin ? "/(tabs)" : "/splash";

      logRouteTransition("index", "replace", target);

      router.replace(target);

    });

    return () => cancelAnimationFrame(frame);

  }, [router, hasCompletedLogin, isLoading, segments]);



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

