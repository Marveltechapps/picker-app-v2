import type { FaceDetectionStatus } from "@/components/FaceDetectionCamera";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Define a generic face type to avoid importing unsupported module
interface GenericFace {
  frame: {
    origin: { x: number; y: number };
    size: { x: number; y: number };
  };
  hasLeftEyeOpenProbability?: boolean;
  hasRightEyeOpenProbability?: boolean;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
}

/** Center region of image (oval-like): 50% width, 50% height. Face center must fall inside. */
const CENTER_REGION_WIDTH_RATIO = 0.5;
const CENTER_REGION_HEIGHT_RATIO = 0.5;

/** Both eyes below this threshold → treat as likely sunglasses (or eyes closed). */
const EYE_OPEN_SUNGLASSES_THRESHOLD = 0.2;

/**
 * Maps ML Kit face detection result + image dimensions to FaceDetectionStatus.
 * Used for real-time live verification (face in oval, no glasses, etc.).
 * Safe for Expo Go - uses generic types instead of importing unsupported module.
 */
export function mapFacesToDetectionStatus(
  faces: GenericFace[],
  imageWidth: number,
  imageHeight: number
): FaceDetectionStatus {
  const faceDetected = faces.length > 0;

  if (!faceDetected) {
    return {
      faceDetected: false,
      hatDetected: false,
      sunglassesDetected: false,
      maskDetected: false,
      lightingScore: 0.3,
      faceCentered: false,
      faceBounds: null,
    };
  }

  const face = faces[0]!;
  const { frame } = face;
  const ox = frame.origin.x;
  const oy = frame.origin.y;
  const w = frame.size.x;
  const h = frame.size.y;
  const faceCenterX = ox + w / 2;
  const faceCenterY = oy + h / 2;

  const centerMinX = (imageWidth * (1 - CENTER_REGION_WIDTH_RATIO)) / 2;
  const centerMaxX = imageWidth - centerMinX;
  const centerMinY = (imageHeight * (1 - CENTER_REGION_HEIGHT_RATIO)) / 2;
  const centerMaxY = imageHeight - centerMinY;

  const faceCentered =
    faceCenterX >= centerMinX &&
    faceCenterX <= centerMaxX &&
    faceCenterY >= centerMinY &&
    faceCenterY <= centerMaxY;

  let sunglassesDetected = false;
  if (face.hasLeftEyeOpenProbability && face.hasRightEyeOpenProbability) {
    const l = face.leftEyeOpenProbability ?? 1;
    const r = face.rightEyeOpenProbability ?? 1;
    sunglassesDetected = l < EYE_OPEN_SUNGLASSES_THRESHOLD && r < EYE_OPEN_SUNGLASSES_THRESHOLD;
  }

  return {
    faceDetected: true,
    hatDetected: false,
    sunglassesDetected,
    maskDetected: false,
    lightingScore: 0.85,
    faceCentered,
    faceBounds: null,
  };
}
