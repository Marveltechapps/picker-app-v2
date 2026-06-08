/**
 * Scrollable exports for the picker app.
 * Use React Native ScrollView (not gesture-handler ScrollView) so we avoid
 * NativeViewGestureHandler errors when tabs/screens mount under react-navigation.
 * Pair with touchables from @/utils/touchables for reliable taps inside scroll areas.
 */
import { ScrollView, FlatList } from "react-native";

export { ScrollView, FlatList };

/** Sensible defaults for screens with tappable content inside scroll areas. */
export const scrollViewTouchProps = {
  keyboardShouldPersistTaps: "always" as const,
  keyboardDismissMode: "on-drag" as const,
  nestedScrollEnabled: true,
};
