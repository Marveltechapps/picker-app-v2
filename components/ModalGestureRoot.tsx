import React from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/**
 * RN Modal renders outside the app root. Gesture-handler touchables need a
 * GestureHandlerRootView inside each modal on native Android/iOS.
 */
export default function ModalGestureRoot({ children }: { children: React.ReactNode }) {
  return <GestureHandlerRootView style={styles.root}>{children}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
