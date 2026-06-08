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
  assigned?: boolean;
  id?: string;
  deviceId: string | null;
  serial: string;
  status: string | null;
  assignedAt: string | null;
  assignmentSource?: string;
  /** HHD app recently sent heartbeat for linked picker (handheld in use). */
  hhdActive?: boolean;
  /** HSD fleet device marked online from HHD heartbeat. */
  hsdDeviceOnline?: boolean;
  /** True when HHD app is active on the assigned handheld. */
  inUseOnHhd?: boolean;
  /** Battery % reported from HHD/HSD (not the personal phone). */
  hsdBatteryLevel?: number | null;
  hhdLastSeenAt?: string | null;
  hsdLastSeenAt?: string | null;
}

/** Shown when dashboard/HSD has assigned a device to this picker. */
export const DEVICE_ASSIGNED_LABEL = "Device Assigned";

/** Shown when no device is assigned. */
export const NO_DEVICE_ASSIGNED_LABEL = "No Assigned Device";

/** Same rules as Device Status screen — assigned flag, status, device id, or active HHD session. */
export function isDeviceAssignedRecord(
  device:
    | {
        assigned?: boolean;
        deviceId?: string | null;
        status?: string | null;
        hhdActive?: boolean;
        inUseOnHhd?: boolean;
      }
    | null
    | undefined
): boolean {
  if (!device) return false;
  const hhdActive = device.inUseOnHhd === true || device.hhdActive === true;
  const status = (device.status ?? "").trim().toUpperCase();
  return (
    device.assigned === true ||
    status === "ASSIGNED" ||
    !!device.deviceId ||
    hhdActive
  );
}

function formatDeviceStatus(status: string | undefined): string {
  if (!status) return "Not assigned";
  const normalized = status.trim().toUpperCase();
  if (normalized === "ASSIGNED") return DEVICE_ASSIGNED_LABEL;
  if (normalized === "AVAILABLE") return "Available";
  return status;
}

export { formatDeviceStatus };

/** Poll interval while Device Status screen is focused (ms). */
export const DEVICE_STATUS_POLL_MS = 12000;

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
function parseAssignedDevicePayload(
  payload: AssignedDevice | null | undefined
): AssignedDevice | null {
  if (!payload || typeof payload !== "object") return null;
  if (!isDeviceAssignedRecord(payload)) return null;
  const hhdActive = payload.hhdActive === true || payload.inUseOnHhd === true;
  const status = (payload.status ?? "").trim().toUpperCase();
  return {
    ...payload,
    assigned: true,
    status: status === "ASSIGNED" ? "ASSIGNED" : payload.status ?? "ASSIGNED",
    deviceId: payload.deviceId ?? null,
    hhdActive: hhdActive || payload.hhdActive,
    inUseOnHhd: hhdActive || payload.inUseOnHhd,
  };
}

export async function getAssignedDevice(options?: { sync?: boolean }): Promise<AssignedDevice | null> {
  try {
    const sync = options?.sync === true;
    const query = sync ? `?sync=1&_t=${Date.now()}` : "";
    const res = await apiGet<ApiDataResponse<AssignedDevice> | AssignedDevice>(
      `/devices/assigned${query}`
    );
    const raw =
      res && typeof res === "object" && "data" in res && res.data
        ? res.data
        : (res as AssignedDevice);
    return parseAssignedDevicePayload(raw);
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
