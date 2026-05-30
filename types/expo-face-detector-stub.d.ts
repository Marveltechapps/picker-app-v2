/**
 * Temporary type stub for deprecated expo-face-detector
 * TODO: Migrate to react-native-vision-camera-face-detector
 * This file allows the code to compile but face detection will not work
 * until migration is complete.
 */

declare module 'expo-face-detector' {
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

  export enum FaceDetectorMode {
    fast = 'fast',
    accurate = 'accurate',
  }

  export enum FaceDetectorLandmarks {
    none = 'none',
    all = 'all',
  }

  export enum FaceDetectorClassifications {
    none = 'none',
    all = 'all',
  }

  export interface FaceDetectorOptions {
    mode?: FaceDetectorMode;
    detectLandmarks?: FaceDetectorLandmarks;
    runClassifications?: FaceDetectorClassifications;
    minDetectionInterval?: number;
    tracking?: boolean;
  }
}
