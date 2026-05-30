import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import createContextHook from "@nkzw/create-context-hook";
import Constants from "expo-constants";
import { DeviceEventEmitter } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { appNotify } from "@/utils/appNotify";
import { clearAllCached } from "@/utils/asyncStorageCache";
import { clearPickerConfigCache } from "@/services/config.service";
import { router } from "expo-router";
import { setSessionInvalidationHandler } from "@/utils/sessionInvalidation";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { endShiftApi } from "@/services/shifts.service";
import { apiGet, ApiClientError } from "@/utils/apiClient";
import { isTokenExpired } from "@/utils/auth";

export type PermissionStatus = "pending" | "allowed" | "denied";

export interface PermissionsState {
  pushNotifications: PermissionStatus;
  camera: PermissionStatus;
  battery: PermissionStatus;
  location: PermissionStatus;
  backgroundLocation: PermissionStatus;
}

export interface UserProfile {
  name: string;
  age: number;
  gender: "male" | "female";
  photoUri: string;
  email?: string;
  /** ISO date string from backend for "Member since" display */
  createdAt?: string;
}

export interface DocumentUploads {
  aadhar: {
    front: string | null;
    back: string | null;
  };
  pan: {
    front: string | null;
    back: string | null;
  };
}

export interface TrainingProgress {
  video1?: number;
  video2?: number;
  video3?: number;
  video4?: number;
  [key: string]: number | undefined;
}

export type LocationType = "warehouse" | "darkstore" | null;

export interface ShiftSelection {
  id: string;
  name: string;
  time: string;
}

export type NotificationType = 'payout' | 'order' | 'shift' | 'training' | 'milestone' | 'bonus' | 'update';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
}

interface AuthState {
  hasCompletedPermissionOnboarding: boolean;
  hasCompletedLogin: boolean;
  hasCompletedProfile: boolean;
  hasCompletedVerification: boolean;
  hasCompletedDocuments: boolean;
  hasCompletedTraining: boolean;
  hasCompletedSetup: boolean;
  hasCompletedManagerOTP: boolean;
  permissions: PermissionsState;
  phoneNumber: string | null;
  userProfile: UserProfile | null;
  documentUploads: DocumentUploads;
  trainingProgress: TrainingProgress;
  locationType: LocationType;
  selectedShifts: ShiftSelection[];
  shiftActive: boolean;
  shiftStartTime: number | null;
  notifications: Notification[];
  isLoading: boolean;
  /** True when we had a token but it was invalidated (401/403); used to redirect to login instead of splash */
  tokenExpired: boolean;
}

/** Max time to wait for AsyncStorage load; prevents endless loading when storage hangs. */
const LOAD_STATE_TIMEOUT_MS = 5000;
/** Longer timeout in Expo Go where AsyncStorage can be slow on cold start. */
const LOAD_STATE_TIMEOUT_EXPO_GO_MS = 15000;

interface StartupProfileData {
  name?: string;
  age?: number;
  gender?: "male" | "female";
  photoUri?: string;
  email?: string;
  createdAt?: string;
  selectedShifts?: unknown[];
  locationType?: string;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [state, setState] = useState<AuthState>({
    hasCompletedPermissionOnboarding: false,
    hasCompletedLogin: false,
    hasCompletedProfile: false,
    hasCompletedVerification: false,
    hasCompletedDocuments: false,
    hasCompletedTraining: false,
    hasCompletedSetup: false,
    hasCompletedManagerOTP: false,
    permissions: {
      pushNotifications: "pending",
      camera: "pending",
      battery: "pending",
      location: "pending",
      backgroundLocation: "pending",
    },
    phoneNumber: null,
    userProfile: null,
    documentUploads: {
      aadhar: { front: null, back: null },
      pan: { front: null, back: null },
    },
    trainingProgress: {
      video1: 0,
      video2: 0,
      video3: 0,
      video4: 0,
    },
    locationType: null,
    selectedShifts: [],
    shiftActive: false,
    shiftStartTime: null,
    notifications: [],
    isLoading: true,
    tokenExpired: false,
  });

  useEffect(() => {
    loadState();
  }, []);

  const getLoadStateTimeout = () => {
    try {
      const isExpoGo = typeof Constants !== "undefined" && Constants?.executionEnvironment === "storeClient";
      return isExpoGo ? LOAD_STATE_TIMEOUT_EXPO_GO_MS : LOAD_STATE_TIMEOUT_MS;
    } catch {
      return LOAD_STATE_TIMEOUT_MS;
    }
  };

