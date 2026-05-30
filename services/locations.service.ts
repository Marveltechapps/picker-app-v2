/**
 * Work locations – list hubs and persist picker assignment (POST /locations/set).
 */

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

export async function setUserWorkLocation(
  locationId: string,
  locationType: "warehouse" | "darkstore"
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPost("/locations/set", { locationId, locationType });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}
