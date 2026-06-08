import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  Linking,
  InteractionManager,
} from "react-native";
import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Bell, Camera, Battery, MapPin } from "lucide-react-native";
import { useAuth, PermissionsState } from "@/state/authContext";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import PermissionCard from "@/components/PermissionCard";
import PermissionModal from "@/components/PermissionModal";
import PrimaryButton from "@/components/PrimaryButton";
import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  registerForPushNotifications,
  sendTokenToBackend,
} from "@/utils/notificationService";
import { useLocation } from "@/state/locationContext";
import { checkBackgroundLocationPermission, checkLocationPermission } from "@/utils/locationService";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appNotify } from "@/utils/appNotify";
import { blurActiveElementBeforeNav } from "@/utils/webErrorHandler";
import {
  logOsVsUi,
  logProceedStep,
  logRouteTransition,
  logValidationSnapshot,
  PERMISSION_DEBUG,
} from "@/utils/permissionDebug";

/**
 * Cards shown on this screen. Operationally, foreground location is the
 * strongest requirement for store assignment; push, camera, and battery
 * are important but can be completed later from Settings. Background
 * location is handled separately via PermissionModal when relevant.
 */
const PERMISSIONS_LIST: {
  key: keyof PermissionsState;
  icon: typeof Bell;
  title: string;
  description: string;
}[] = [
  {
    key: "pushNotifications",
    icon: Bell,
    title: "Push Notification",
    description: "Turn on notifications to get updates about your application",
  },
  {
    key: "camera",
    icon: Camera,
    title: "Camera",
    description: "We need your camera to take pictures or upload documents",
  },
  {
    key: "battery",
    icon: Battery,
    title: "Battery Usage",
    description: "We need you to allow unrestricted battery usage to connect you to nearby Stores",
  },
  {
    key: "location",
    icon: MapPin,
    title: "Location",
    description: "We need your location to connect you to nearby Stores",
  },
];

function areRequiredPermissionsAllowed(permissions: PermissionsState): boolean {
  return PERMISSIONS_LIST.every((p) => permissions[p.key] === "allowed");
}

