import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import Constants from "expo-constants";
import { DeviceEventEmitter } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { appNotify } from "@/utils/appNotify";
import { clearAllCached } from "@/utils/asyncStorageCache";
import { clearPickerConfigCache } from "@/services/config.service";
import { setSessionInvalidationHandler } from "@/utils/sessionInvalidation";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { endShiftApi } from "@/services/shifts.service";
import { logoutApi } from "@/services/auth.service";
import {
  apiGet,
  ApiClientError,
  clearStoredAuthToken,
  getAuthToken,
  setStoredAuthToken,
} from "@/utils/apiClient";
import { isTokenExpired } from "@/utils/auth";
import {
  fetchOnboardingState,
  loadPersistedOnboardingProgress,
  mergeOnboardingProgress,
  persistOnboardingProgress,
  clearPersistedOnboardingProgress,
  onboardingFlagsFromState,
  onboardingFlagsForActivePicker,
  isExistingPickerReadyForHome,
  type OnboardingState,
} from "@/utils/startupRoute";
import { logPermissionUpdate } from "@/utils/permissionDebug";
import type { LoginMode } from "@/services/auth.service";
import type { PickerStatus } from "@/services/user.service";
import { isRealIndianPhone, normalizeIndianPhoneDigits } from "@/utils/contactDisplay";

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
  loginMethod?: LoginMode;
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
  loginMethod: LoginMode | null;
  loginCountryCode: string;
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
  phone?: string;
  age?: number;
  gender?: "male" | "female";
  photoUri?: string;
  email?: string;
  loginMethod?: LoginMode;
  createdAt?: string;
  selectedShifts?: unknown[];
  locationType?: string;
  status?: PickerStatus;
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
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

