import { useEffect } from "react";

/**
 * Temporary onboarding guard hook.
 * Keeps existing call sites stable while onboarding navigation is handled in app/_layout.
 */
export function useOnboardingGuard() {
  useEffect(() => {
    // Intentionally no-op.
  }, []);
}
