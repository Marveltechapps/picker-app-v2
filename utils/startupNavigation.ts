type MutableRef<T> = { current: T };

type StartupNavSnapshot = {
  target: string | null;
  at: number;
};

export const ONBOARDING_ROUTE_SEGMENTS = new Set([
  "onboarding-profile",
  "documents",
  "under-review",
  "training",
  "location-type",
  "select-shift",
  "collect-device",
]);

/** Stack screens opened from Profile / Support — never override with startup redirect. */
export const POST_LOGIN_STACK_ROUTES = new Set([
  "training",
  "training-video",
  "training-module",
  "final-assessment",
  "device-status",
  "return-device",
  "inventory-mismatch",
  "personal-information",
  "work-history",
  "bank-details",
  "payouts",
  "update-bank-details",
  "update-upi-details",
  "my-documents",
  "document-detail",
  "support-settings",
  "faqs",
  "contact-support",
  "notifications",
  "edit-profile",
  "terms-conditions",
  "privacy-policy",
  "documents",
  "collect-device",
  "location-type",
  "select-shift",
  "select-work-location",
]);

export function isPostLoginStackRoute(segment: string | undefined): boolean {
  return !!segment && POST_LOGIN_STACK_ROUTES.has(segment);
}

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
