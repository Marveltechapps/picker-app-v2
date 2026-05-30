/**
 * Training Service
 *
 * Handles training videos and progress per backend-workflow.yaml
 * (training_progress_get, training_progress_upsert, training_videos).
 */

import { apiGet, apiPut, apiPost, ApiClientError } from "@/utils/apiClient";

export interface TrainingProgress {
  video1: number;
  video2: number;
  video3: number;
  video4: number;
}

/** Training video from API (dashboard-managed) */
export interface TrainingVideoItem {
  videoId: string;
  title: string;
  description?: string;
  duration: number;
  durationDisplay: string;
  videoUrl: string;
  thumbnailUrl?: string;
  order: number;
  progress: number;
  completed: boolean;
  watchedSeconds?: number;
  lastWatchedPosition?: number;
}

interface ApiDataResponse<T> {
  success?: boolean;
  data: T;
}

/**
 * GET /training/videos – fetch all active training videos with user progress.
 * Reflects dashboard-managed content (Admin → Training Content).
 */
export async function getTrainingVideosApi(): Promise<TrainingVideoItem[]> {
  try {
    const res = await apiGet<ApiDataResponse<TrainingVideoItem[]>>("/training/videos");
    const data = (res as ApiDataResponse<TrainingVideoItem[]>).data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof ApiClientError) return [];
    throw error;
  }
}

/** GET /training/videos/:videoId — duration, minimum watch %, URL for module player. */
export async function getTrainingVideoByIdApi(videoId: string): Promise<TrainingVideoItem | null> {
  try {
    const res = await apiGet<ApiDataResponse<TrainingVideoItem> & { data?: TrainingVideoItem }>(
      `/training/videos/${encodeURIComponent(videoId)}`
    );
    const data =
      (res as ApiDataResponse<TrainingVideoItem>).data ??
      (res as { data?: TrainingVideoItem }).data;
    return data && typeof data === "object" ? data : null;
  } catch (error) {
    if (error instanceof ApiClientError) return null;
    throw error;
  }
}

export async function trackTrainingWatchProgressApi(
  videoId: string,
  watchedSeconds: number,
  currentPosition: number
): Promise<void> {
  await apiPut("/training/watch-progress", {
    videoId,
    watchedSeconds: Math.max(0, Math.floor(watchedSeconds)),
    currentPosition: Math.max(0, Math.floor(currentPosition)),
  });
}


/**
 * GET /training/progress – return current user training progress
 */
export async function getTrainingProgress(): Promise<TrainingProgress> {
  try {
    const res = await apiGet<ApiDataResponse<TrainingProgress>>("/training/progress");
    const data = (res as ApiDataResponse<TrainingProgress>).data;
    return (
      data ?? { video1: 0, video2: 0, video3: 0, video4: 0 }
    );
  } catch (error) {
    if (error instanceof ApiClientError) return { video1: 0, video2: 0, video3: 0, video4: 0 };
    throw error;
  }
}

/**
 * PUT /training/progress – update training progress (video1..video4 or dynamic videoIds, 0–100)
 */
export async function updateTrainingProgressApi(
  progress: Partial<TrainingProgress> | Record<string, number>
): Promise<TrainingProgress> {
  try {
    const res = await apiPut<ApiDataResponse<TrainingProgress>>("/training/progress", progress);
    return (res as ApiDataResponse<TrainingProgress>).data ?? { video1: 0, video2: 0, video3: 0, video4: 0 };
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw error;
  }
}

/**
 * POST /training/complete/:videoId - marks a specific video as fully watched
 */
export async function completeTrainingVideoApi(videoId: string): Promise<any> {
  return await apiPost(`/training/complete/${videoId}`);
}

/**
 * POST /training/modules/:moduleId/complete — marks module (video) complete after watch threshold.
 */
export async function completeTrainingModuleApi(moduleId: string): Promise<unknown> {
  return await apiPost(`/training/modules/${encodeURIComponent(moduleId)}/complete`);
}
