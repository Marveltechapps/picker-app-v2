import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, ApiClientError, getAuthToken } from "@/utils/apiClient";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { getProfileApi, type UserProfileApiData } from "@/services/user.service";

export interface OnboardingState {
  currentStep?: string;
  status?: string | null;
  hasCompletedProfile?: boolean;
  hasCompletedDocuments?: boolean;
  hasCompletedVerification?: boolean;
  hasCompletedTraining?: boolean;
  hasCompletedSetup?: boolean;
  hasCompletedManagerOTP?: boolean;
}

export type OnboardingProgressFlags = {
  hasCompletedProfile: boolean;
  hasCompletedDocuments: boolean;
  hasCompletedVerification: boolean;
  hasCompletedTraining: boolean;
  hasCompletedSetup: boolean;
  hasCompletedManagerOTP: boolean;
};

function unwrapPickerEnvelope<T>(raw: unknown): T {
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    (raw as { data: unknown }).data !== undefined
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export function onboardingFlagsFromState(onboarding?: OnboardingState | null): OnboardingProgressFlags {
  return {
    hasCompletedProfile: !!onboarding?.hasCompletedProfile,
    hasCompletedDocuments: !!onboarding?.hasCompletedDocuments,
    hasCompletedVerification: !!onboarding?.hasCompletedVerification,
    hasCompletedTraining: !!onboarding?.hasCompletedTraining,
    hasCompletedSetup: !!onboarding?.hasCompletedSetup,
    hasCompletedManagerOTP: !!onboarding?.hasCompletedManagerOTP,
  };
}

export async function loadPersistedOnboardingProgress(): Promise<Partial<OnboardingProgressFlags>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_PROGRESS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<OnboardingProgressFlags>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function persistOnboardingProgress(
  flags: Partial<OnboardingProgressFlags>
): Promise<void> {
  try {
    const existing = await loadPersistedOnboardingProgress();
    await AsyncStorage.setItem(
      STORAGE_KEYS.ONBOARDING_PROGRESS,
      JSON.stringify({ ...existing, ...flags })
    );
  } catch {
    /* non-fatal */
  }
}

export async function clearPersistedOnboardingProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_PROGRESS);
  } catch {
    /* non-fatal */
  }
}

export function mergeOnboardingProgress(
  api: OnboardingState | null,
  local: Partial<OnboardingProgressFlags>
): OnboardingProgressFlags {
  const apiFlags = onboardingFlagsFromState(api);
  return {
    hasCompletedProfile: apiFlags.hasCompletedProfile || !!local.hasCompletedProfile,
    hasCompletedDocuments: apiFlags.hasCompletedDocuments || !!local.hasCompletedDocuments,
    hasCompletedVerification: apiFlags.hasCompletedVerification || !!local.hasCompletedVerification,
    hasCompletedTraining: apiFlags.hasCompletedTraining || !!local.hasCompletedTraining,
    hasCompletedSetup: apiFlags.hasCompletedSetup || !!local.hasCompletedSetup,
    hasCompletedManagerOTP: apiFlags.hasCompletedManagerOTP || !!local.hasCompletedManagerOTP,
  };
}

/** Approved pickers and anyone who already reached Home should skip onboarding on cold start. */
export function isExistingPickerReadyForHome(
  onboarding: OnboardingState | null,
  profile: UserProfileApiData | null,
  localProgress?: Partial<OnboardingProgressFlags>
): boolean {
  const progress = mergeOnboardingProgress(onboarding, localProgress ?? {});
  const profileStatus = profile?.status?.toUpperCase?.() ?? null;
  const onboardingStatus = onboarding?.status?.toUpperCase?.() ?? null;

  if (profileStatus === "ACTIVE" || onboardingStatus === "ACTIVE") return true;
  if (progress.hasCompletedSetup) return true;

  const step = onboarding?.currentStep;
  if (step === "home" || step === "shifts") return true;

  // Identity already submitted; admin approval pending — do not replay under-review on login.
  if (
    (profileStatus === "PENDING" || onboardingStatus === "PENDING") &&
    progress.hasCompletedProfile &&
    progress.hasCompletedDocuments
  ) {
    return true;
  }

  // Returning picker who finished core onboarding (profile, docs, training) — do not replay verification.
  if (
    progress.hasCompletedProfile &&
    progress.hasCompletedDocuments &&
    progress.hasCompletedTraining &&
    (progress.hasCompletedVerification || profileStatus === "ACTIVE")
  ) {
    return true;
  }

  return false;
}

export function onboardingFlagsForActivePicker(
  onboarding: OnboardingState | null,
  localProgress?: Partial<OnboardingProgressFlags>
): OnboardingProgressFlags {
  const merged = mergeOnboardingProgress(onboarding, localProgress ?? {});
  return {
    hasCompletedProfile: true,
    hasCompletedDocuments: true,
    hasCompletedVerification: true,
    hasCompletedTraining: merged.hasCompletedTraining || true,
    hasCompletedSetup: true,
    hasCompletedManagerOTP: merged.hasCompletedManagerOTP || true,
  };
}

/**
 * Pick the first onboarding screen the user still needs.
 * Uses completion flags (not stale currentStep alone) so returning users are not
 * sent back through profile / identity / verification they already finished.
 */
