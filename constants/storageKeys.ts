/**
 * AsyncStorage / SecureStore key names.
 * SecureStore on iOS allows only alphanumeric characters, ".", "-", and "_" (no "/" or "@").
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  PHONE_NUMBER: "auth_phone_number",
  PERMISSION_ONBOARDING: "auth_permission_onboarding",
  /** Cached onboarding step completion (survives app restarts). */
  ONBOARDING_PROGRESS: "auth_onboarding_progress",
  PUSH_TOKEN: "auth_push_token",
  LOGIN_EMAIL: "auth_login_email",
  LOGIN_METHOD: "auth_login_method",
  LOGIN_COUNTRY_CODE: "auth_login_country_code",
} as const;

/** Offline queue persistence (AsyncStorage only). */
export const OFFLINE_QUEUE_STORAGE_KEY = "offline_queue";

/** Last-selected identity verification method (AsyncStorage only). */
export const PICKER_VERIFICATION_METHOD_KEY = "picker_verification_method";
