/**
 * AsyncStorage / SecureStore key names.
 * SecureStore on iOS allows only alphanumeric characters, ".", "-", and "_" (no "/" or "@").
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  PHONE_NUMBER: "auth_phone_number",
  PERMISSION_ONBOARDING: "auth_permission_onboarding",
  PUSH_TOKEN: "auth_push_token",
} as const;

/** Offline queue persistence (AsyncStorage only). */
export const OFFLINE_QUEUE_STORAGE_KEY = "offline_queue";

/** Last-selected identity verification method (AsyncStorage only). */
export const PICKER_VERIFICATION_METHOD_KEY = "picker_verification_method";
