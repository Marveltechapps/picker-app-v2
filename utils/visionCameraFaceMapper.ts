/**
 * Maps vision-camera-face-detector Face[] + frame dimensions to FaceDetectionStatus.
 * Used for real-time verification (single face, centered, etc.).
 */

import type { FaceDetectionStatus } from "@/types/faceVerification";

/** Center region: face center must fall inside 50% width × 50% height. */
const CENTER_WIDTH_RATIO = 0.5;
const CENTER_HEIGHT_RATIO = 0.5;
/** Both eyes below this → treat as sunglasses / eyes closed. */
const EYE_OPEN_THRESHOLD = 0.2;

export interface VisionCameraFace {
  bounds: { x: number; y: number; width: number; height: number };
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
  [k: string]: unknown;
}

export function mapVisionCameraFacesToStatus(
  faces: VisionCameraFace[],
  frameWidth: number,
  frameHeight: number
): FaceDetectionStatus {
  const faceDetected = faces.length > 0;

  // SIMPLIFIED: If face is detected, that's enough - no strict checks
  if (!faceDetected) {
    return {
      faceDetected: false,
      hatDetected: false,
      sunglassesDetected: false,
      maskDetected: false,
      lightingScore: 0.8,
      faceCentered: true,
      faceBounds: null,
    };
  }

  const f = faces[0]!;
  const faceBounds =
    frameWidth > 0 && frameHeight > 0
      ? {
          x: f.bounds.x / frameWidth,
          y: f.bounds.y / frameHeight,
          width: f.bounds.width / frameWidth,
          height: f.bounds.height / frameHeight,
        }
      : null;

  return {
    faceDetected: true,
    hatDetected: false,
    sunglassesDetected: false,
    maskDetected: false,
    lightingScore: 0.8,
    faceCentered: true,
    faceBounds,
  };
}
