import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BottomTabBarHeightCallbackContext } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { ShellColors, SHELL_BAR_MIN_HEIGHT } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_LABEL_FONT_SIZE = SCREEN_WIDTH < 360 ? 9 : SCREEN_WIDTH < 390 ? 10 : 11;
const TAB_ICON_SIZE = SCREEN_WIDTH < 375 ? 22 : 24;

export const TAB_CONTENT_HEIGHT = SHELL_BAR_MIN_HEIGHT;

type TabBarItemProps = {
  label: string;
  isFocused: boolean;
  color: string;
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  labelStyle?: StyleProp<TextStyle>;
};

function TabBarItem({
  label,
  isFocused,
  color,
  icon,
  onPress,
  accessibilityLabel,
  testID,
  labelStyle,
}: TabBarItemProps) {

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(18, 19, 88, 0.12)", borderless: false }}
      style={({ pressed }) => [
        styles.tab,
        pressed && Platform.OS === "ios" ? styles.tabPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      <View style={styles.tabInner} pointerEvents="none">
        <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
          {icon}
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.label,
            { color, fontSize: TAB_LABEL_FONT_SIZE },
            isFocused && styles.labelActive,
            labelStyle,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function PickerTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const bottomPad = insets.bottom;
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);

  const visibleRoutes = state.routes;

  const handleBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onHeightChange?.(event.nativeEvent.layout.height);
    },
    [onHeightChange]
  );

  const handleTabPress = useCallback(
    (route: (typeof state.routes)[number], isFocused: boolean) => {
      const tabPressEvent = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !tabPressEvent.defaultPrevented) {
        navigation.dispatch({
          ...CommonActions.navigate(route),
          target: state.key,
        });
      }
    },
    [navigation, state.key]
  );

  const barHeight = SHELL_BAR_MIN_HEIGHT + bottomPad;

  return (
    <View
      style={[styles.barShell, { height: barHeight, paddingBottom: bottomPad }]}
      onLayout={handleBarLayout}
    >
      <View style={styles.tabRow}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const isFocused = state.index === routeIndex;
          const color = isFocused
            ? (options.tabBarActiveTintColor ?? ShellColors.accent)
            : (options.tabBarInactiveTintColor ?? ShellColors.onBrandMuted);

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color,
            size: TAB_ICON_SIZE,
          });

          return (
            <View key={route.key} style={styles.tabSlot}>
              <TabBarItem
                label={String(label)}
                isFocused={isFocused}
                color={color}
                icon={icon}
                onPress={() => handleTabPress(route, isFocused)}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                labelStyle={options.tabBarLabelStyle}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default PickerTabBar;

const styles = StyleSheet.create({
  barShell: {
    width: "100%",
    backgroundColor: ShellColors.footer,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ShellColors.border,
    zIndex: 10,
    ...Platform.select({
      android: { elevation: 12 },
    }),
  },
  tabRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
  },
  tabSlot: {
    flex: 1,
    alignSelf: "stretch",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web" ? { cursor: "pointer" as const } : {}),
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: ShellColors.brandLight,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  label: {
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
  },
  labelActive: {
    fontWeight: "700",
  },
});