export default function PermissionsRequiredScreen() {
  const router = useRouter();
  const {
    permissions,
    setPermission,
    completePermissionOnboarding,
    hasCompletedPermissionOnboarding,
    phoneNumber,
  } = useAuth();
  const { requestPermission, requestBackgroundPermission, locationPermission, backgroundLocationPermission, refreshPermissions } = useLocation();
  const [selectedPermission, setSelectedPermission] = useState<keyof PermissionsState | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showConfirmBgLocation, setShowConfirmBgLocation] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const didBlurOnMountRef = useRef(false);
  const permissionsRef = useRef(permissions);
  const isProceedingRef = useRef(false);
  const [isProceeding, setIsProceeding] = useState(false);

  useEffect(() => {
    console.log("Permissions mounted");
    return () => {
      console.log("Permissions unmounted");
    };
  }, []);

  useEffect(() => {
    console.log("permissions changed", permissions);
  }, [permissions]);

  useEffect(() => {
    permissionsRef.current = permissions;
  }, [permissions]);

  // Already completed onboarding (persisted) — skip this screen.
  useEffect(() => {
    if (hasCompletedPermissionOnboarding) {
      logRouteTransition("permissions", "auto-replace (onboarding already done)", "/login");
      blurActiveElementBeforeNav();
      router.replace("/login" as Href);
    }
  }, [hasCompletedPermissionOnboarding, router]);

  const openAppSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      // Ignore - Linking.openSettings can fail on some environments
    }
  };
  
  // Check if running in Expo Go
  const isExpoGo = Constants?.executionEnvironment === "storeClient";

  /** Sync denied states from OS when user revokes in Settings. Never auto-mark camera/location allowed. */
  const syncPermissionsFromOs = useCallback(async () => {
    try {
      const camera = await ImagePicker.getCameraPermissionsAsync();
      if (PERMISSION_DEBUG) {
        console.log("[PermissionDebug] syncPermissionsFromOs: camera OS", camera.status, camera.granted);
      }
      if (camera.status === "denied" && permissionsRef.current.camera !== "allowed") {
        await setPermission("camera", "denied");
      }

      if (Platform.OS !== "web" && !isExpoGo) {
        const notifStatus = await getNotificationPermissionStatus();
        if (PERMISSION_DEBUG) {
          console.log("[PermissionDebug] syncPermissionsFromOs: push OS", notifStatus);
        }
        if (notifStatus === "granted") {
          await setPermission("pushNotifications", "allowed");
        } else if (notifStatus === "denied") {
          await setPermission("pushNotifications", "denied");
        }
      }

      const foreground = await checkLocationPermission();
      if (PERMISSION_DEBUG) {
        console.log("[PermissionDebug] syncPermissionsFromOs: location OS", foreground);
      }
      if (
        (foreground === "denied" || foreground === "blocked") &&
        permissionsRef.current.location !== "allowed"
      ) {
        await setPermission("location", "denied");
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("[PermissionsScreen] syncPermissionsFromOs failed:", err);
      }
    }
  }, [isExpoGo, setPermission]);

  // Initialize once; permission cards stay pending until the user taps Allow on each card.
  useEffect(() => {
    if (!hasInitialized) setHasInitialized(true);
  }, [hasInitialized]);

  // Refresh permissions when screen comes into focus (user might have been in Settings)
  // Also ensure the screen always opens at the top
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      if (!didBlurOnMountRef.current) {
        didBlurOnMountRef.current = true;
        requestAnimationFrame(() => blurActiveElementBeforeNav());
      }

      if (__DEV__) {
        console.log('Permissions screen focused - refreshing permissions');
      }
      
      // Manually refresh permissions to catch any changes made in Settings
      // Use a small delay to ensure OS has registered the permission change
      const timer = setTimeout(async () => {
        try {
          await refreshPermissions();
          await syncPermissionsFromOs();
          if (__DEV__) {
            console.log("Permissions refreshed after Settings");
          }
        } catch (err) {
          if (__DEV__) console.error("Error refreshing permissions on focus:", err);
        }
      }, 300);

      return () => clearTimeout(timer);
    }, [refreshPermissions, syncPermissionsFromOs])
  );

  // Reflect OS revokes in Settings only — never auto-allow location from LocationContext.
  useEffect(() => {
    if (!hasInitialized) return;

    if (
      (locationPermission === "denied" || locationPermission === "blocked") &&
      permissions.location !== "allowed"
    ) {
      setPermission("location", "denied");
    }

    if (
      (backgroundLocationPermission === "denied" || backgroundLocationPermission === "blocked") &&
      permissions.backgroundLocation !== "allowed"
    ) {
      setPermission("backgroundLocation", "denied");
    }
  }, [
    backgroundLocationPermission,
    hasInitialized,
    locationPermission,
    permissions.backgroundLocation,
    permissions.location,
    setPermission,
  ]);

  // When modal closes, refresh permissions to catch changes made in Settings
  useEffect(() => {
    if (selectedPermission === null && hasInitialized) {
      // After modal closes, refresh locationContext permissions
      // which will trigger the sync effect below
      if (__DEV__) {
        console.log('[PermissionsScreen] Modal closed, permissions state:', {
          locationPermission,
          backgroundLocationPermission,
        });
      }
    }
  }, [selectedPermission, hasInitialized, locationPermission, backgroundLocationPermission]);

  const handlePermissionPress = (key: keyof PermissionsState) => {
    setSelectedPermission(key);
  };

  const handleAllow = async () => {
    if (selectedPermission) {
      // For push notifications, actually request the permission
      if (selectedPermission === "pushNotifications") {
        // Check if running in Expo Go (push notifications not supported in Expo Go SDK 53+)
        const isExpoGo =
          typeof Constants !== 'undefined' &&
          Constants?.executionEnvironment === 'storeClient';

        // In Expo Go or web, mark as allowed to allow user to proceed
        if (Platform.OS === 'web' || isExpoGo) {
          await setPermission(selectedPermission, "allowed");
          setSelectedPermission(null);
          return;
        }

        try {
          const granted = await requestNotificationPermissions();
          if (granted) {
            // Register for push notifications and get token
            const token = await registerForPushNotifications();
            if (token) {
              // Send token to backend if phone number is available
              await sendTokenToBackend(token, phoneNumber || undefined);
            }
            await setPermission(selectedPermission, "allowed");
          } else {
            await setPermission(selectedPermission, "denied");
          }
        } catch (error) {
          if (__DEV__) {
            console.error("Error requesting notification permissions:", error);
          }
          await setPermission(selectedPermission, "denied");
        }
      } else if (selectedPermission === "location") {
        try {
          await refreshPermissions();
          let osStatus = await checkLocationPermission();
          if (osStatus !== "granted") {
            const granted = await requestPermission();
            osStatus = granted ? "granted" : await checkLocationPermission();
          }
          if (osStatus === "granted") {
            await setPermission(selectedPermission, "allowed");
            if (isExpoGo) {
              await setPermission("backgroundLocation", "allowed");
            }
          } else {
            await setPermission(selectedPermission, "denied");
            appNotify.confirm(
              "Location permission is required to connect you to nearby Stores.\n\nPlease enable it in Settings:\n• iOS: Settings → Picker Pro → Location → While Using\n• Android: Settings → Apps → Picker Pro → Permissions → Location",
              openAppSettings,
              "Location Permission Denied",
              "Open Settings"
            );
          }
        } catch (error) {
          if (__DEV__) {
            console.error("Error requesting location permission:", error);
          }
          await setPermission(selectedPermission, "denied");
        }
      } else if (selectedPermission === "camera") {
        try {
          const { granted, status } = await ImagePicker.requestCameraPermissionsAsync();
          if (granted) {
            await setPermission(selectedPermission, "allowed");
          } else {
            await setPermission(selectedPermission, "denied");
            if (status === "denied") {
              appNotify.confirm(
                "Camera access is required for document uploads.\n\nEnable it in Settings:\n• iOS: Settings → Picker Pro → Camera\n• Android: Settings → Apps → Picker Pro → Permissions → Camera",
                openAppSettings,
                "Camera Permission Denied",
                "Open Settings"
              );
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.error("Error requesting camera permission:", error);
          }
          await setPermission(selectedPermission, "denied");
        }
      } else if (selectedPermission === "backgroundLocation") {
        // Request real background location permission
        try {
          // First ensure foreground location is granted
          if (locationPermission !== 'granted') {
            const foregroundGranted = await requestPermission();
            if (!foregroundGranted) {
              appNotify.info(
                "Foreground location permission must be granted first.\n\nPlease enable it in Settings, then try again.",
                "Location Permission Required"
              );
              await setPermission(selectedPermission, "denied");
              setSelectedPermission(null);
              return;
            }
          }

          // For background location, requestBackgroundPermission will show an alert with "Open Settings"
          // We wait for the user's action and then manually refresh permissions
          const granted = await requestBackgroundPermission();
          
          if (granted) {
            await setPermission(selectedPermission, "allowed");
            setSelectedPermission(null);
          } else {
            // User was shown an alert to open Settings. Do NOT close the modal yet.
            // Instead, keep watching for permission changes while modal stays open.
            // When user returns from Settings with permission enabled, we'll detect it.
            
            if (__DEV__) {
              console.log('[PermissionsScreen] Background permission request showed Settings alert, watching for changes...');
            }
            
            // Start watching for permission changes
            // Keep checking until either:
            // 1. Permission is granted (user enabled it in Settings) -> close modal
            // 2. User manually dismisses via handleDontAllow -> close modal
            const watchPermissions = async () => {
              for (let i = 0; i < 30; i++) {
                // Longer initial delay and increasing delays per attempt
                // Android takes significant time to register permission changes
                const delayMs = Math.min(500 + i * 300, 5000);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
                // Check if modal is still open - if not, stop watching
                if (selectedPermission !== 'backgroundLocation') {
                  if (__DEV__) console.log('[PermissionsScreen] Modal was dismissed, stopping watch');
                  break;
                }
                
                try {
                  const currentStatus = await checkBackgroundLocationPermission();
                  if (__DEV__ && (i < 2 || i % 5 === 0)) {
                    console.log(`[PermissionsScreen] Watch iteration ${i + 1} (${delayMs}ms delay): background location = ${currentStatus}`);
                  }
                  
                  if (currentStatus === 'granted') {
                    if (__DEV__) console.log('[PermissionsScreen] ✓✓✓ DETECTED: Background permission is GRANTED!');
                    await setPermission('backgroundLocation', 'allowed');
                    setSelectedPermission(null);
                    return;
                  }
                } catch (checkErr) {
                  if (__DEV__) {
                    console.error(`[PermissionsScreen] Error during watch iteration ${i + 1}:`, checkErr);
                  }
                }
              }
              
              if (__DEV__) {
                console.log('[PermissionsScreen] Watch completed - 30 iterations done without detecting grant');
              }
            };
            
            watchPermissions().catch(err => {
              if (__DEV__) console.error('[PermissionsScreen] watchPermissions error:', err);
            });
            
            // Important: DO NOT close the modal here. Let the watch function close it.
            return;
          }
        } catch (error) {
          if (__DEV__) {
            console.error("Error requesting background location permission:", error);
          }
          await setPermission(selectedPermission, "denied");
        }
      } else {
        // For other permissions (camera, battery), just set the status
        await setPermission(selectedPermission, "allowed");
      }
      setSelectedPermission(null);
    }
  };

  const handleDontAllow = () => {
    if (selectedPermission) {
      setPermission(selectedPermission, "denied");
      setSelectedPermission(null);
      setShowConfirmBgLocation(false);
    }
  };
  
  // For Expo Go: User confirmed they've enabled background location in Settings
  const handleConfirmBgLocationExpoGo = async () => {
    if (__DEV__) {
      console.log('[PermissionsScreen] User confirmed background location enabled in Expo Go Settings');
    }
    // Trust that user has enabled it and mark as allowed
    await setPermission('backgroundLocation', 'allowed');
    setSelectedPermission(null);
    setShowConfirmBgLocation(false);
  };

  const canProceed = areRequiredPermissionsAllowed(permissions);

  console.log("PermissionsScreen render", {
    canProceed,
    isProceeding,
    selectedPermission,
  });

  if (canProceed && selectedPermission) {
    console.warn(
      "[ProceedTapProbe] canProceed=true while modal still open — taps hit Modal, not Proceed",
      { selectedPermission }
    );
  }

  const logOsUiSnapshot = useCallback(async () => {
    if (!PERMISSION_DEBUG) return;
    const camera = await ImagePicker.getCameraPermissionsAsync();
    const foreground = await checkLocationPermission();
    logOsVsUi({
      pushUI: permissions.pushNotifications,
      cameraUI: permissions.camera,
      batteryUI: permissions.battery,
      locationUI: permissions.location,
      backgroundLocationUI: permissions.backgroundLocation,
      cameraOS: camera.status,
      cameraOSGranted: camera.granted,
      locationOS: foreground,
      locationContextForeground: locationPermission,
      locationContextBackground: backgroundLocationPermission,
      canProceed,
      requiredKeys: PERMISSIONS_LIST.map((p) => p.key),
    });
  }, [permissions, locationPermission, backgroundLocationPermission, canProceed]);

  useEffect(() => {
    void logOsUiSnapshot();
  }, [logOsUiSnapshot]);

  const navigateToLogin = useCallback(() => {
    logRouteTransition("permissions", "replace", "/login");
    logProceedStep("Before router.replace(/login)");
    blurActiveElementBeforeNav();
    router.replace("/login" as Href);
    logProceedStep("After router.replace(/login)");
  }, [router]);

  const handleProceed = useCallback(async () => {
    console.log("PROCEED PRESSED");
    logProceedStep("Handler entered");

    if (isProceedingRef.current) {
      logProceedStep("Ignored — already proceeding");
      return;
    }

    const latestPermissions = permissionsRef.current;
    const permitted = areRequiredPermissionsAllowed(latestPermissions);

    logValidationSnapshot("Proceed press", {
      canProceed,
      permitted,
      hasCompletedPermissionOnboarding,
      selectedPermission,
      currentPermissions: permissions,
      latestPermissions,
      requiredKeysChecked: PERMISSIONS_LIST.map((p) => ({
        key: p.key,
        status: latestPermissions[p.key],
        passes: latestPermissions[p.key] === "allowed",
      })),
      allPermissionsGrantedAuth: Object.entries(latestPermissions).map(([k, v]) => ({
        key: k,
        status: v,
      })),
    });

    if (!permitted) {
      logProceedStep("Blocked — validation failed");
      appNotify.info(
        "Allow all permissions on this screen to continue.",
        "Permissions Required"
      );
      return;
    }

    isProceedingRef.current = true;
    setIsProceeding(true);
    try {
      setSelectedPermission(null);
      logProceedStep("Before completePermissionOnboarding");
      await completePermissionOnboarding();
      logProceedStep("After completePermissionOnboarding");

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      navigateToLogin();
    } catch (error) {
      logProceedStep("Failed", { error: String(error) });
      if (__DEV__) {
        console.error("[PermissionsScreen] handleProceed failed:", error);
      }
      appNotify.error("Could not continue. Please try again.");
    } finally {
      isProceedingRef.current = false;
      setIsProceeding(false);
    }
  }, [
    canProceed,
    completePermissionOnboarding,
    hasCompletedPermissionOnboarding,
    navigateToLogin,
    selectedPermission,
  ]);

  // Reserve space so scroll content is not hidden under the absolute footer (see training.tsx).
  const footerReservedHeight =
    Spacing.lg + 48 + Spacing.lg + 2 + Math.max(Spacing.lg, insets.bottom + Spacing.lg) + 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        {...scrollViewTouchProps}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerReservedHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        // Keep native-feeling scrolling (esp. iOS).
        bounces={Platform.OS === "ios"}
        alwaysBounceVertical={Platform.OS === "ios"}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Bell color="#FFFFFF" size={29} strokeWidth={2} />
          </View>
          <Text style={styles.title}>Permissions Required</Text>
          <Text style={styles.subtitle}>Grant the required access to continue using the App</Text>
        </View>

        <View style={styles.permissionsList}>
          {PERMISSIONS_LIST.map((permission) => (
            <PermissionCard
              key={permission.key}
              icon={permission.icon}
              title={permission.title}
              description={permission.description}
              status={permissions[permission.key]}
              onPress={() => handlePermissionPress(permission.key)}
            />
          ))}
        </View>

        <View style={[styles.spacer, { height: footerReservedHeight }]} />
      </ScrollView>

      <View
        collapsable={false}
        style={[
          styles.buttonContainer,
          { paddingBottom: Math.max(Spacing.lg, insets.bottom + Spacing.lg) },
        ]}
      >
        {canProceed && !selectedPermission ? (
          <PrimaryButton
            title="Proceed"
            onPress={() => void handleProceed()}
            loading={isProceeding}
            disabled={isProceeding}
          />
        ) : null}
      </View>

      {selectedPermission ? (
        <PermissionModal
          visible={!!selectedPermission}
          permissionKey={selectedPermission}
          onAllow={handleAllow}
          onDontAllow={handleDontAllow}
          onConfirmExpoGo={handleConfirmBgLocationExpoGo}
          showExpoGoConfirmButton={showConfirmBgLocation && selectedPermission === 'backgroundLocation'}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollView: {
    flex: 1,
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    // SafeAreaView already handles the top inset; keep this as visual spacing.
    paddingTop: Spacing.headerTop,
    paddingBottom: Spacing['4xl'],
  },
  iconContainer: {
    width: Spacing['7xl'] * 0.6,
    height: Spacing['7xl'] * 0.6,
    borderRadius: BorderRadius['2xl-lg'] * 0.6,
    backgroundColor: Colors.primary[650],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing['2xl'],
    ...(Platform.OS === 'web' 
      ? { boxShadow: `0px ${Spacing.sm}px ${Spacing.lg}px rgba(18, 19, 88, 0.3)`, elevation: 8 }
      : { shadowColor: Colors.primary[650], shadowOffset: { width: 0, height: Spacing.sm }, shadowOpacity: 0.3, shadowRadius: Spacing.lg, elevation: 8 }
    ),
  },
  title: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    letterSpacing: Typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: Typography.fontSize['md-lg'],
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: Typography.lineHeight.normal * Typography.fontSize['md-lg'],
    paddingHorizontal: Spacing.xl,
  },
  permissionsList: {
    gap: 0,
  },
  spacer: {
    height: Spacing.xl,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: Spacing.md,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px -4px 12px rgba(0, 0, 0, 0.1)", elevation: 10 }
      : { ...Shadows.lg, shadowOffset: { width: 0, height: -4 }, elevation: 10 }),
  },
});
