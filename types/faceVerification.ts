/**
 * Shared types for face verification (detection status, etc.).
 */

/** Normalized 0–1 bounds for drawing face overlay (x, y = top-left). */
export interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionStatus {
  faceDetected: boolean;
  hatDetected: boolean;
  sunglassesDetected: boolean;
  maskDetected: boolean;
  lightingScore: number;
  faceCentered: boolean;
  /** First face bounds in normalized 0–1 (for overlay). Set when exactly one face detected. */
  faceBounds: FaceBounds | null;
}
