import React from "react";
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { TouchableOpacity, touchableCardDefaults } from "@/utils/touchables";

type ScreenTabButtonProps = {
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  activeStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  activeLabelStyle?: StyleProp<TextStyle>;
};

/** In-screen tab chip with a full-width touch target (icon + label + padding). */
export function ScreenTabButton({
  active,
  onPress,
  icon,
  label,
  style,
  activeStyle,
  labelStyle,
  activeLabelStyle,
}: ScreenTabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={touchableCardDefaults.activeOpacity}
      delayPressIn={touchableCardDefaults.delayPressIn}
      pressRetentionOffset={touchableCardDefaults.pressRetentionOffset}
      style={[styles.tab, style, active && activeStyle]}
    >
      <View pointerEvents="none" style={styles.inner}>
        {icon}
        <Text style={[labelStyle, active && activeLabelStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

type ScreenTabBarProps<T extends string> = {
  tabs: Array<{
    id: T;
    label: string;
    icon: (active: boolean) => React.ReactNode;
  }>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  containerStyle?: StyleProp<ViewStyle>;
  tabStyle?: StyleProp<ViewStyle>;
  activeTabStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  activeLabelStyle?: StyleProp<TextStyle>;
};

export function ScreenTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  containerStyle,
  tabStyle,
  activeTabStyle,
  labelStyle,
  activeLabelStyle,
}: ScreenTabBarProps<T>) {
  return (
    <View style={containerStyle}>
      {tabs.map((tab) => (
        <ScreenTabButton
          key={tab.id}
          active={activeTab === tab.id}
          onPress={() => onTabChange(tab.id)}
          icon={tab.icon(activeTab === tab.id)}
          label={tab.label}
          style={tabStyle}
          activeStyle={activeTabStyle}
          labelStyle={labelStyle}
          activeLabelStyle={activeLabelStyle}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignSelf: "stretch",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
});
