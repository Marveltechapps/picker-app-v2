/**
 * Platform-aware touchable exports.
 * Android: gesture-handler touchables work better inside ScrollViews.
 * iOS: React Native touchables avoid GestureDetector errors in tab headers
 * and other react-navigation native containers that sit outside GestureHandlerRootView.
 */
import React from "react";
import {
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Pressable as RNPressable,
  TouchableOpacity as RNTouchableOpacity,
} from "react-native";
import {
  Pressable as GHPressable,
  TouchableOpacity as GHTouchableOpacity,
} from "react-native-gesture-handler";

const useGestureHandlerTouchables = Platform.OS === "android";

export const Pressable = useGestureHandlerTouchables ? GHPressable : RNPressable;
export const TouchableOpacity = useGestureHandlerTouchables
  ? GHTouchableOpacity
  : RNTouchableOpacity;

/** Defaults so taps register across the full card, not only on icons. */
export const touchableCardDefaults = {
  activeOpacity: 0.7,
  delayPressIn: 0,
  pressRetentionOffset: { top: 24, left: 24, right: 24, bottom: 24 },
} as const;

type TouchableCardProps = React.ComponentProps<typeof TouchableOpacity>;

/**
 * Row/card touch target where the entire surface opens the module.
 * Inner content uses pointerEvents="none" so text areas do not steal taps on Android.
 */
export function TouchableCard({
  children,
  style,
  activeOpacity,
  delayPressIn,
  pressRetentionOffset,
  ...props
}: TouchableCardProps) {
  return (
    <TouchableOpacity
      style={{ alignSelf: "stretch" }}
      activeOpacity={activeOpacity ?? touchableCardDefaults.activeOpacity}
      delayPressIn={delayPressIn ?? touchableCardDefaults.delayPressIn}
      pressRetentionOffset={pressRetentionOffset ?? touchableCardDefaults.pressRetentionOffset}
      {...props}
    >
      <View pointerEvents="none" style={style as StyleProp<ViewStyle>}>
        {children}
      </View>
    </TouchableOpacity>
  );
}
