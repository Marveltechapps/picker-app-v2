import "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, Platform, Text, InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/state/authContext";
import { usePickerStatusCheck } from "@/hooks/usePickerStatusCheck";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { LanguageProvider } from "@/state/languageContext";
import { ThemeProvider } from "@/state/themeContext";
import { ColorsProvider, useColors } from "@/contexts/ColorsContext";
import { LocationProvider } from "@/state/locationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { resolveStartupRoute, matchesOnboardingRoute } from "@/utils/startupRoute";
import {
  startupNavigationRefs,
  resetStartupRouteResolution,
  markStartupRouteResolved,
  isPostLoginStackRoute,
} from "@/utils/startupNavigation";
import { setupNotificationListeners, getLastNotificationResponse, registerForPushNotifications, getNotificationPermissionStatus } from "@/utils/notificationService";
import { blurActiveElementBeforeNav, setupWebErrorSuppression } from "@/utils/webErrorHandler";
import { setupNativeErrorHandling } from "@/utils/nativeErrorHandler";
import Constants from "expo-constants";
import { logRouteTransition, PERMISSION_DEBUG } from "@/utils/permissionDebug";

// Setup native error handling IMMEDIATELY (before any other code runs)
// This catches unhandled promise rejections and native module crashes.
// Wrapped in try-catch so Expo Go never crashes if ErrorUtils is missing.
if (Platform.OS !== 'web') {
  try {
    setupNativeErrorHandling();
  } catch (e) {
    if (__DEV__) {
      console.warn('[App] Native error handler setup failed (safe to ignore in Expo Go):', e);
    }
  }
}