async function safeFetchOnboardingState(): Promise<OnboardingState | null> {
  try {
    if (typeof fetchOnboardingState === "function") {
      return await fetchOnboardingState();
    }
    const rawOnboarding = await apiGet<unknown>("/onboarding/state");
    return unwrapPickerEnvelope<OnboardingState>(rawOnboarding);
  } catch (error) {
    const apiError = error as ApiClientError;
    if (apiError?.status === 404) return null;
    return null;
  }
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
    loginMethod: null,
    loginCountryCode: "+91",
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
      loginMethod: null,
      loginCountryCode: "+91",
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
        getAuthToken(),
        AsyncStorage.getItem(STORAGE_KEYS.PHONE_NUMBER),
        AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_ONBOARDING),
        AsyncStorage.getItem(STORAGE_KEYS.LOGIN_METHOD),
        AsyncStorage.getItem(STORAGE_KEYS.LOGIN_COUNTRY_CODE),
        AsyncStorage.getItem(STORAGE_KEYS.LOGIN_EMAIL),
      ]);
      const timeoutMs = getLoadStateTimeout();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LOAD_STATE_TIMEOUT")), timeoutMs)
      );

      let [token, phoneNumber, permissionOnboarding, storedLoginMethod, storedCountryCode, storedLoginEmail] =
        await Promise.race([storagePromise, timeoutPromise]);

      // Verify JWT expiry
      if (token && isTokenExpired(token)) {
        if (__DEV__) console.log("[Auth] Token expired on startup, clearing.");
        await clearStoredAuthToken();
        token = null;
      }

      let hasToken = !!(token && token.trim());
      let startupProfile: StartupProfileData | null = null;
      let startupOnboarding: OnboardingState | null = null;
      if (hasToken) {
        try {
          startupOnboarding = await safeFetchOnboardingState();
          const profileResponse = await apiGet<ApiDataResponse<StartupProfileData>>("/users/profile");
          startupProfile = (profileResponse as ApiDataResponse<StartupProfileData>).data ?? null;
        } catch (err) {
          const apiErr = err as ApiClientError;
          if (apiErr?.status === 401 || apiErr?.status === 403) {
            await clearStoredAuthToken();
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
      const resolvedLoginMethod =
        (startupProfile?.loginMethod as LoginMode | undefined) ||
        (storedLoginMethod as LoginMode | null) ||
        null;
      const resolvedCountryCode = storedCountryCode || "+91";
      const resolvedPhone =
        isRealIndianPhone(startupProfile?.phone) && startupProfile?.phone
          ? normalizeIndianPhoneDigits(startupProfile.phone)
          : isRealIndianPhone(phoneNumber)
            ? normalizeIndianPhoneDigits(phoneNumber)
            : null;
      const resolvedEmail = startupProfile?.email || storedLoginEmail || undefined;
      const startupUserProfile =
        startupProfile &&
        (
          startupProfile.name ||
          startupProfile.age != null ||
          startupProfile.gender ||
          startupProfile.photoUri ||
          startupProfile.email ||
          startupProfile.createdAt ||
          resolvedLoginMethod
        )
          ? {
              name: startupProfile.name ?? "",
              age: startupProfile.age ?? 0,
              gender: startupProfile.gender ?? "male",
              photoUri: startupProfile.photoUri ?? "",
              email: resolvedEmail,
              loginMethod: resolvedLoginMethod ?? undefined,
              createdAt: startupProfile.createdAt,
            }
          : resolvedEmail || resolvedLoginMethod
            ? {
                name: "",
                age: 0,
                gender: "male" as const,
                photoUri: "",
                email: resolvedEmail,
                loginMethod: resolvedLoginMethod ?? undefined,
              }
            : null;
      const localOnboardingProgress = hasToken ? await loadPersistedOnboardingProgress() : {};
      let onboardingFlags = mergeOnboardingProgress(startupOnboarding, localOnboardingProgress);
      if (
        isExistingPickerReadyForHome(
          startupOnboarding,
          startupProfile ? { status: startupProfile.status } : null,
          localOnboardingProgress
        )
      ) {
        onboardingFlags = onboardingFlagsForActivePicker(startupOnboarding, localOnboardingProgress);
        await persistOnboardingProgress(onboardingFlags);
      }
      setState({
        hasCompletedPermissionOnboarding: permissionOnboarding === "true",
        hasCompletedLogin: hasToken,
        hasCompletedProfile: onboardingFlags.hasCompletedProfile,
        hasCompletedVerification: onboardingFlags.hasCompletedVerification,
        hasCompletedDocuments: onboardingFlags.hasCompletedDocuments,
        hasCompletedTraining: onboardingFlags.hasCompletedTraining,
        hasCompletedSetup: onboardingFlags.hasCompletedSetup,
        hasCompletedManagerOTP: onboardingFlags.hasCompletedManagerOTP,
        permissions: {
          pushNotifications: "pending",
          camera: "pending",
          battery: "pending",
          location: "pending",
          backgroundLocation: "pending",
        },
        phoneNumber: resolvedPhone,
        loginMethod: resolvedLoginMethod,
        loginCountryCode: resolvedCountryCode,
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
      const next = {
        ...prev,
        permissions: {
          ...prev.permissions,
          [key]: status,
        },
      };
      logPermissionUpdate("authContext.setPermission", key, status, next.permissions);
      return next;
    });
    // Plan: token + phone only in AsyncStorage; permissions stay in-memory
  }, []);

  const completePermissionOnboarding = async () => {
    if (__DEV__) console.log("[PermissionDebug] completePermissionOnboarding: before AsyncStorage");
    await AsyncStorage.setItem(STORAGE_KEYS.PERMISSION_ONBOARDING, "true");
    if (__DEV__) console.log("[PermissionDebug] completePermissionOnboarding: after AsyncStorage");
    setState((prev) => ({ ...prev, hasCompletedPermissionOnboarding: true }));
    if (__DEV__) console.log("[PermissionDebug] completePermissionOnboarding: after setState");
  };

  const completeLogin = async (
    phone: string,
    token?: string,
    options?: {
      isNewUser?: boolean;
      onboarding?: OnboardingState | null;
      loginMethod?: LoginMode;
      email?: string;
      countryCode?: string;
    }
  ): Promise<void> => {
    try {
      const loginMethod = options?.loginMethod ?? "mobile";
      const loginCountryCode = options?.countryCode ?? "+91";
      const loginEmail = options?.email?.trim().toLowerCase();
      const displayPhone = isRealIndianPhone(phone) ? normalizeIndianPhoneDigits(phone) : null;
      const isNewUser = options?.isNewUser === true;

      const storageWrites: [string, string][] = [
        [STORAGE_KEYS.LOGIN_METHOD, loginMethod],
        [STORAGE_KEYS.LOGIN_COUNTRY_CODE, loginCountryCode],
      ];
      if (displayPhone) {
        storageWrites.push([STORAGE_KEYS.PHONE_NUMBER, displayPhone]);
      } else {
        try {
          await AsyncStorage.removeItem(STORAGE_KEYS.PHONE_NUMBER);
        } catch {
          /* non-fatal */
        }
      }
      if (loginEmail) {
        storageWrites.push([STORAGE_KEYS.LOGIN_EMAIL, loginEmail]);
      }
      await AsyncStorage.multiSet(storageWrites);

      if (token) {
        await setStoredAuthToken(token);
      }

      const defaultNewUserFlags = {
        hasCompletedProfile: false,
        hasCompletedDocuments: false,
        hasCompletedVerification: false,
        hasCompletedTraining: false,
        hasCompletedSetup: false,
        hasCompletedManagerOTP: false,
      };

      let onboardingFlags = defaultNewUserFlags;
      let hydratedLocationType: LocationType = null;
      let hydratedSelectedShifts: ShiftSelection[] = [];
      let hydratedProfile: UserProfile | null = null;

      if (!isNewUser) {
        const localOnboardingProgress = await loadPersistedOnboardingProgress();
        let onboarding = options?.onboarding ?? null;
        let profileData: StartupProfileData | null = null;

        if (token) {
          onboarding = onboarding ?? (await safeFetchOnboardingState());
          try {
            const profileResponse = await apiGet<ApiDataResponse<StartupProfileData>>("/users/profile");
            profileData = (profileResponse as ApiDataResponse<StartupProfileData>).data ?? null;
          } catch {
            /* non-fatal */
          }
        }

        // Returning users skip onboarding replay — treat session as fully onboarded for navigation.
        onboardingFlags = onboardingFlagsForActivePicker(onboarding, localOnboardingProgress);

        hydratedLocationType =
          profileData?.locationType === "warehouse" || profileData?.locationType === "darkstore"
            ? profileData.locationType
            : null;
        hydratedSelectedShifts = normalizeSelectedShifts(profileData?.selectedShifts);

        if (
          profileData &&
          (profileData.name ||
            profileData.age != null ||
            profileData.gender ||
            profileData.photoUri ||
            profileData.email ||
            profileData.createdAt)
        ) {
          hydratedProfile = {
            name: profileData.name ?? "",
            age: profileData.age ?? 0,
            gender: (profileData.gender === "female" ? "female" : "male") as "male" | "female",
            photoUri: profileData.photoUri ?? "",
            email: profileData.email ?? loginEmail,
            loginMethod: (profileData.loginMethod as LoginMode | undefined) ?? loginMethod,
            createdAt: profileData.createdAt,
          };
        }

        await persistOnboardingProgress(onboardingFlags);
      }

      const initialProfile: UserProfile | null =
        hydratedProfile ??
        (loginEmail || loginMethod
          ? {
              name: "",
              age: 0,
              gender: "male",
              photoUri: "",
              email: loginEmail,
              loginMethod,
            }
          : null);

      setState((prev) => ({
        ...prev,
        hasCompletedLogin: true,
        phoneNumber: displayPhone,
        loginMethod,
        loginCountryCode,
        tokenExpired: false,
        userProfile: initialProfile,
        ...onboardingFlags,
        locationType: hydratedLocationType,
        selectedShifts: hydratedSelectedShifts,
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
        shiftActive: false,
        shiftStartTime: null,
      }));
    } catch (error) {
      if (__DEV__) {
        console.error("[Auth] completeLogin failed:", error);
      }
      throw error instanceof Error ? error : new Error("Failed to finish login");
    }
  };

  const applyOnboardingState = useCallback(async (onboarding: OnboardingState) => {
    const flags = onboardingFlagsFromState(onboarding);
    setState((prev) => ({
      ...prev,
      ...flags,
    }));
    await persistOnboardingProgress(flags);
  }, []);

  const syncOnboardingFromServer = useCallback(async (): Promise<OnboardingState | null> => {
    try {
      const onboarding = await safeFetchOnboardingState();
      if (onboarding) {
        await applyOnboardingState(onboarding);
      }
      return onboarding;
    } catch {
      return null;
    }
  }, [applyOnboardingState]);

  const completeProfile = async (profile: UserProfile) => {
    setState((prev) => ({ ...prev, hasCompletedProfile: true, userProfile: profile }));
    await persistOnboardingProgress({ hasCompletedProfile: true });
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
    await persistOnboardingProgress({ hasCompletedVerification: true });
  };

  const completeDocuments = async () => {
    setState((prev) => ({ ...prev, hasCompletedDocuments: true }));
    await persistOnboardingProgress({ hasCompletedDocuments: true });
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
    await persistOnboardingProgress({ hasCompletedTraining: true });
  };

  const setLocationType = async (type: LocationType) => {
    setState((prev) => ({ ...prev, locationType: type }));
  };

  const setSelectedShifts = async (shifts: ShiftSelection[]) => {
    setState((prev) => ({ ...prev, selectedShifts: shifts }));
  };

  const completeSetup = async () => {
    setState((prev) => ({ ...prev, hasCompletedSetup: true }));
    await persistOnboardingProgress({ hasCompletedSetup: true });
  };

  const completeManagerOTP = async () => {
    setState((prev) => ({ ...prev, hasCompletedManagerOTP: true }));
    await persistOnboardingProgress({ hasCompletedManagerOTP: true });
  };

  const startShift = async (shiftStartTimeFromApi?: number) => {
    const startTime = shiftStartTimeFromApi ?? Date.now();
    setState((prev) => ({ ...prev, shiftActive: true, shiftStartTime: startTime }));
  };

  const endShift = async () => {
    setState((prev) => ({ ...prev, shiftActive: false, shiftStartTime: null }));
  };

  const setNotifications = useCallback(
    async (notificationsOrUpdater: Notification[] | ((prev: Notification[]) => Notification[])) => {
      if (typeof notificationsOrUpdater === "function") {
        setState((prev) => ({ ...prev, notifications: notificationsOrUpdater(prev.notifications) }));
      } else {
        setState((prev) => ({ ...prev, notifications: notificationsOrUpdater }));
      }
    },
    []
  );

  const markNotificationAsRead = useCallback(async (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  }, []);

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
    try {
      await logoutApi();
    } catch {
      // Proceed with local logout even if server call fails
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
      loginMethod: null,
      loginCountryCode: "+91",
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
    await clearStoredAuthToken();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PHONE_NUMBER,
      STORAGE_KEYS.LOGIN_METHOD,
      STORAGE_KEYS.LOGIN_COUNTRY_CODE,
      STORAGE_KEYS.LOGIN_EMAIL,
    ]);
    await clearPersistedOnboardingProgress();
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
      loginMethod: null,
      loginCountryCode: "+91",
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
    await clearStoredAuthToken();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PHONE_NUMBER,
      STORAGE_KEYS.PERMISSION_ONBOARDING,
      STORAGE_KEYS.LOGIN_METHOD,
      STORAGE_KEYS.LOGIN_COUNTRY_CODE,
      STORAGE_KEYS.LOGIN_EMAIL,
    ]);
    await clearPersistedOnboardingProgress();
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
    applyOnboardingState,
    syncOnboardingFromServer,
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
