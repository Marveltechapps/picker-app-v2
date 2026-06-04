import { apiGet, ApiClientError, getAuthToken } from "@/utils/apiClient";

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

interface StartupOnboardingState {
  currentStep?: string;
  status?: string | null;
}

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

export function matchesOnboardingRoute(target: string, segments: string[]) {
  if (target === "/(tabs)") return segments[0] === "(tabs)" && segments.length === 1;
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

export async function resolveStartupRoute(hasCompletedLogin: boolean) {
  if (!hasCompletedLogin) return "/splash";

  const token = await getAuthToken();
  // If auth context says logged-in but token is missing, route to login instead of splash.
  // Staying on splash here can create a loading loop with no forward navigation.
  if (!token) return "/login";

  try {
    const onboardingState = (await fetchOnboardingState()) as StartupOnboardingState | null;
    const status = onboardingState?.status?.toUpperCase?.() ?? null;

    if (status === "REJECTED") return "/rejection";
    if (status === "BLOCKED") return "/blocked";
    if (status === "SUSPENDED") return "/suspended";

    const step = onboardingState?.currentStep;
    switch (step) {
      case "profile":
        return "/profile";
      case "documents":
        return "/documents";
      case "verification":
        return "/under-review";
      case "training":
        return "/training";
      case "location":
        return "/select-work-location";
      case "shifts":
        return "/(tabs)";
      case "collect_device":
        return "/collect-device";
      case "home":
        return "/(tabs)";
      default:
        return "/(tabs)";
    }
  } catch (error) {
    const apiError = error as ApiClientError;
    if (apiError?.status === 401 || apiError?.status === 403) {
      if (__DEV__) console.warn("[Startup] Onboarding state 401/403, redirecting to login");
      return "/login";
    }

    if (apiError?.status === 404) return "/(tabs)";

    if (__DEV__) console.warn("[Startup] Failed to fetch onboarding state:", apiError?.message);
    // Never send authenticated users back to splash here; splash has no logged-in redirect
    // and can trap the app in a perpetual loading screen when startup APIs fail.
    return "/(tabs)";
  }
}
