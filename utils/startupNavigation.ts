type MutableRef<T> = { current: T };

type StartupNavSnapshot = {
  target: string | null;
  at: number;
};

export const ONBOARDING_ROUTE_SEGMENTS = new Set([
  "profile",
  "documents",
  "under-review",
  "training",
  "location-type",
  "select-shift",
  "collect-device",
]);

export const startupNavigationRefs: {
  hasResolved: MutableRef<boolean>;
  isResolving: MutableRef<boolean>;
  lastTarget: MutableRef<string | null>;
  lastNav: MutableRef<StartupNavSnapshot>;
} = {
  hasResolved: { current: false },
  isResolving: { current: false },
  lastTarget: { current: null },
  lastNav: { current: { target: null, at: 0 } },
};

export function resetStartupRouteResolution() {
  startupNavigationRefs.hasResolved.current = false;
  startupNavigationRefs.isResolving.current = false;
  startupNavigationRefs.lastTarget.current = null;
  startupNavigationRefs.lastNav.current = { target: null, at: 0 };
}

export function markStartupRouteResolved() {
  startupNavigationRefs.hasResolved.current = true;
}
