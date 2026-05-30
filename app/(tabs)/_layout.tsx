import { Tabs } from "expo-router";
import { Home, Calendar, FileText, User, Target } from "lucide-react-native";
import React from "react";
import { View, Platform, Dimensions } from "react-native";
import AppHeader from "@/components/AppHeader";
import { OfflineSyncIndicator } from "@/components/OfflineSyncIndicator";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BaseColors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_ICON_SIZE = SCREEN_WIDTH < 375 ? 20 : 24;
const TAB_LABEL_FONT_SIZE = SCREEN_WIDTH < 375 ? 9 : 11;

function TabHeader() {
  const { pendingCount, isProcessing } = useOfflineQueue();
  return (
    <>
      <AppHeader />
      {pendingCount > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "transparent" }}>
          <OfflineSyncIndicator pendingCount={pendingCount} isProcessing={isProcessing} />
        </View>
      )}
    </>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(12, insets.bottom);
  const tabBarBaseHeight = Platform.OS === "ios" ? 85 : 65;
  const tabBarHeight = tabBarBaseHeight + tabBarBottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BaseColors.primary[650],
        tabBarInactiveTintColor: BaseColors.gray[400],
        headerShown: true,
        header: () => <TabHeader />,
        headerStyle: { borderBottomWidth: 0, borderBottomColor: "transparent", shadowOpacity: 0 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: BaseColors.white,
          borderTopWidth: 1,
          borderTopColor: BaseColors.gray[100],
          height: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingTop: 12,
        },
        // numberOfLines / adjustsFontSizeToFit are valid at runtime for tab labels but omitted from RN TextStyle typing
        tabBarLabelStyle: {
          fontSize: TAB_LABEL_FONT_SIZE,
          fontWeight: "500",
          numberOfLines: 1,
          adjustsFontSizeToFit: true,
        } as import("@react-navigation/bottom-tabs").BottomTabNavigationOptions["tabBarLabelStyle"],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color }) => <Calendar color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="payouts"
        options={{
          title: "Payouts",
          tabBarIcon: ({ color }) => <FileText color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="performance"
        options={{
          title: "Performance",
          tabBarIcon: ({ color }) => <Target color={color} size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} size={TAB_ICON_SIZE} />,
        }}
      />
    </Tabs>
  );
}
