/**
 * Device Service
 *
 * Handles picker device assignment and return flows.
 * - GET /devices/assigned — device assigned to current picker
 * - POST /devices/return — return device with condition and optional photo
 * - POST /devices/upload-condition-photo — upload condition photo, get URL
 */

import { apiGet, apiPost, apiPostFormData, ApiClientError } from "@/utils/apiClient";

interface ApiDataResponse<T> {
  success?: boolean;
  data?: T;
  url?: string;
}

export interface AssignedDevice {
  id: string;
  deviceId: string;
  serial: string;
  status: string;
  assignedAt: string | null;
}

export type DeviceCondition = "good" | "damaged" | "other";

export interface ReturnDevicePayload {
  deviceId: string;
  condition?: DeviceCondition;
  conditionNotes?: string;
  conditionPhotoUrl?: string;
}

export interface ReturnDeviceResult {
  success: boolean;
  deviceId: string;
  status: string;
  returnedAt: string;
}

/**
 * Get the device assigned to the current picker.
 * Returns 404 if no device is assigned.
 */
export async function getAssignedDevice(): Promise<AssignedDevice | null> {
  try {
    const res = await apiGet<ApiDataResponse<AssignedDevice> | AssignedDevice>(
      "/devices/assigned"
    );
    if (res && typeof res === "object" && "data" in res && res.data) {
      return res.data;
    }
    return (res as AssignedDevice) ?? null;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Upload condition photo and get S3 URL.
 * Use this URL as conditionPhotoUrl when calling returnDevice.
 */
export async function uploadConditionPhoto(uri: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "image/jpeg",
    name: `condition-${Date.now()}.jpg`,
  } as unknown as Blob);
  const res = await apiPostFormData<{ data?: { url: string }; url?: string }>(
    "/devices/upload-condition-photo",
    formData
  );
  const url = res?.data?.url ?? res?.url;
  if (url) return url;
  throw new Error("Upload did not return URL");
}

/**
 * Return a device with JSON body (conditionPhotoUrl from uploadConditionPhoto).
 */
export async function returnDevice(
  payload: ReturnDevicePayload
): Promise<ReturnDeviceResult> {
  const res = await apiPost<
    ApiDataResponse<ReturnDeviceResult> | ReturnDeviceResult
  >("/devices/return", payload);
  if (res && typeof res === "object" && "data" in res && res.data) {
    return res.data as ReturnDeviceResult;
  }
  return res as ReturnDeviceResult;
}

/**
 * Return a device with photo sent as multipart (no separate upload needed).
 */
export async function returnDeviceWithPhoto(
  deviceId: string,
  condition: DeviceCondition,
  conditionNotes: string | undefined,
  photoUri: string
): Promise<ReturnDeviceResult> {
  const formData = new FormData();
  formData.append("deviceId", deviceId);
  formData.append("condition", condition);
  if (conditionNotes) formData.append("conditionNotes", conditionNotes);
  formData.append("conditionPhoto", {
    uri: photoUri,
    type: "image/jpeg",
    name: `condition-${Date.now()}.jpg`,
  } as unknown as Blob);
  const res = await apiPostFormData<
    ApiDataResponse<ReturnDeviceResult> | ReturnDeviceResult
  >("/devices/return", formData);
  if (res && typeof res === "object" && "data" in res && res.data) {
    return res.data as ReturnDeviceResult;
  }
  return res as ReturnDeviceResult;
}
