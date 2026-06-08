import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { Pressable } from "@/utils/touchables";
import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalGestureRoot from "./ModalGestureRoot";
import { X, ChevronLeft } from "lucide-react-native";

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  height?: string;
  scrollable?: boolean;
  onBack?: () => void;
  /** When false, backdrop tap does not dismiss (e.g. during active verification). */
  closeOnBackdropPress?: boolean;
  /** bottom = slide up from bottom (default). top = slide down from top. */
  placement?: "bottom" | "top";
  /** Hide default header (use custom header inside children). */
  hideHeader?: boolean;
}

export default function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  height = "60%",
  scrollable = false,
  onBack,
  closeOnBackdropPress = true,
  placement = "bottom",
  hideHeader = false,
}: BottomSheetModalProps) {
  const screenHeight = Dimensions.get("window").height;
  const heightValue = height.includes("%")
    ? (parseFloat(height) / 100) * screenHeight
    : parseFloat(height);

  const slideAnim = useRef(new Animated.Value(placement === "top" ? -heightValue : heightValue)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    slideAnim.setValue(placement === "top" ? -heightValue : heightValue);
    fadeAnim.setValue(0);
  }, [visible, placement, heightValue, slideAnim, fadeAnim]);

  const ContentWrapper = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? {
        showsVerticalScrollIndicator: false,
        style: styles.scrollView,
        contentContainerStyle: styles.scrollContent,
        ...scrollViewTouchProps,
      }
    : { style: styles.content };

  const isTop = placement === "top";
  const sheetStyle = [
    isTop ? styles.topSheet : styles.bottomSheet,
    { height: heightValue, transform: [{ translateY: slideAnim }] },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <ModalGestureRoot>
        <View style={[styles.overlay, isTop && styles.overlayTop]}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <Pressable
              style={styles.backdropTapArea}
              onPress={closeOnBackdropPress ? onClose : undefined}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </Animated.View>

          <Animated.View style={sheetStyle} collapsable={false}>
            {isTop ? (
              <SafeAreaView edges={["top"]} style={styles.topSafeArea}>
                {!hideHeader ? (
                  <View style={styles.header} collapsable={false}>
                    {onBack ? (
                      <Pressable
                        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                        onPress={onBack}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <ChevronLeft color="#111827" size={24} strokeWidth={2} />
                      </Pressable>
                    ) : (
                      <View style={styles.headerLeft} />
                    )}
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
                      onPress={onClose}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X color="#6B7280" size={24} strokeWidth={2} />
                    </Pressable>
                  </View>
                ) : null}
                <ContentWrapper {...contentProps}>{children}</ContentWrapper>
                <View style={styles.bottomHandleBar} />
              </SafeAreaView>
            ) : (
              <>
                <View style={styles.handleBar} />
                {!hideHeader ? (
                  <View style={styles.header} collapsable={false}>
                    {onBack ? (
                      <Pressable
                        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                        onPress={onBack}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <ChevronLeft color="#111827" size={24} strokeWidth={2} />
                      </Pressable>
                    ) : (
                      <View style={styles.headerLeft} />
                    )}
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
                      onPress={onClose}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X color="#6B7280" size={24} strokeWidth={2} />
                    </Pressable>
                  </View>
                ) : null}
                <ContentWrapper {...contentProps}>{children}</ContentWrapper>
              </>
            )}
          </Animated.View>
        </View>
      </ModalGestureRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayTop: {
    justifyContent: "flex-start",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  backdropTapArea: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 16 },
    }),
  },
  topSheet: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 20 },
    }),
  },
  topSafeArea: {
    flex: 1,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  bottomHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerLeft: {
    width: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
});
