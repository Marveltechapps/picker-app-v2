import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Image,
  useWindowDimensions,
  PanResponder,
  Animated,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
} from "react-native";
import { GestureHandlerRootView, PinchGestureHandler, State } from "react-native-gesture-handler";
import Svg, { Circle, Defs, Mask, Rect } from "react-native-svg";
import * as ImageManipulator from "expo-image-manipulator";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";
import { isValidImageUri, getSafeImageSource } from "@/utils/imageUriValidator";

const getCropSize = (windowWidth: number) => Math.min(windowWidth - 80, 320);

interface CircularImageCropProps {
  imageUri: string;
  onCropComplete: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function CircularImageCrop({
  imageUri,
  onCropComplete,
  onCancel,
}: CircularImageCropProps) {
  const { width: windowWidth } = useWindowDimensions();
  const CROP_SIZE = useMemo(() => getCropSize(windowWidth), [windowWidth]);
  const CROP_RADIUS = CROP_SIZE / 2;
  const styles = useMemo(() => createStyles(CROP_SIZE, CROP_RADIUS), [CROP_SIZE, CROP_RADIUS]);

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const translateX = useRef(0);
  const translateY = useRef(0);
  
  const scaleAnimated = useRef(new Animated.Value(1)).current;
  const translateXAnimated = useRef(new Animated.Value(0)).current;
  const translateYAnimated = useRef(new Animated.Value(0)).current;
  
  const lastScale = useRef(1);

  // Get image dimensions - works on both native and web
  useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (width, height) => {
          setImageSize({ width, height });
        },
        (error) => {
          console.error("Error getting image size:", error);
          // Fallback to default size
          setImageSize({ width: CROP_SIZE * 1.5, height: CROP_SIZE * 1.5 });
        }
      );
    }
  }, [imageUri]);

  // Handle image load (for native platforms that provide source in event)
  const handleImageLoad = (event: any) => {
    // On native, we can get dimensions from the event
    if (Platform.OS !== 'web' && event.nativeEvent?.source) {
      const { width, height } = event.nativeEvent.source;
      if (width && height) {
        setImageSize({ width, height });
      }
    }
  };

  // Pan responder for dragging
  // Fixed for web: prevent "touch end without touch start" errors
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS !== 'web',
      onMoveShouldSetPanResponder: () => Platform.OS !== 'web',
      onPanResponderGrant: () => {
        if (Platform.OS === 'web') return;
        try {
          translateXAnimated.setOffset(translateX.current);
          translateYAnimated.setOffset(translateY.current);
        } catch (error) {
          if (__DEV__) {
            console.warn('PanResponder grant error:', error);
          }
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (Platform.OS === 'web') return;
        try {
          translateXAnimated.setValue(gestureState.dx);
          translateYAnimated.setValue(gestureState.dy);
        } catch (error) {
          if (__DEV__) {
            console.warn('PanResponder move error:', error);
          }
        }
      },
      onPanResponderRelease: () => {
        if (Platform.OS === 'web') return;
        try {
          translateXAnimated.flattenOffset();
          translateYAnimated.flattenOffset();
          translateX.current += (translateXAnimated as { _value?: number })._value ?? 0;
          translateY.current += (translateYAnimated as { _value?: number })._value ?? 0;
          translateXAnimated.setValue(0);
          translateYAnimated.setValue(0);
        } catch (error) {
          if (__DEV__) {
            console.warn('PanResponder release error:', error);
          }
        }
      },
      onPanResponderTerminate: () => {
        if (Platform.OS === 'web') return;
        // Handle gesture termination (e.g., when interrupted by system)
        try {
          translateXAnimated.flattenOffset();
          translateYAnimated.flattenOffset();
          translateX.current += (translateXAnimated as { _value?: number })._value ?? 0;
          translateY.current += (translateYAnimated as { _value?: number })._value ?? 0;
          translateXAnimated.setValue(0);
          translateYAnimated.setValue(0);
        } catch (error) {
          if (__DEV__) {
            console.warn('PanResponder terminate error:', error);
          }
        }
      },
    })
  ).current;

  // Pinch gesture handler
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: scaleAnimated } }],
    { useNativeDriver: Platform.OS !== 'web' }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current *= event.nativeEvent.scale;
      
      // Constrain scale
      const minScale = 1;
      const maxScale = 3;
      if (lastScale.current < minScale) {
        lastScale.current = minScale;
      } else if (lastScale.current > maxScale) {
        lastScale.current = maxScale;
      }
      
      // Update animated value to reflect the new scale
      scaleAnimated.setValue(lastScale.current);
    }
  };

  // Calculate image display dimensions
  const getImageDimensions = () => {
    if (!imageSize.width || !imageSize.height) {
      return { width: CROP_SIZE * 1.5, height: CROP_SIZE * 1.5 };
    }
    
    const imageAspectRatio = imageSize.width / imageSize.height;
    let displayWidth = CROP_SIZE * 1.5;
    let displayHeight = CROP_SIZE * 1.5;

    if (imageAspectRatio > 1) {
      displayHeight = displayWidth / imageAspectRatio;
    } else {
      displayWidth = displayHeight * imageAspectRatio;
    }

    return { width: displayWidth, height: displayHeight };
  };

  // Crop image to perfect circle
  const handleCrop = async () => {
    if (!imageSize.width || !imageSize.height) return;

    setIsProcessing(true);

    try {
      const { width: displayWidth, height: displayHeight } = getImageDimensions();
      const scaledWidth = displayWidth * lastScale.current;
      const scaledHeight = displayHeight * lastScale.current;
      
      // Calculate the visible area in the crop circle
      // The crop circle is centered at (CROP_SIZE/2, CROP_SIZE/2)
      const cropCenterX = CROP_SIZE / 2;
      const cropCenterY = CROP_SIZE / 2;
      
      // Calculate the image center position in the crop view
      const imageCenterX = CROP_SIZE / 2 + translateX.current;
      const imageCenterY = CROP_SIZE / 2 + translateY.current;
      
      // Calculate the offset from crop center to image center
      const offsetX = imageCenterX - cropCenterX;
      const offsetY = imageCenterY - cropCenterY;
      
      // Convert screen coordinates to image coordinates
      const scaleFactor = scaledWidth / imageSize.width;
      const imageOffsetX = offsetX / scaleFactor;
      const imageOffsetY = offsetY / scaleFactor;
      
      // Calculate crop region (square that fits in circle)
      const cropSize = Math.min(imageSize.width, imageSize.height);
      const centerX = imageSize.width / 2 + imageOffsetX;
      const centerY = imageSize.height / 2 + imageOffsetY;
      
      const cropX = Math.max(0, Math.min(imageSize.width - cropSize, centerX - cropSize / 2));
      const cropY = Math.max(0, Math.min(imageSize.height - cropSize, centerY - cropSize / 2));

      // Crop to square first
      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropSize,
              height: cropSize,
            },
          },
          { resize: { width: 512, height: 512 } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      onCropComplete(cropped.uri);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const { width: displayWidth, height: displayHeight } = getImageDimensions();

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.cropArea}>
        {/* Image with Gestures */}
        <PinchGestureHandler
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                transform: [
                  { translateX: Animated.add(translateXAnimated, translateX.current) },
                  { translateY: Animated.add(translateYAnimated, translateY.current) },
                  { scale: scaleAnimated },
                ],
              },
            ]}
            {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
          >
            {isValidImageUri(imageUri) && getSafeImageSource(imageUri) && (
              <Image
                source={getSafeImageSource(imageUri)!}
                style={[
                  styles.image,
                  {
                    width: displayWidth,
                    height: displayHeight,
                  },
                ]}
                onError={(error) => {
                  // Suppress blob URL errors on web - they're expected when URLs are revoked
                  if (Platform.OS === 'web' && imageUri?.startsWith('blob:')) {
                    return; // Silently ignore blob URL errors
                  }
                  if (__DEV__) {
                    console.warn('Failed to load image for crop:', imageUri, error);
                  }
                }}
                resizeMode="contain"
                onLoad={handleImageLoad}
              />
            )}
          </Animated.View>
        </PinchGestureHandler>

        {/* Circular Mask Overlay using SVG */}
        <View style={[styles.overlayContainer, { pointerEvents: "none" as const }]}>
          <Svg width={CROP_SIZE} height={CROP_SIZE} style={styles.svgOverlay}>
            <Defs>
              <Mask id="circleMask">
                <Rect width={CROP_SIZE} height={CROP_SIZE} fill="white" />
                <Circle cx={CROP_RADIUS} cy={CROP_RADIUS} r={CROP_RADIUS} fill="black" />
              </Mask>
            </Defs>
            <Rect
              width={CROP_SIZE}
              height={CROP_SIZE}
              fill="rgba(0, 0, 0, 0.7)"
              mask="url(#circleMask)"
            />
            <Circle
              cx={CROP_RADIUS}
              cy={CROP_RADIUS}
              r={CROP_RADIUS}
              fill="none"
              stroke={Colors.white}
              strokeWidth={2}
            />
          </Svg>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>Drag to move • Pinch to zoom</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={isProcessing}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.cropButton, isProcessing && styles.cropButtonDisabled]}
          onPress={handleCrop}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.cropButtonText}>Crop</Text>
          )}
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const createStyles = (cropSize: number, cropRadius: number) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[900],
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing['3xl'],
  },
  cropArea: {
    width: cropSize,
    height: cropSize,
    borderRadius: cropRadius,
    overflow: "hidden",
    position: "relative" as const,
    backgroundColor: Colors.gray[800],
  },
  imageWrapper: {
    width: cropSize,
    height: cropSize,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    backgroundColor: "transparent",
  },
  overlayContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: cropSize,
    height: cropSize,
    zIndex: 10,
  },
  svgOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
  },
  instructions: {
    marginTop: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
  },
  instructionText: {
    fontSize: Typography.fontSize.md,
    color: Colors.gray[400],
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray[700],
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  cropButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
  },
  cropButtonDisabled: {
    opacity: 0.6,
  },
  cropButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});
