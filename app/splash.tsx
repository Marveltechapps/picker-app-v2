import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/state/authContext";

export default function SplashScreen() {
  const { hasCompletedLogin, isLoading } = useAuth();

  // Wait for auth state to fully load before redirecting
  // This prevents flash to permissions on first render
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center",
        alignItems: "center", backgroundColor: "#F9FAFB" }}>
        <ActivityIndicator size="large" color="#5B4EFF" />
      </View>
    );
  }

  if (hasCompletedLogin) {
    return <Redirect href="/" />;
  }

  return <Redirect href="/permissions" />;
}
