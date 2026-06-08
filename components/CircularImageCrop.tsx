import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Image,
  useWindowDimensions,
  PanResponder,
  Animated,
  Text,
  ActivityIndicator,
  Platform,
} from "react-native";
import { GestureHandlerRootView, PinchGestureHandler, State } from "react-native-gesture-handler";
import * as ImageManipulator from "expo-image-manipulator";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";
import { isValidImageUri, getSafeImageSource } from "@/utils/imageUriValidator";

const getCropSize = (windowWidth: number) => Math.min(windowWidth - 48, 340);
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const OUTPUT_SIZE = 512;

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
  const styles = useMemo(() => createStyles(CROP_SIZE), [CROP_SIZE]);

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const translateX = useRef(0);
  const translateY = useRef(0);
  const userScale = useRef(1);
  const pinchStartScale = useRef(1);

  const translateXAnimated = useRef(new Animated.Value(0)).current;
  const translateYAnimated = useRef(new Animated.Value(0)).current;
  const scaleAnimated = useRef(new Animated.Value(1)).current;

  const resetTransforms = useCallback(() => {
    translateX.current = 0;
    translateY.current = 0;
    userScale.current = 1;
    pinchStartScale.current = 1;
    translateXAnimated.setValue(0);
    translateYAnimated.setValue(0);
    scaleAnimated.setValue(1);
  }, [scaleAnimated, translateXAnimated, translateYAnimated]);

  useEffect(() => {
    resetTransforms();
    if (!imageUri) return;
    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize({ width: CROP_SIZE, height: CROP_SIZE })
    );
  }, [imageUri, CROP_SIZE, resetTransforms]);

  const fitDimensions = useMemo(() => {
    if (!imageSize.width || !imageSize.height) {
      return { width: CROP_SIZE, height: CROP_SIZE };
    }
    const fitScale = Math.min(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
    return {
      width: imageSize.width * fitScale,
      height: imageSize.height * fitScale,
    };
  }, [imageSize, CROP_SIZE]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        translateXAnimated.setOffset(translateX.current);
        translateYAnimated.setOffset(translateY.current);
        translateXAnimated.setValue(0);
        translateYAnimated.setValue(0);
      },
      onPanResponderMove: (_, gesture) => {
        translateXAnimated.setValue(gesture.dx);
        translateYAnimated.setValue(gesture.dy);
      },
      onPanResponderRelease: () => {
        translateXAnimated.flattenOffset();
        translateYAnimated.flattenOffset();
        translateX.current += (translateXAnimated as { _value?: number })._value ?? 0;
        translateY.current += (translateYAnimated as { _value?: number })._value ?? 0;
        translateXAnimated.setValue(0);
        translateYAnimated.setValue(0);
      },
      onPanResponderTerminate: () => {
        translateXAnimated.flattenOffset();
        translateYAnimated.flattenOffset();
        translateX.current += (translateXAnimated as { _value?: number })._value ?? 0;
        translateY.current += (translateYAnimated as { _value?: number })._value ?? 0;
        translateXAnimated.setValue(0);
        translateYAnimated.setValue(0);
      },
    })
  ).current;

  const onPinchGestureEvent = (event: { nativeEvent: { scale: number } }) => {
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, pinchStartScale.current * event.nativeEvent.scale)
    );
    scaleAnimated.setValue(next);
  };

  const onPinchStateChange = (event: { nativeEvent: { oldState: number; scale: number } }) => {
    if (event.nativeEvent.oldState === State.BEGAN) {
      pinchStartScale.current = userScale.current;
    }
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const next = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, pinchStartScale.current * event.nativeEvent.scale)
      );
      userScale.current = next;
      scaleAnimated.setValue(next);
    }
  };

  const cropVisibleRegion = useCallback(async () => {
    if (!imageSize.width || !imageSize.height) return null;

    const displayW = fitDimensions.width * userScale.current;
    const displayH = fitDimensions.height * userScale.current;
    const imgLeft = CROP_SIZE / 2 + translateX.current - displayW / 2;
    const imgTop = CROP_SIZE / 2 + translateY.current - displayH / 2;
    const pixelsPerPoint = imageSize.width / displayW;

    const cropSizeInImage = CROP_SIZE * pixelsPerPoint;
    const centerX = (CROP_SIZE / 2 - imgLeft) * pixelsPerPoint;
    const centerY = (CROP_SIZE / 2 - imgTop) * pixelsPerPoint;

    let originX = Math.round(centerX - cropSizeInImage / 2);
    let originY = Math.round(centerY - cropSizeInImage / 2);
    let cropW = Math.round(cropSizeInImage);
    let cropH = Math.round(cropSizeInImage);

    originX = Math.max(0, Math.min(originX, imageSize.width - 1));
    originY = Math.max(0, Math.min(originY, imageSize.height - 1));
    cropW = Math.min(cropW, imageSize.width - originX);
    cropH = Math.min(cropH, imageSize.height - originY);
    const square = Math.min(cropW, cropH);

    return ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX,
            originY,
            width: square,
            height: square,
          },
        },
        { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } },
      ],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
  }, [CROP_SIZE, fitDimensions, imageSize, imageUri]);

  const handleCrop = async () => {
    setIsProcessing(true);
    try {
      const result = await cropVisibleRegion();
      if (result?.uri) onCropComplete(result.uri);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseFullPhoto = async () => {
    setIsProcessing(true);
    try {
      const maxEdge = Math.max(imageSize.width, imageSize.height);
      const actions: ImageManipulator.Action[] = [];
      if (maxEdge > 1024) {
        if (imageSize.width >= imageSize.height) {
          actions.push({ resize: { width: 1024 } });
        } else {
          actions.push({ resize: { height: 1024 } });
        }
      }
      const result = await ImageManipulator.manipulateAsync(imageUri, actions, {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onCropComplete(result.uri);
    } catch (error) {
      console.error("Error using full photo:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={styles.title}>Adjust Profile Photo</Text>
      <Text style={styles.subtitle}>Full image is shown. Pinch to zoom, drag to position, then crop.</Text>

      <View style={styles.cropArea}>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View
            style={[
              styles.imageStage,
              {
                transform: [
                  { translateX: Animated.add(translateXAnimated, translateX.current) },
                  { translateY: Animated.add(translateYAnimated, translateY.current) },
                  { scale: scaleAnimated },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {isValidImageUri(imageUri) && getSafeImageSource(imageUri) ? (
              <Image
                source={getSafeImageSource(imageUri)!}
                style={{ width: fitDimensions.width, height: fitDimensions.height }}
                resizeMode="contain"
              />
            ) : null}
          </Animated.View>
        </PinchGestureHandler>

        <View style={styles.cropFrame} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>

      <Text style={styles.instructionText}>Drag to move • Pinch to zoom in/out</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isProcessing}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleUseFullPhoto}
          disabled={isProcessing}
        >
          <Text style={styles.secondaryButtonText}>Use Full Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cropButton, isProcessing && styles.buttonDisabled]}
          onPress={handleCrop}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.cropButtonText}>Crop & Use</Text>
          )}
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const CORNER_LEN = 22;
const CORNER_THICK = 3;

const createStyles = (cropSize: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.gray[900],
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    title: {
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.bold,
      color: Colors.white,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: Typography.fontSize.sm,
      color: Colors.gray[400],
      textAlign: "center",
      marginBottom: Spacing.xl,
      paddingHorizontal: Spacing.md,
    },
    cropArea: {
      width: cropSize,
      height: cropSize,
      overflow: "hidden",
      position: "relative",
      backgroundColor: Colors.gray[800],
      borderWidth: 1,
      borderColor: Colors.gray[600],
    },
    imageStage: {
      width: cropSize,
      height: cropSize,
      justifyContent: "center",
      alignItems: "center",
    },
    cropFrame: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.95)",
    },
    corner: {
      position: "absolute",
      width: CORNER_LEN,
      height: CORNER_LEN,
      borderColor: Colors.white,
    },
    cornerTopLeft: {
      top: -1,
      left: -1,
      borderTopWidth: CORNER_THICK,
      borderLeftWidth: CORNER_THICK,
    },
    cornerTopRight: {
      top: -1,
      right: -1,
      borderTopWidth: CORNER_THICK,
      borderRightWidth: CORNER_THICK,
    },
    cornerBottomLeft: {
      bottom: -1,
      left: -1,
      borderBottomWidth: CORNER_THICK,
      borderLeftWidth: CORNER_THICK,
    },
    cornerBottomRight: {
      bottom: -1,
      right: -1,
      borderBottomWidth: CORNER_THICK,
      borderRightWidth: CORNER_THICK,
    },
    instructionText: {
      marginTop: Spacing.lg,
      fontSize: Typography.fontSize.md,
      color: Colors.gray[400],
      textAlign: "center",
    },
    actions: {
      width: "100%",
      marginTop: Spacing.xl,
      gap: Spacing.sm,
    },
    cancelButton: {
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.gray[700],
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: Typography.fontSize.md,
      fontWeight: Typography.fontWeight.semibold,
      color: Colors.white,
    },
    secondaryButton: {
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.gray[700],
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.gray[500],
    },
    secondaryButtonText: {
      fontSize: Typography.fontSize.md,
      fontWeight: Typography.fontWeight.semibold,
      color: Colors.gray[200],
    },
    cropButton: {
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary[650],
      alignItems: "center",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    cropButtonText: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.bold,
      color: Colors.white,
    },
  });
