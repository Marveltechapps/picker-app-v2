/**
 * Work locations – list hubs and persist picker assignment (POST /locations/set).
 */

import { SHIFT_GEOFENCE_RADIUS_M } from "@/constants/locationVerification";
import { apiGet, apiPost, ApiClientError } from "@/utils/apiClient";

export interface WorkLocation {
  locationId: string;
  name: string;
  type: "warehouse" | "darkstore";
  address?: string;
  city?: string;
  state?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  distance?: number | null;
  travelTime?: string | null;
  distanceDisplay?: string | null;
}

interface LocationsApiEnvelope {
  success?: boolean;
  data?: unknown;
  locations?: unknown;
}

export interface GetWorkLocationsOptions {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

function isValidCoordinate(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildLocationsEndpoint(options?: GetWorkLocationsOptions): string {
  if (!options) return "/locations";

  const queryParts: string[] = [];
  if (isValidCoordinate(options.latitude)) queryParts.push(`lat=${encodeURIComponent(String(options.latitude))}`);
  if (isValidCoordinate(options.longitude)) queryParts.push(`lng=${encodeURIComponent(String(options.longitude))}`);
  if (isValidCoordinate(options.radiusKm)) queryParts.push(`radius=${encodeURIComponent(String(options.radiusKm))}`);

  return queryParts.length ? `/locations?${queryParts.join("&")}` : "/locations";
}

export async function getWorkLocations(options?: GetWorkLocationsOptions): Promise<WorkLocation[]> {
  try {
    const res = await apiGet<LocationsApiEnvelope>(buildLocationsEndpoint(options));
    const payload = res?.data;
    const list = Array.isArray((payload as { locations?: unknown })?.locations)
      ? ((payload as { locations: unknown[] }).locations as unknown[])
      : Array.isArray(payload)
        ? (payload as unknown[])
        : Array.isArray(res?.locations)
          ? (res.locations as unknown[])
          : [];

    if (Array.isArray(list)) {
      return list
        .map((item): WorkLocation => {
          const l = item as Record<string, unknown>;
          const inferredType = String(
            l.type ?? l.locationType ?? l.storeType ?? "warehouse"
          ).toLowerCase();

          const latitude =
            typeof l.coordinates === "object" && l.coordinates
              ? Number((l.coordinates as Record<string, unknown>).latitude)
              : Number(l.latitude);
          const longitude =
            typeof l.coordinates === "object" && l.coordinates
              ? Number((l.coordinates as Record<string, unknown>).longitude)
              : Number(l.longitude);

          return {
            locationId: String(l.locationId ?? l._id ?? l.id ?? l.code ?? ""),
            name: String(l.name ?? l.locationName ?? l.storeName ?? "").trim(),
            type: inferredType === "darkstore" ? "darkstore" : "warehouse",
            address: typeof l.address === "string" ? l.address : undefined,
            city: typeof l.city === "string" ? l.city : undefined,
            state: typeof l.state === "string" ? l.state : undefined,
          coordinates:
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? {
                  latitude,
                  longitude,
                }
              : undefined,
            distance: typeof l.distance === "number" ? l.distance : null,
            travelTime: typeof l.travelTime === "string" ? l.travelTime : null,
            distanceDisplay: typeof l.distanceDisplay === "string" ? l.distanceDisplay : null,
          };
        })
        .filter((l) => l.locationId && l.name);
    }
    return [];
  } catch (e) {
    if (e instanceof ApiClientError) {
      const statusText = typeof e.status === "number" && e.status > 0 ? `HTTP ${e.status}` : "Request failed";
      throw new Error(`${statusText}: ${e.message}`);
    }
    throw e;
  }
}

export interface DarkstoreGpsPayload {
  latitude: number;
  longitude: number;
  address?: string;
  capturedAt?: string | number;
}

export interface SavedDarkstoreGps {
  success: boolean;
  storage: "work_location" | "store";
  locationId: string;
  name?: string;
  address?: string;
  latitude: number;
  longitude: number;
  capturedAt: string | Date;
}

export async function saveDarkstoreGpsLocation(
  locationId: string,
  payload: DarkstoreGpsPayload
): Promise<{ success: boolean; data?: SavedDarkstoreGps; error?: string }> {
  try {
    const response = await apiPost<ApiDataResponse<SavedDarkstoreGps>>(
      "/locations/save-darkstore-gps",
      {
        locationId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        capturedAt: payload.capturedAt ?? Date.now(),
      }
    );
    const data = (response as ApiDataResponse<SavedDarkstoreGps>).data;
    if (!data?.locationId || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
      return { success: false, error: "Darkstore GPS was not saved correctly" };
    }
    return { success: true, data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function setUserWorkLocation(
  locationId: string,
  locationType: "warehouse" | "darkstore",
  gps?: DarkstoreGpsPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPost("/locations/set", {
      locationId,
      locationType,
      ...(gps
        ? {
            latitude: gps.latitude,
            longitude: gps.longitude,
            address: gps.address,
            capturedAt: gps.capturedAt ?? Date.now(),
          }
        : {}),
    });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

export interface SetDarkstoreFromCurrentResult {
  success: boolean;
  user: {
    id: string;
    name?: string;
    currentLocationId: string;
    locationType: "darkstore";
  };
  location: {
    id: string;
    name: string;
    type: string;
    address?: string;
  };
  nearest: WorkLocation & {
    distance?: number;
    distanceDisplay?: string | null;
    travelTime?: string | null;
  };
  coordinates: { latitude: number; longitude: number; capturedAt?: string | Date };
  savedGps?: SavedDarkstoreGps;
}

/**
 * Assign the nearest darkstore hub using the device's current GPS coordinates.
 */
export interface LocationGeofenceValidation {
  valid: boolean;
  withinRange: boolean;
  distance?: number;
  distanceMeters?: number;
  geofenceRadius?: number;
  location?: {
    id: string;
    name: string;
    type: string;
  };
}

/**
 * Validate picker GPS coordinates against a work location geofence.
 */
export async function validateLocationGeofence(
  locationId: string,
  latitude: number,
  longitude: number,
  radiusMeters: number = SHIFT_GEOFENCE_RADIUS_M,
  accuracyMeters?: number | null
): Promise<{ success: boolean; data?: LocationGeofenceValidation; error?: string }> {
  try {
    const response = await apiPost<ApiDataResponse<LocationGeofenceValidation>>(
      "/locations/validate",
      {
        locationId,
        latitude,
        longitude,
        radiusMeters,
        ...(accuracyMeters != null && Number.isFinite(accuracyMeters)
          ? { accuracyMeters }
          : {}),
      }
    );
    const data = (response as ApiDataResponse<LocationGeofenceValidation>).data;
    if (!data || typeof data.valid !== "boolean") {
      return { success: false, error: "Invalid location validation response" };
    }
    return { success: true, data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function setDarkstoreFromCurrentLocation(
  latitude: number,
  longitude: number,
  options?: { address?: string; capturedAt?: string | number }
): Promise<{ success: boolean; data?: SetDarkstoreFromCurrentResult; error?: string }> {
  try {
    const response = await apiPost<ApiDataResponse<SetDarkstoreFromCurrentResult>>(
      "/locations/set-darkstore-from-current",
      {
        latitude,
        longitude,
        address: options?.address,
        capturedAt: options?.capturedAt ?? Date.now(),
      }
    );
    const data = (response as ApiDataResponse<SetDarkstoreFromCurrentResult>).data;
    if (!data?.nearest?.locationId) {
      return { success: false, error: "No darkstore location could be assigned" };
    }
    return { success: true, data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
