/**
 * useLiveLocation — real-time location + reverse-geocoded address.
 * Wraps LocationContext; exposes locating state, location name, error, refresh.
 */

import { useLocation } from '@/state/locationContext';

export function useLiveLocation() {
  const ctx = useLocation();

  const locating =
    ctx.isLoading ||
    ctx.isGeocoding ||
    (!!ctx.currentLocation && !ctx.address && !ctx.error);

  const locationName = ctx.getFormattedAddress();

  return {
    locating,
    locationName,
    currentLocation: ctx.currentLocation,
    address: ctx.address,
    isLoading: ctx.isLoading,
    error: ctx.error,
    locationPermission: ctx.locationPermission,
    getFormattedAddress: ctx.getFormattedAddress,
    getAccuracyDisplay: ctx.getAccuracyDisplay,
    requestPermission: ctx.requestPermission,
    refreshLocation: ctx.refreshLocation,
    startWatchingLocation: ctx.startWatchingLocation,
    stopWatchingLocation: ctx.stopWatchingLocation,
    isWatching: ctx.isWatching,
  };
}
