/**
 * Face Recognition Service
 *
 * Simple verification only: no face detection, no expo-face-detector require (fixes Expo Go crash).
 * Camera runs without face detector; verification is timer/button only.
 */

import type { FaceDetectionStatus } from '@/types/faceVerification';

export interface FaceFeature {
  bounds: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  landmarks?: {
    leftEye?: { position: { x: number; y: number } };
    rightEye?: { position: { x: number; y: number } };
  };
}

export interface FaceDetectionResult {
  faces: FaceFeature[];
  imageWidth: number;
  imageHeight: number;
}

export interface FaceQualityCheck {
  isValid: boolean;
  issues: string[];
  score: number; // 0-1 quality score
}

class FaceRecognitionService {
  /**
   * Process face detection results and update status.
   * SIMPLIFIED: Any face detected = faceDetected true. No quality/lighting/center checks.
   * Returns normalized 0–1 faceBounds for the first face so UI can draw overlay.
   */
  processFaceDetection(
    faces: FaceFeature[],
    imageWidth: number,
    imageHeight: number
  ): FaceDetectionStatus {
    const faceDetected = faces.length > 0;
    let faceBounds: FaceDetectionStatus['faceBounds'] = null;
    if (faces.length >= 1 && imageWidth > 0 && imageHeight > 0) {
      const f = faces[0]!;
      const { origin, size } = f.bounds;
      faceBounds = {
        x: origin.x / imageWidth,
        y: origin.y / imageHeight,
        width: size.width / imageWidth,
        height: size.height / imageHeight,
      };
    }

    return {
      faceDetected,
      hatDetected: false,
      sunglassesDetected: false,
      maskDetected: false,
      lightingScore: faceDetected ? 0.9 : 0.3,
      faceCentered: faceDetected,
      faceBounds,
    };
  }

  /**
   * Validate face quality for verification
   */
  validateFaceQuality(status: FaceDetectionStatus): FaceQualityCheck {
    const issues: string[] = [];
    
    if (!status.faceDetected) {
      issues.push('No face detected');
    }
    
    if (status.hatDetected) {
      issues.push('Please remove hat');
    }
    
    if (status.sunglassesDetected) {
      issues.push('Please remove sunglasses');
    }
    
    if (status.maskDetected) {
      issues.push('Please remove mask');
    }
    
    if (status.lightingScore < 0.7) {
      issues.push('Improve lighting');
    }
    
    if (!status.faceCentered) {
      issues.push('Center your face');
    }
    
    // Calculate quality score
    let score = 0;
    if (status.faceDetected) score += 0.3;
    if (!status.hatDetected) score += 0.15;
    if (!status.sunglassesDetected) score += 0.15;
    if (!status.maskDetected) score += 0.15;
    if (status.lightingScore > 0.7) score += 0.15;
    if (status.faceCentered) score += 0.1;
    
    return {
      isValid: issues.length === 0 && status.faceDetected,
      issues,
      score,
    };
  }

  /**
   * Always undefined: simple verification only. No face detection, no expo-face-detector (avoids crash).
   */
  getFaceDetectorSettings(): undefined {
    return undefined;
  }

  /**
   * Always false: simple verification only. No face verification.
   */
  isFaceDetectionAvailable(): boolean {
    return false;
  }

  /** Simple rule: exactly one face detected → ready to verify. */
  shouldVerify(faces: FaceFeature[]): boolean {
    return faces.length === 1;
  }
}

export default new FaceRecognitionService();