// Setup web error suppression IMMEDIATELY (before any other code runs)
if (typeof window !== 'undefined') {
  setupWebErrorSuppression();
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const hasHiddenSplashRef = { current: false };
const hasResolvedStartupRouteRef = startupNavigationRefs.hasResolved;
const isResolvingStartupRef = startupNavigationRefs.isResolving;
const lastStartupTargetRef = startupNavigationRefs.lastTarget;
const lastStartupNavigationRef = startupNavigationRefs.lastNav;

const PUBLIC_AUTH_ROUTES = new Set(["splash", "permissions", "login", "otp", "terms-conditions", "privacy-policy"]);
const STATUS_ROUTES = new Set(["rejection", "under-review", "blocked", "suspended"]);

function matchesTargetRoute(target: string, segments: string[]) {
  return matchesOnboardingRoute(target, segments);
}

function safeStartupReplace(router: ReturnType<typeof useRouter>, target: string) {
  const now = Date.now();
  if (
    lastStartupNavigationRef.current.target === target &&
    now - lastStartupNavigationRef.current.at < 1000
  ) {
    return;
  }
  lastStartupNavigationRef.current = { target, at: now };
  blurActiveElementBeforeNav();
  router.replace(target as Href);
}

function navigateFromNotificationData(router: ReturnType<typeof useRouter>, data: Record<string, unknown> | undefined) {
  const type = data?.type;
  switch (type) {
    case "order":
      if (data?.orderId != null && String(data.orderId).length > 0) {
        router.push(`/(tabs)?orderId=${encodeURIComponent(String(data.orderId))}` as Href);
      } else {
        router.push("/(tabs)");
      }
      break;
    case "rejection":
      router.replace("/rejection");
      break;
    case "suspended":
      router.replace("/suspended");
      break;
    case "blocked":
      router.replace("/blocked");
      break;
    case "payout":
      router.push("/payouts");
      break;
    case "shift":
      router.push("/(tabs)/attendance");
      break;
    default:
      router.push("/notifications");
  }
}

function RootLayoutNav() {
  const {
    hasCompletedPermissionOnboarding,
    hasCompletedLogin,
    hasCompletedSetup,
    shiftActive,
    isLoading: authLoading,
    phoneNumber,
    setNotifications,
    notifications,
    tokenExpired,
    logout,
  } = useAuth();
  
  const isLoading = authLoading;
  const hasNormalizedInitialAuthRouteRef = React.useRef(false);
  usePickerStatusCheck();
  useHeartbeat({ enabled: hasCompletedLogin && shiftActive });
  const segments = useSegments();
  const pathname = usePathname();

  const routeSegmentKey = useMemo(() => {
    const s = segments ?? [];
    if (s.length === 0) return "";
    // Tab sub-routes (home, profile, etc.) share one key so startup routing does not re-run per tab tap.
    if (s[0] === "(tabs)") return "(tabs)";
    return String(s[0]);
  }, [segments]);

  if (PERMISSION_DEBUG) {
    console.log("CURRENT ROUTE", pathname, "(_layout render)", { segments, routeSegmentKey });
  }

  // Load picker config when logged in (pay rates, etc.) - dashboard-managed
  useEffect(() => {
    if (!hasCompletedLogin) return;
    let cancelled = false;
    (async () => {
      try {
        const { getPickerConfig } = await import("@/services/config.service");
        const config = await getPickerConfig();
        if (cancelled) return;
        const { setPayConfig } = await import("@/utils/payCalculations");
        setPayConfig({
          basePayPerHour: config.basePayPerHour,
          overtimeMultiplier: config.overtimeMultiplier,
        });
      } catch {
        // Use defaults on error
      }
    })();
    return () => { cancelled = true; };
  }, [hasCompletedLogin]);
  const router = useRouter();
  const colors = useColors();
  const isExpoGo = Boolean(typeof Constants !== "undefined" && Constants?.executionEnvironment === "storeClient");
  // In Expo Go, ensure loading/root never use a dark background so we never show a black screen.
  const loadingBg = isExpoGo ? "#F9FAFB" : (colors?.background ?? "#F9FAFB");

  const loadingStyles = useMemo(() => StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: loadingBg,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors?.text?.secondary ?? "#6B7280",
    },
  }), [loadingBg, colors?.text?.secondary]);

  // Hide native splash once when app is ready. Use InteractionManager to wait for the
  // native view controller to be ready (fixes "No native splash screen registered" on iOS/Expo Go).
  useEffect(() => {
    if (Platform.OS === "web" || isLoading || hasHiddenSplashRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (hasHiddenSplashRef.current) return;
      hasHiddenSplashRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => task.cancel();
  }, [isLoading]);

  // Setup push notifications when user is logged in (native platforms only)
  // Skip in Expo Go as push notifications are not supported
  useEffect(() => {
    // Push notifications are not supported on web
    if (Platform.OS === 'web') {
      return;
    }

    const isExpoGo = typeof Constants !== "undefined" && Constants?.executionEnvironment === "storeClient";
    if (isExpoGo) return;

    const setupPushNotifications = async () => {
      try {
        // Only setup if user has completed login and permission onboarding
        if (!hasCompletedPermissionOnboarding || !hasCompletedLogin) {
          return;
        }

        // Check if notifications are allowed
        const permissionStatus = await getNotificationPermissionStatus();
        if (permissionStatus !== 'granted') {
          return;
        }

        // Register for push notifications
        const token = await registerForPushNotifications();
        if (token) {
          // Register push token with backend for order assignment notifications
          const { registerPushToken } = await import("@/services/pushToken.service");
          await registerPushToken(token);
        } else {
          if (__DEV__) {
            console.warn('Push notifications: Failed to register token');
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error setting up push notifications:', error);
        }
      }
    };

    setupPushNotifications();
  }, [hasCompletedPermissionOnboarding, hasCompletedLogin, phoneNumber]);

  // Setup notification listeners (native platforms only)
  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Push notifications are not supported on web
    if (Platform.OS === 'web') {
      return;
    }

    const isExpoGo = typeof Constants !== "undefined" && Constants?.executionEnvironment === "storeClient";
    if (isExpoGo) return;

    // Setup listeners for foreground and background notifications
    const cleanup = setupNotificationListeners(
      // Notification received (foreground)
      (notification) => {
        try {
          const data = notification.request.content.data;
          const title = notification.request.content.title || 'Notification';
          const body = notification.request.content.body || '';
          
          // Add notification to state using functional update
          setNotifications((prevNotifications) => {
            const newNotification = {
              id: notification.request.identifier || Date.now().toString(),
              type: (data?.type as any) || 'update',
              title: typeof title === 'string' ? title : 'Notification',
              description: typeof body === 'string' ? body : '',
              timestamp: new Date().toISOString(),
              isRead: false,
            };
            // Avoid duplicates
            const exists = prevNotifications.some(n => n.id === newNotification.id);
            return exists ? prevNotifications : [newNotification, ...prevNotifications];
          });
        } catch (error) {
          if (__DEV__) {
            console.error('Error handling notification:', error);
          }
        }
      },
      // Notification tapped
      (response) => {
        try {
          const data = response.notification.request.content.data as Record<string, unknown> | undefined;
          navigateFromNotificationData(router, data);
        } catch (error) {
          if (__DEV__) {
            console.error('Error handling notification tap:', error);
          }
        }
      }
    );

    // Check if app was opened from a notification (native platforms only)
    // Skip in Expo Go
    if (!isExpoGo) {
      getLastNotificationResponse().then((response) => {
        if (response) {
          try {
            const data = response.notification.request.content.data as Record<string, unknown> | undefined;
            navigateFromNotificationData(router, data);
          } catch (error) {
            if (__DEV__) {
              console.error('Error handling last notification response:', error);
            }
          }
        }
      }).catch(() => {
        // Silently handle errors (method not available on web)
      });
    }

    return cleanup;
  }, [isLoading, router, setNotifications]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentSegments = segments ?? [];
    if (currentSegments.length === 0) {
      return;
    }
    const seg0 = currentSegments[0];

    // Returning users who finished onboarding should land on the app, not onboarding again.
    if (hasCompletedLogin && hasCompletedSetup && seg0 === "(tabs)") {
      hasResolvedStartupRouteRef.current = true;
      markStartupRouteResolved();
      return;
    }

    // After startup resolve, tab and profile/support stack screens must not re-run routing.
    if (
      hasCompletedLogin &&
      hasResolvedStartupRouteRef.current &&
      (seg0 === "(tabs)" || isPostLoginStackRoute(seg0 as string))
    ) {
      return;
    }

    let cancelled = false;

    const routeOnStartup = async () => {
      const currentSegments = segments ?? [];
      // During initial nav-state hydration (more common on Android release builds),
      // segments can be briefly empty; redirecting in that window causes route thrash.
      if (currentSegments.length === 0) {
        return;
      }
      const seg0 = currentSegments[0];

      if (PERMISSION_DEBUG) {
        logRouteTransition("_layout.routeOnStartup", "evaluate", String(seg0));
      }

      if (!hasCompletedLogin) {
        resetStartupRouteResolution();
        const seg0Str = seg0 as string | undefined;

        // On cold start, never land directly on OTP.
        // OTP must only be reached from the phone entry flow.
        if (!hasNormalizedInitialAuthRouteRef.current) {
          hasNormalizedInitialAuthRouteRef.current = true;
          // Only normalize direct cold-start entry to OTP (no history stack).
          // During normal login flow, login -> otp should be allowed.
          if (seg0Str === "otp" && !router.canGoBack()) {
            if (!matchesTargetRoute("/login", currentSegments)) {
              router.replace("/login");
            }
            return;
          }
        }

        // Token expired (had token but 401/403): send to login
        if (tokenExpired) {
          if (!matchesTargetRoute("/login", currentSegments)) {
            router.replace("/login");
          }
          return;
        }

        // No token:
        // - If we're already on a public auth/onboarding route (splash, permissions, login, otp),
        //   let that screen control navigation (e.g. splash → permissions) instead of forcing
        //   another redirect back to splash.
        if (seg0Str && PUBLIC_AUTH_ROUTES.has(seg0Str)) {
          if (PERMISSION_DEBUG) {
            logRouteTransition("_layout", "stay on public route", seg0Str);
          }
          return;
        }

        // Returning users who already completed permissions: go straight to login.
        // Avoids splash → login double navigation after manual logout from (tabs).
        const unauthTarget = hasCompletedPermissionOnboarding ? "/login" : "/splash";
        if (!matchesTargetRoute(unauthTarget, currentSegments)) {
          logRouteTransition("_layout", "replace (unauthenticated non-public)", unauthTarget);
          safeStartupReplace(router, unauthTarget);
        }
        return;
      }

      const legalRoutes = new Set(["terms-conditions", "privacy-policy"]);
      const isOnPublicAuthRoute =
        PUBLIC_AUTH_ROUTES.has(seg0 as string) && !legalRoutes.has(seg0 as string);

      if (STATUS_ROUTES.has(seg0 as string)) {
        return;
      }

      // User opened a profile/support module — never redirect back to tabs.
      if (hasResolvedStartupRouteRef.current && isPostLoginStackRoute(seg0 as string)) {
        return;
      }

      // Only run startup routing on splash, public auth routes, or before the first
      // successful resolve. Do NOT re-run when user opens stack modules (training,
      // documents, collect-device, etc.) from Profile — that was redirecting back to tabs.
      const needsStartupNavigation =
        seg0 === "splash" ||
        isOnPublicAuthRoute ||
        !hasResolvedStartupRouteRef.current;

      if (!needsStartupNavigation) {
        return;
      }

      if (isResolvingStartupRef.current) return;
      isResolvingStartupRef.current = true;

      let target: string;
      try {
        target = await resolveStartupRoute(hasCompletedLogin);
        lastStartupTargetRef.current = target;
      } finally {
        isResolvingStartupRef.current = false;
      }

      if (cancelled) {
        return;
      }

      if (target === "/login" && hasCompletedLogin) {
        hasResolvedStartupRouteRef.current = false;
        await logout();
        if (!matchesTargetRoute("/login", currentSegments)) {
          safeStartupReplace(router, "/login");
        }
        return;
      }

      // Defensive: authenticated startup should never settle on splash.
      // If it does (e.g. transient token state mismatch), recover to login.
      if (target === "/splash" && hasCompletedLogin) {
        hasResolvedStartupRouteRef.current = false;
        await logout();
        if (!matchesTargetRoute("/login", currentSegments)) {
          safeStartupReplace(router, "/login");
        }
        return;
      }

      hasResolvedStartupRouteRef.current = true;
      markStartupRouteResolved();

      if (!matchesTargetRoute(target, currentSegments)) {
        logRouteTransition("_layout", "safeStartupReplace", target);
        safeStartupReplace(router, target);
      }
    };

    routeOnStartup().catch(() => {
      // Silently handle startup navigation failures
    });

    return () => {
      cancelled = true;
    };
  }, [hasCompletedLogin, hasCompletedPermissionOnboarding, hasCompletedSetup, isLoading, routeSegmentKey, router, tokenExpired, logout]);

  // In Expo Go, never block on auth loading: show Stack immediately so we don't get stuck on white screen.
  const showLoadingUI = isLoading && !isExpoGo;
  if (showLoadingUI) {
    // Splash stays visible during loading; hidden when isLoading becomes false
    const primaryColor = colors?.primary?.[650] ?? "#121358";
    return (
      <View style={loadingStyles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[loadingStyles.loadingText, { color: colors?.text?.secondary ?? "#6B7280" }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="permissions" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="otp" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding-profile" options={{ headerShown: false }} />
      <Stack.Screen name="verification" options={{ headerShown: false }} />
      <Stack.Screen name="live-verification" options={{ headerShown: false }} />
      <Stack.Screen name="face-verification" options={{ headerShown: false }} />
      <Stack.Screen name="documents" options={{ headerShown: false }} />
      <Stack.Screen name="didit-kyc" options={{ headerShown: false }} />
      <Stack.Screen name="document-verification" options={{ headerShown: false }} />
      <Stack.Screen name="document-verification-success" options={{ headerShown: false }} />
      <Stack.Screen name="aadhar-upload" options={{ headerShown: false }} />
      <Stack.Screen name="pan-upload" options={{ headerShown: false }} />
      <Stack.Screen name="verification-loading" options={{ headerShown: false }} />
      <Stack.Screen name="success" options={{ headerShown: false }} />
      <Stack.Screen name="training" options={{ headerShown: false }} />
      <Stack.Screen name="training-module" options={{ headerShown: false }} />
      <Stack.Screen name="training-video" options={{ headerShown: false }} />
      <Stack.Screen name="final-assessment" options={{ headerShown: false }} />
      <Stack.Screen name="location-type" options={{ headerShown: false }} />
      <Stack.Screen name="select-work-location" options={{ headerShown: false }} />
      <Stack.Screen name="select-shift" options={{ headerShown: false }} />
      <Stack.Screen name="shift-selection" options={{ headerShown: false }} />
      <Stack.Screen name="collect-device" options={{ headerShown: false }} />
      <Stack.Screen name="return-device" options={{ headerShown: false }} />
      <Stack.Screen name="rejection" options={{ headerShown: false }} />
      <Stack.Screen name="under-review" options={{ headerShown: false }} />
      <Stack.Screen name="blocked" options={{ headerShown: false }} />
      <Stack.Screen name="suspended" options={{ headerShown: false }} />
      <Stack.Screen name="personal-information" options={{ headerShown: false }} />
      <Stack.Screen name="work-history" options={{ headerShown: false }} />
      <Stack.Screen name="bank-details" options={{ headerShown: false }} />
      <Stack.Screen name="payouts" options={{ headerShown: false }} />
      <Stack.Screen name="update-bank-details" options={{ headerShown: false }} />
      <Stack.Screen name="update-upi-details" options={{ headerShown: false }} />
      <Stack.Screen name="document-detail" options={{ headerShown: false }} />
      <Stack.Screen name="my-documents" options={{ headerShown: false }} />
      <Stack.Screen name="support-settings" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="faqs" options={{ headerShown: false }} />
      <Stack.Screen name="contact-support" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="device-status" options={{ headerShown: false }} />
      <Stack.Screen name="inventory-mismatch" options={{ headerShown: false }} />
      <Stack.Screen name="terms-conditions" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}


function ThemedAppContainer({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const isExpoGo = Boolean(typeof Constants !== "undefined" && Constants?.executionEnvironment === "storeClient");
  const containerBg = isExpoGo ? "#F9FAFB" : (colors?.background ?? "#F9FAFB");

  const containerStyle = useMemo(
    () => ({
      flex: 1,
      backgroundColor: containerBg,
    }),
    [containerBg]
  );

  return (
    <View style={containerStyle}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </View>
  );
}

export default function RootLayout() {
  // Error suppression is already set up at module level (runs immediately)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setupWebErrorSuppression();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ColorsProvider>
              <LanguageProvider>
                <LocationProvider>
                  <AuthProvider>
                    <ThemedAppContainer>
                      <RootLayoutNav />
                    </ThemedAppContainer>
                  </AuthProvider>
                </LocationProvider>
              </LanguageProvider>
            </ColorsProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