export function resolveRouteFromOnboardingState(
  onboarding: OnboardingState | null,
  localProgress?: Partial<OnboardingProgressFlags>,
  profile?: UserProfileApiData | null
): string {
  const status = onboarding?.status?.toUpperCase?.() ?? null;
  const profileStatus = profile?.status?.toUpperCase?.() ?? null;

  if (status === "REJECTED" || profileStatus === "REJECTED") return "/rejection";
  if (status === "BLOCKED" || profileStatus === "BLOCKED") return "/blocked";
  if (status === "SUSPENDED" || profileStatus === "SUSPENDED") return "/suspended";

  if (isExistingPickerReadyForHome(onboarding, profile ?? null, localProgress)) {
    return "/(tabs)";
  }

  const progress = mergeOnboardingProgress(onboarding, localProgress ?? {});

  if (progress.hasCompletedSetup) return "/(tabs)";

  const step = onboarding?.currentStep;
  if (step === "home" || step === "shifts") return "/(tabs)";
  if (step === "collect_device") return "/collect-device";

  if (!progress.hasCompletedProfile) return "/onboarding-profile";
  if (!progress.hasCompletedDocuments) return "/documents";
  if (!progress.hasCompletedVerification) {
    // PENDING + docs done = identity submitted; skip under-review replay for returning users.
    if (
      (profileStatus === "PENDING" || status === "PENDING") &&
      progress.hasCompletedProfile &&
      progress.hasCompletedDocuments
    ) {
      if (!progress.hasCompletedTraining) return "/training";
      if (!progress.hasCompletedSetup) {
        if (step === "location") return "/select-work-location";
        return "/select-work-location";
      }
      return "/(tabs)";
    }
    return "/under-review";
  }
  if (!progress.hasCompletedTraining) return "/training";

  if (!progress.hasCompletedSetup) {
    if (step === "location") return "/select-work-location";
    if (step === "shifts") return "/(tabs)";
    if (step === "collect_device") return "/collect-device";
    return "/select-work-location";
  }

  return "/(tabs)";
}

export function matchesOnboardingRoute(target: string, segments: string[]) {
  if (target === "/(tabs)") return segments[0] === "(tabs)";
  return target.replace(/^\//, "") === (segments[0] ?? "");
}

export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  try {
    const rawOnboarding = await apiGet<unknown>("/onboarding/state");
    return unwrapPickerEnvelope<OnboardingState>(rawOnboarding);
  } catch (error) {
    const apiError = error as ApiClientError;
    if (apiError?.status === 404) return null;
    throw error;
  }
}

function resolveStatusRoute(profile: UserProfileApiData | null): string | null {
  const status = profile?.status?.toUpperCase?.() ?? null;
  if (status === "REJECTED") return "/rejection";
  if (status === "BLOCKED") return "/blocked";
  if (status === "SUSPENDED") return "/suspended";
  return null;
}

/**
 * After OTP verify: new users follow onboarding; returning users go straight to home.
 */
export async function resolvePostOtpRoute(isNewUser: boolean): Promise<string> {
  const profile = await getProfileApi({ bypassCache: true }).catch(() => null);
  const statusRoute = resolveStatusRoute(profile);
  if (statusRoute) return statusRoute;

  if (!isNewUser) {
    const localProgress = await loadPersistedOnboardingProgress();
    let onboarding: OnboardingState | null = null;
    try {
      onboarding = await fetchOnboardingState();
    } catch {
      /* non-fatal */
    }
    await persistOnboardingProgress(onboardingFlagsForActivePicker(onboarding, localProgress));
    return "/(tabs)";
  }

  const localProgress = await loadPersistedOnboardingProgress();
  try {
    const onboardingState = await fetchOnboardingState();
    return resolveRouteFromOnboardingState(onboardingState, localProgress, profile);
  } catch {
    return resolveRouteFromOnboardingState(null, localProgress, profile);
  }
}

export async function resolveStartupRoute(hasCompletedLogin: boolean) {
  if (!hasCompletedLogin) return "/splash";

  const token = await getAuthToken();
  // If auth context says logged-in but token is missing, route to login instead of splash.
  // Staying on splash here can create a loading loop with no forward navigation.
  if (!token) return "/login";

  const localProgress = await loadPersistedOnboardingProgress();

  try {
    const [onboardingState, profile] = await Promise.all([
      fetchOnboardingState(),
      getProfileApi().catch(() => null),
    ]);

    if (isExistingPickerReadyForHome(onboardingState, profile, localProgress)) {
      await persistOnboardingProgress(onboardingFlagsForActivePicker(onboardingState, localProgress));
      return "/(tabs)";
    }

    return resolveRouteFromOnboardingState(onboardingState, localProgress, profile);
  } catch (error) {
    const apiError = error as ApiClientError;
    if (apiError?.status === 401 || apiError?.status === 403) {
      if (__DEV__) console.warn("[Startup] Onboarding state 401/403, redirecting to login");
      return "/login";
    }

    if (apiError?.status === 404) {
      const profile = await getProfileApi().catch(() => null);
      if (isExistingPickerReadyForHome(null, profile, localProgress)) {
        await persistOnboardingProgress(onboardingFlagsForActivePicker(null, localProgress));
        return "/(tabs)";
      }
      return resolveRouteFromOnboardingState(null, localProgress, profile);
    }

    if (__DEV__) console.warn("[Startup] Failed to fetch onboarding state:", apiError?.message);
    const profile = await getProfileApi().catch(() => null);
    if (isExistingPickerReadyForHome(null, profile, localProgress)) {
      await persistOnboardingProgress(onboardingFlagsForActivePicker(null, localProgress));
      return "/(tabs)";
    }
    return resolveRouteFromOnboardingState(null, localProgress, profile);
  }
}
