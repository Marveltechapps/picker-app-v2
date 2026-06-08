import { Tabs, usePathname } from "expo-router";

import { Home, Calendar, User, Target } from "lucide-react-native";

import React, { useEffect, useMemo } from "react";

import { View, Dimensions, StyleSheet } from "react-native";

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import PickerTabBar, { TAB_CONTENT_HEIGHT } from "@/components/PickerTabBar";

import AppHeader from "@/components/AppHeader";

import { OfflineSyncIndicator } from "@/components/OfflineSyncIndicator";

import { useOfflineQueue } from "@/hooks/useOfflineQueue";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BaseColors, ShellColors } from "@/constants/theme";



const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TAB_ICON_SIZE = SCREEN_WIDTH < 375 ? 20 : 24;



const renderTabBar = (props: BottomTabBarProps) => <PickerTabBar {...props} />;



const TabHeader = React.memo(function TabHeader() {

  const { pendingCount, isProcessing } = useOfflineQueue();



  return (

    <>

      <AppHeader />

      {pendingCount > 0 && (

        <View style={styles.offlineBanner}>

          <OfflineSyncIndicator pendingCount={pendingCount} isProcessing={isProcessing} />

        </View>

      )}

    </>

  );

});



export default function TabLayout() {

  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  useEffect(() => {
    console.log("[SCREEN MOUNT]", pathname);
  }, [pathname]);

  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom;



  const screenOptions = useMemo(

    () => ({

      tabBarActiveTintColor: ShellColors.accent,

      tabBarInactiveTintColor: ShellColors.onBrandMuted,

      tabBarShowLabel: true,

      headerShown: true as const,

      header: () => <TabHeader />,

      headerStyle: {

        backgroundColor: ShellColors.brand,

        borderBottomWidth: 0,

        shadowOpacity: 0,

        elevation: 0,

      },

      headerShadowVisible: false,

      sceneContainerStyle: {

        backgroundColor: BaseColors.gray[50],

        flex: 1,

      },

      lazy: false,

      animation: "none" as const,

      tabBarStyle: {

        height: tabBarHeight,

        backgroundColor: ShellColors.footer,

        borderTopWidth: 0,

        elevation: 0,

        zIndex: 10,

      },

    }),

    [tabBarHeight]

  );



  return (

    <Tabs screenOptions={screenOptions} tabBar={renderTabBar}>

      <Tabs.Screen

        name="index"

        options={{

          title: "Home",

          tabBarLabel: "Home",

          tabBarIcon: ({ color, focused }) => (

            <Home color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 2.5 : 2} />

          ),

        }}

      />

      <Tabs.Screen

        name="attendance"

        options={{

          title: "Attendance",

          tabBarLabel: "Attendance",

          tabBarIcon: ({ color, focused }) => (

            <Calendar color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 2.5 : 2} />

          ),

        }}

      />

      <Tabs.Screen

        name="performance"

        options={{

          title: "Performance",

          tabBarLabel: "Performance",

          tabBarIcon: ({ color, focused }) => (

            <Target color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 2.5 : 2} />

          ),

        }}

      />

      <Tabs.Screen

        name="profile"

        options={{

          title: "Profile",

          tabBarLabel: "Profile",

          tabBarIcon: ({ color, focused }) => (

            <User color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 2.5 : 2} />

          ),

        }}

      />

    </Tabs>

  );

}



const styles = StyleSheet.create({

  offlineBanner: {

    paddingHorizontal: 16,

    paddingBottom: 8,

    backgroundColor: ShellColors.brand,

  },

});


