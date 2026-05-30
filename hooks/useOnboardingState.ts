import { useState, useEffect } from "react";
import { getAuthToken, apiGet, ApiClientError } from "@/utils/apiClient";
import { useAuth } from "@/state/authContext";

export interface OnboardingStateResponse {
  currentStep: string;
  hasCompletedProfile: boolean;
  hasCompletedDocuments: boolean;
  hasCompletedVerification: boolean;
  hasCompletedTraining: boolean;
  hasCompletedSetup: boolean;
  hasCompletedManagerOTP: boolean;
  hasCompletedDeviceCollection?: boolean;
  status: string;
}

/** Default state when API returns 404 or user has no onboarding record yet */
const DEFAULT_ONBOARDING_STATE: OnboardingStateResponse = {
  currentStep: "profile",
  hasCompletedProfile: false,
  hasCompletedDocuments: false,
  hasCompletedVerification: false,
  hasCompletedTraining: false,
  hasCompletedSetup: false,
  hasCompletedManagerOTP: false,
  hasCompletedDeviceCollection: false,
  status: "PENDING",
};

function unwrapPickerEnvelope<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in raw && (raw as { data: unknown }).data !== undefined) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export function useOnboardingState() {
  const { hasCompletedLogin } = useAuth();
  const [onboardingState, setOnboardingState] = useState<OnboardingStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchState = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getAuthToken();
      if (!token || !hasCompletedLogin) {
        setOnboardingState(null);
        return;
      }
      // Base URL already includes /api/v1/picker, so use /onboarding/state (not /picker/onboarding/state)
      const raw = await apiGet<unknown>("/onboarding/state");
      setOnboardingState(unwrapPickerEnvelope<OnboardingStateResponse>(raw));
    } catch (err) {
      const apiErr = err as ApiClientError;
      if (apiErr?.status === 404) {
        setOnboardingState(DEFAULT_ONBOARDING_STATE);
      } else {
        console.error("[useOnboardingState] Failed to fetch onboarding state:", err);
        setError(err as Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, [hasCompletedLogin]);

  return {
    onboardingState,
    isLoading,
    error,
    refresh: fetchState,
  };
}