  const setDefaultState = () => {
    setState({
      hasCompletedPermissionOnboarding: false,
      hasCompletedLogin: false,
      hasCompletedProfile: false,
      hasCompletedVerification: false,
      hasCompletedDocuments: false,
      hasCompletedTraining: false,
      hasCompletedSetup: false,
      hasCompletedManagerOTP: false,
      permissions: {
        pushNotifications: "pending",
        camera: "pending",
        battery: "pending",
        location: "pending",
        backgroundLocation: "pending",
      },
      phoneNumber: null,
      userProfile: null,
      documentUploads: {
        aadhar: { front: null, back: null },
        pan: { front: null, back: null },
      },
      trainingProgress: {
        video1: 0,
        video2: 0,
        video3: 0,
        video4: 0,
      },
      locationType: null,
      selectedShifts: [],
      shiftActive: false,
      shiftStartTime: null,
      notifications: [],
      isLoading: false,
      tokenExpired: false,
    });
  };

  const normalizeSelectedShifts = (value: unknown): ShiftSelection[] => {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const shift = item as Record<string, unknown>;
        const id = typeof shift.id === "string" ? shift.id.trim() : "";
        const name = typeof shift.name === "string" ? shift.name.trim() : "";
        const time = typeof shift.time === "string" ? shift.time.trim() : "";

        if (!id) return null;
        return { id, name, time };
      })
      .filter((item): item is ShiftSelection => item !== null);
  };

  const loadState = async (isRetry = false) => {
    try {
      const storagePromise = Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.PHONE_NUMBER),
        AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_ONBOARDING),
      ]);
      const timeoutMs = getLoadStateTimeout();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LOAD_STATE_TIMEOUT")), timeoutMs)
      );

      let [token, phoneNumber, permissionOnboarding] = await Promise.race([
        storagePromise,
        timeoutPromise,
      ]);

      // Check for token in AsyncStorage as fallback (migration from old versions)
      if (!token) {
        token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          // Migrate to SecureStore
          await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
          await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        }
      }

      // Verify JWT expiry
      if (token && isTokenExpired(token)) {
        if (__DEV__) console.log("[Auth] Token expired on startup, clearing.");
        await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        token = null;
      }

      let hasToken = !!(token && token.trim());
      let startupProfile: StartupProfileData | null = null;
      if (hasToken) {
        try {
          await apiGet<{ hasCompletedProfile?: boolean }>("/onboarding/state");
          const profileResponse = await apiGet<ApiDataResponse<StartupProfileData>>("/users/profile");
          startupProfile = (profileResponse as ApiDataResponse<StartupProfileData>).data ?? null;
        } catch (err) {
          const apiErr = err as ApiClientError;
          if (apiErr?.status === 401 || apiErr?.status === 403) {
            await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
            await AsyncStorage.removeItem(STORAGE_KEYS.PHONE_NUMBER);
            hasToken = false;
            if (__DEV__) console.log("[Auth] Token expired/invalid, cleared storage.");
          } else if (__DEV__) {
            console.warn("[Auth] Failed to hydrate startup profile:", apiErr?.message ?? err);
          }
        }
      }

      const tokenExpired = !hasToken && !!(token && token.trim());

      const startupLocationType =
        startupProfile?.locationType === "warehouse" || startupProfile?.locationType === "darkstore"
          ? startupProfile.locationType
          : null;
      const startupSelectedShifts = normalizeSelectedShifts(startupProfile?.selectedShifts);
      const startupUserProfile =
        startupProfile &&
        (
          startupProfile.name ||
          startupProfile.age != null ||
          startupProfile.gender ||
          startupProfile.photoUri ||
          startupProfile.email ||
          startupProfile.createdAt
        )
          ? {
              name: startupProfile.name ?? "",
              age: startupProfile.age ?? 0,
              gender: startupProfile.gender ?? "male",
              photoUri: startupProfile.photoUri ?? "",
              email: startupProfile.email,
              createdAt: startupProfile.createdAt,
            }
          : null;
      setState({
        hasCompletedPermissionOnboarding: permissionOnboarding === "true",
        hasCompletedLogin: hasToken,
        hasCompletedProfile: false,
        hasCompletedVerification: false,
        hasCompletedDocuments: false,
        hasCompletedTraining: false,
        hasCompletedSetup: false,
        hasCompletedManagerOTP: false,
        permissions: {
          pushNotifications: "pending",
          camera: "pending",
          battery: "pending",
          location: "pending",
          backgroundLocation: "pending",
        },
        phoneNumber: phoneNumber ?? null,
        userProfile: startupUserProfile,
        documentUploads: { aadhar: { front: null, back: null }, pan: { front: null, back: null } },
        trainingProgress: { video1: 0, video2: 0, video3: 0, video4: 0 },
        locationType: startupLocationType,
        selectedShifts: startupSelectedShifts,
        shiftActive: false,
        shiftStartTime: null,
        notifications: [],
        isLoading: false,
        tokenExpired,
      });
    } catch (error) {
      if (!isRetry) {
        if (__DEV__) {
          console.warn("[Auth] loadState failed, retrying once:", error instanceof Error ? error.message : error);
        }
        await loadState(true);
        return;
      }
      if (__DEV__) {
        console.warn("[Auth] loadState retry failed; using default state.", error instanceof Error ? error.message : error);
      }
      setDefaultState();
    } finally {
      setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev));
    }
  };

  const setPermission = useCallback(async (key: keyof PermissionsState, status: PermissionStatus) => {
    setState((prev) => {
      if (prev.permissions[key] === status) return prev;
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [key]: status,
        },
      };
    });
    // Plan: token + phone only in AsyncStorage; permissions stay in-memory
  }, []);

  const completePermissionOnboarding = async () => {
    setState((prev) => ({ ...prev, hasCompletedPermissionOnboarding: true }));
    await AsyncStorage.setItem(STORAGE_KEYS.PERMISSION_ONBOARDING, "true");
  };

  const completeLogin = async (phone: string, token?: string) => {
    // 1. Persist to storage first so API calls have the token
    await AsyncStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, phone);
    if (token) {
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
    }

    // 2. Clear previous user's profile data before setting new session
    // This prevents the previous user's name from showing after account switch
    setState((prev) => ({
      ...prev,
      hasCompletedLogin: true,
      phoneNumber: phone,
      tokenExpired: false,
      // Reset all user-specific data so stale profile never shows
      userProfile: null,
      hasCompletedProfile: false,
      hasCompletedVerification: false,
      hasCompletedDocuments: false,
      hasCompletedTraining: false,
      hasCompletedSetup: false,
      hasCompletedManagerOTP: false,
      documentUploads: {
        aadhar: { front: null, back: null },
        pan: { front: null, back: null },
      },
      trainingProgress: {
        video1: 0,
        video2: 0,
        video3: 0,
        video4: 0,
      },
      locationType: null,
      selectedShifts: [],
      shiftActive: false,
      shiftStartTime: null,
    }));
  };

  const completeProfile = async (profile: UserProfile) => {
    setState((prev) => ({ ...prev, hasCompletedProfile: true, userProfile: profile }));
  };

  const updateProfile = async (profile: UserProfile, phoneNumber?: string) => {
    const mergedProfile: UserProfile = state.userProfile ? { ...state.userProfile, ...profile } : profile;
    setState((prev) => ({
      ...prev,
      userProfile: mergedProfile,
      ...(phoneNumber && { phoneNumber }),
    }));
    if (phoneNumber) {
      await AsyncStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, phoneNumber);
    }
  };

  const completeVerification = async () => {
    setState((prev) => ({ ...prev, hasCompletedVerification: true }));
  };

  const completeDocuments = async () => {
    setState((prev) => ({ ...prev, hasCompletedDocuments: true }));
  };

  const updateDocumentUpload = async (docType: "aadhar" | "pan", side: "front" | "back", uri: string) => {
    const newDocuments = {
      ...state.documentUploads,
      [docType]: { ...state.documentUploads[docType], [side]: uri },
    };
    setState((prev) => ({ ...prev, documentUploads: newDocuments }));
  };

  const mergeDocumentsFromApi = async (documents: {
    aadhar?: { front?: string | null; back?: string | null };
    pan?: { front?: string | null; back?: string | null };
  }) => {
    const merged = {
      aadhar: {
        front: documents.aadhar?.front ?? state.documentUploads.aadhar.front,
        back: documents.aadhar?.back ?? state.documentUploads.aadhar.back,
      },
      pan: {
        front: documents.pan?.front ?? state.documentUploads.pan.front,
        back: documents.pan?.back ?? state.documentUploads.pan.back,
      },
    };
    setState((prev) => ({ ...prev, documentUploads: merged }));
  };

  const updateTrainingProgress = async (videoId: string, progress: number) => {
    const newProgress = { ...state.trainingProgress, [videoId]: progress };
    setState((prev) => ({ ...prev, trainingProgress: newProgress }));
  };

  const completeTraining = async () => {
    setState((prev) => ({ ...prev, hasCompletedTraining: true }));
  };

  const setLocationType = async (type: LocationType) => {
    setState((prev) => ({ ...prev, locationType: type }));
  };

  const setSelectedShifts = async (shifts: ShiftSelection[]) => {
    setState((prev) => ({ ...prev, selectedShifts: shifts }));
  };

  const completeSetup = async () => {
    setState((prev) => ({ ...prev, hasCompletedSetup: true }));
  };

  const completeManagerOTP = async () => {
    setState((prev) => ({ ...prev, hasCompletedManagerOTP: true }));
  };

  const startShift = async (shiftStartTimeFromApi?: number) => {
    const startTime = shiftStartTimeFromApi ?? Date.now();
    setState((prev) => ({ ...prev, shiftActive: true, shiftStartTime: startTime }));
  };

  const endShift = async () => {
    setState((prev) => ({ ...prev, shiftActive: false, shiftStartTime: null }));
  };

  const setNotifications = async (notificationsOrUpdater: Notification[] | ((prev: Notification[]) => Notification[])) => {
    if (typeof notificationsOrUpdater === "function") {
      setState((prev) => ({ ...prev, notifications: notificationsOrUpdater(prev.notifications) }));
    } else {
      setState((prev) => ({ ...prev, notifications: notificationsOrUpdater }));
    }
  };

  const markNotificationAsRead = async (id: string) => {
    const updatedNotifications = state.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    setState((prev) => ({ ...prev, notifications: updatedNotifications }));
  };

  const markAllNotificationsAsRead = async () => {
    const updatedNotifications = state.notifications.map((n) => ({ ...n, isRead: true }));
    setState((prev) => ({ ...prev, notifications: updatedNotifications }));
  };

  const unreadCount = state.notifications.filter(n => !n.isRead).length;

  const skipToLocationSetup = async () => {
    setState((prev) => ({
      ...prev,
      hasCompletedPermissionOnboarding: true,
      hasCompletedLogin: true,
      hasCompletedProfile: true,
      hasCompletedVerification: true,
      hasCompletedDocuments: true,
      hasCompletedTraining: true,
    }));
  };

  const logout = async () => {
    if (state.shiftActive) {
      try {
        await endShiftApi(state.phoneNumber ?? undefined);
      } catch {
        // Ignore errors - proceed with logout (e.g. already ended or network error)
      }
    }
    setState((prev) => ({ 
      ...prev, 
      hasCompletedLogin: false,
      hasCompletedProfile: false,
      hasCompletedVerification: false,
      hasCompletedDocuments: false,
      hasCompletedTraining: false,
      hasCompletedSetup: false,
      hasCompletedManagerOTP: false,
      phoneNumber: null,
      userProfile: null,
      documentUploads: {
        aadhar: { front: null, back: null },
        pan: { front: null, back: null },
      },
      trainingProgress: {
        video1: 0,
        video2: 0,
        video3: 0,
        video4: 0,
      },
      locationType: null,
      selectedShifts: [],
      shiftActive: false,
      shiftStartTime: null,
      notifications: [],
      tokenExpired: false,
    }));
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.PHONE_NUMBER);
    await clearAllCached("picker_");
    await clearAllCached("wallet_");
    await clearPickerConfigCache();
  };

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    setSessionInvalidationHandler(() => {
      void (async () => {
        await logoutRef.current();
        appNotify.info("You were logged in on another device.", "Signed out");
        try {
          router.replace("/login");
        } catch {
          /* no-op */
        }
      })();
    });
    return () => setSessionInvalidationHandler(null);
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("auth:logout", () => {
      void (async () => {
        await logoutRef.current();
      })();
    });
    return () => sub.remove();
  }, []);

  const resetAll = async () => {
    setState({
      hasCompletedPermissionOnboarding: false,
      hasCompletedLogin: false,
      hasCompletedProfile: false,
      hasCompletedVerification: false,
      hasCompletedDocuments: false,
      hasCompletedTraining: false,
      hasCompletedSetup: false,
      hasCompletedManagerOTP: false,
      permissions: {
        pushNotifications: "pending",
        camera: "pending",
        battery: "pending",
        location: "pending",
        backgroundLocation: "pending",
      },
      phoneNumber: null,
      userProfile: null,
      documentUploads: {
        aadhar: { front: null, back: null },
        pan: { front: null, back: null },
      },
      trainingProgress: {
        video1: 0,
        video2: 0,
        video3: 0,
        video4: 0,
      },
      locationType: null,
      selectedShifts: [],
      shiftActive: false,
      shiftStartTime: null,
      notifications: [],
      isLoading: false,
      tokenExpired: false,
    });
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PHONE_NUMBER,
      STORAGE_KEYS.PERMISSION_ONBOARDING,
    ]);
    await clearAllCached("picker_");
    await clearAllCached("wallet_");
    await clearPickerConfigCache();
  };

  const allPermissionsGranted = () => {
    return Object.values(state.permissions).every((status) => status === "allowed");
  };

  return {
    ...state,
    setPermission,
    completePermissionOnboarding,
    completeLogin,
    completeProfile,
    completeVerification,
    completeDocuments,
    updateDocumentUpload,
    mergeDocumentsFromApi,
    updateTrainingProgress,
    completeTraining,
    setLocationType,
    setSelectedShifts,
    completeSetup,
    completeManagerOTP,
    skipToLocationSetup,
    startShift,
    endShift,
    setNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    unreadCount,
    updateProfile,
    logout,
    resetAll,
    allPermissionsGranted,
  };
});
