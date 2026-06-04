/** Maximum distance from assigned darkstore to start a shift (meters). */
export const SHIFT_GEOFENCE_RADIUS_M = 200;

/** Maximum acceptable GPS accuracy for shift verification (meters). */
export const SHIFT_MAX_GPS_ACCURACY_M = 200;

/** Relaxed accuracy cap for web browsers. */
export const SHIFT_MAX_GPS_ACCURACY_WEB_M = 500;

/** Maximum age of a location fix used for shift verification (ms). */
export const SHIFT_MAX_LOCATION_AGE_MS = 45_000;
