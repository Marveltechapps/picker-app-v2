# Android ProGuard rules for production APK - prevents native module stripping
# Used by expo-build-properties plugin (extraProguardRules)

# React Native Vision Camera
-keep class com.mrousavy.camera.** { *; }
-keep class com.mrousavy.cameraview.** { *; }
-dontwarn com.mrousavy.camera.**

# React Native Worklets Core
-keep class com.worklets.** { *; }
-dontwarn com.worklets.**

# ML Kit Face Detection
-keep class com.google.mlkit.vision.face.** { *; }
-keep class com.infinitered.reactnativemlkit.** { *; }
-dontwarn com.google.mlkit.vision.face.**
-dontwarn com.infinitered.reactnativemlkit.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# Expo Face Detector (used by FaceVerifySheet / expo-camera)
-keep class expo.modules.facedetector.** { *; }
-dontwarn expo.modules.facedetector.**

# Expo Camera
-keep class expo.modules.camera.** { *; }
-dontwarn expo.modules.camera.**

# Expo Image Picker (prevents "Failed to parse PhotoPicker result" in release APK)
-keep class expo.modules.imagepicker.** { *; }
-keepclassmembers class expo.modules.imagepicker.** { *; }
-dontwarn expo.modules.imagepicker.**

# Expo Video (prevents native crash on navigation from training-video in release APK)
-keep class expo.modules.video.** { *; }
-keep class expo.modules.av.** { *; }
-dontwarn expo.modules.video.**

# React Native Gesture Handler (prevents touch/navigation crash in release APK)
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# AsyncStorage / React Native async storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Expo modules (constants, notifications, etc.) - prevent stripping in standalone APK
-keep class expo.modules.** { *; }
-keep class expo.modules.Constants.** { *; }
-dontwarn expo.modules.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep React Native bridge
-keep @com.facebook.react.bridge.ReactMethod class *
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}
