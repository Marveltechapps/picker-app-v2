import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// Local types matching expo-notifications (no import = no Metro graph edge to expo-notifications from this file)
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
export type NotificationLike = {
  request: {
    identifier?: string;
    content: { title?: string; body?: string; data?: Record<string, unknown> };
  };
  date: number;
};
export type NotificationResponseLike = { notification: NotificationLike; actionIdentifier: string };

// Check if expo-device is available
let Device: typeof import('expo-device') | null = null;
try {
  Device = require('expo-device');
} catch {
  // expo-device not available, will handle gracefully
}

// Check if running in Expo Go (push notifications not supported in Expo Go SDK 53+)
const isExpoGo =
  typeof Constants !== 'undefined' &&
  Constants?.executionEnvironment === 'storeClient';

// Lazy-load expo-notifications so Expo Go never loads it (avoids "removed from Expo Go" error at import time)
let NotificationsModule: any = null;
function getNotifications(): any {
  if (Platform.OS === 'web' || isExpoGo) return null;
  if (NotificationsModule) return NotificationsModule;
  try {
    NotificationsModule = require('expo-notifications');
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    return NotificationsModule;
  } catch (e) {
    if (__DEV__) console.warn('Notification handler setup failed:', e);
    return null;
  }
}

export interface PushNotificationToken {
  token: string;
  deviceId?: string;
  platform: 'ios' | 'android' | 'web';
}

/**
 * Request notification permissions
 * Returns true if permission is granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Push notifications are not supported on web
    if (Platform.OS === 'web') {
      if (__DEV__) console.warn('Push notifications are not supported on web');
      return false;
    }

    if (isExpoGo) return false;

    const Notifications = getNotifications();
    if (!Notifications) return false;

    // Check if running on a physical device
    if (Device) {
      if (!Device.isDevice) {
        if (__DEV__) console.warn('Push notifications only work on physical devices, not simulators/emulators');
        return false;
      }
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) console.warn('Failed to get push notification permissions');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    return true;
  } catch (error) {
    if (__DEV__) console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get current notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  try {
    // Not supported in Expo Go (SDK 53+)
    if (isExpoGo) {
      return 'undetermined';
    }
    const Notifications = getNotifications();
    if (!Notifications) return 'undetermined';
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    if (__DEV__) console.error('Error getting notification permission status:', error);
    return 'undetermined';
  }
}

/**
 * Register for push notifications and get Expo Push Token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const isExpoGo = Constants?.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    console.log('[Push] Skipping push registration in Expo Go');
    return null;
  }

  try {
    // Push notifications are not supported on web
    if (Platform.OS === 'web') {
      if (__DEV__) console.warn('Push notifications are not supported on web');
      return null;
    }

    // Check if running on a physical device
    if (Device) {
      if (!Device.isDevice) {
        if (__DEV__) console.warn('Push notifications only work on physical devices, not simulators/emulators');
        return null;
      }
    }

    // Check permissions first
    const permissionStatus = await getNotificationPermissionStatus();
    if (permissionStatus !== 'granted') {
      if (__DEV__) console.warn('Notification permissions not granted');
      return null;
    }

    // Get existing token from storage
    const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    if (storedToken) {
      try {
        const parsed = JSON.parse(storedToken);
        // Verify token is still valid by checking format
        if (parsed?.token && parsed.token.startsWith('ExponentPushToken')) {
          return parsed.token;
        }
      } catch {
        // Invalid stored token, continue to get new one
      }
    }

    // Get project ID from expo-constants
    // Try multiple sources for project ID (SDK 54+ uses manifest2, older uses expoConfig)
    let projectId: string | undefined;
    
    // Try manifest2 first (newer Expo SDK)
    if (Constants.manifest2?.extra?.eas?.projectId) {
      projectId = Constants.manifest2.extra.eas.projectId;
    }
    // Fallback to expoConfig (older Expo SDK)
    else if (Constants.expoConfig?.extra?.eas?.projectId) {
      projectId = Constants.expoConfig.extra.eas.projectId;
    }
    // Fallback to legacy manifest
    else if ((Constants.manifest as any)?.extra?.eas?.projectId) {
      projectId = (Constants.manifest as any).extra.eas.projectId;
    }
    
    if (!projectId && __DEV__) {
      console.warn('EAS project ID not found. Push notifications may not work correctly.');
      console.warn('To fix: Run "eas build:configure" or add projectId to app.json extra.eas.projectId');
    }

    // Register for push notifications
    const Notifications = getNotifications();
    if (!Notifications) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;

    // Store token
    const tokenInfo: PushNotificationToken = {
      token,
      platform: Platform.OS as 'ios' | 'android' | 'web',
      deviceId: Device?.modelName || undefined,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, JSON.stringify(tokenInfo));

    if (__DEV__) {
      console.log('Push notification token registered successfully:', token);
    }
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (__DEV__) {
      console.error('Error registering for push notifications:', errorMessage);
      if (errorMessage.includes('projectId') || errorMessage.includes('project')) {
        console.error('💡 Tip: Make sure you have configured EAS project ID. Run "eas build:configure" or add it to app.json');
      }
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        console.error('💡 Tip: Make sure notification permissions are granted');
      }
    }
    return null;
  }
}

/**
 * Get stored push token
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.token || null;
    }
    return null;
  } catch (error) {
    if (__DEV__) console.error('Error getting stored push token:', error);
    return null;
  }
}

/**
 * Clear stored push token
 */
export async function clearPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
  } catch (error) {
    if (__DEV__) console.error('Error clearing push token:', error);
  }
}

/**
 * Send push token to backend
 * 
 * IMPORTANT: Configure your backend URL by setting EXPO_PUBLIC_API_URL in your .env file
 * Example: EXPO_PUBLIC_API_URL=https://api.yourapp.com
 * 
 * The backend endpoint should accept POST requests with:
 * {
 *   token: string (Expo push token),
 *   userId?: string,
 *   platform: 'ios' | 'android' | 'web',
 *   deviceId?: string
 * }
 */
export async function sendTokenToBackend(token: string, userId?: string): Promise<boolean> {
  try {
    // Use apiPost so Authorization header (Bearer token) is attached automatically.
    // Do not send client-controlled userId; backend will set req.userId from the token.
    const { apiPost } = await import('@/utils/apiClient');
    await apiPost('/api/push-tokens', {
      token,
      platform: Platform.OS,
      deviceId: Device?.modelName,
    });
    if (__DEV__) console.log('Push token sent to backend successfully');
    return true;
  } catch (error) {
    if (__DEV__) console.error('Error sending token to backend:', error);
    // Don't throw - token registration should still succeed even if backend call fails
    return false;
  }
}

/**
 * Setup notification listeners
 * Returns cleanup function
 * Note: Push notifications are not supported on web
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: NotificationLike) => void,
  onNotificationTapped?: (response: NotificationResponseLike) => void
): () => void {
  // Push notifications are not supported on web
  if (Platform.OS === 'web') {
    return () => {
      // No-op cleanup for web
    };
  }

  if (isExpoGo) return () => {};

  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  try {
    // Listener for notifications received while app is foregrounded
    const receivedListener = Notifications.addNotificationReceivedListener((notification: NotificationLike) => {
      if (__DEV__) console.log('Notification received (foreground):', notification);
      onNotificationReceived?.(notification);
    });

    // Listener for when user taps on a notification
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: NotificationResponseLike) => {
      if (__DEV__) console.log('Notification tapped:', response);
      onNotificationTapped?.(response);
    });

    // Return cleanup function
    return () => {
      try {
        if (receivedListener && typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(receivedListener);
        }
        if (responseListener && typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(responseListener);
        }
      } catch (error) {
        if (__DEV__) console.warn('Error removing notification subscriptions:', error);
      }
    };
  } catch (error) {
    if (__DEV__) console.warn('Error setting up notification listeners:', error);
    return () => {
      // No-op cleanup on error
    };
  }
}

/**
 * Get last notification response (when app opened from notification)
 * Note: Not available on web
 */
export async function getLastNotificationResponse(): Promise<NotificationResponseLike | null> {
  // Not available on web
  if (Platform.OS === 'web') {
    return null;
  }

  // Not available in Expo Go (SDK 53+)
  if (isExpoGo) {
    return null;
  }

  const Notifications = getNotifications();
  if (!Notifications) return null;

  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (error) {
    // Silently handle errors (method may not be available on all platforms)
    return null;
  }
}

/**
 * Set notification badge count (iOS only)
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    if (Platform.OS !== 'ios') return;
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    if (__DEV__) console.error('Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    if (__DEV__) console.error('Error clearing notifications:', error);
  }
}

/**
 * Send a test/local notification immediately
 * Useful for testing notification functionality
 */
export async function sendTestNotification(title: string = 'Test Notification', body: string = 'This is a test notification'): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (__DEV__) console.warn('Test notifications are not supported on web');
      return null;
    }

    // Check permissions first
    const permissionStatus = await getNotificationPermissionStatus();
    if (permissionStatus !== 'granted') {
      if (__DEV__) console.warn('Cannot send test notification: permissions not granted');
      return null;
    }

    const Notifications = getNotifications();
    if (!Notifications) return null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: {
          type: 'test',
          timestamp: Date.now(),
        },
      },
      trigger: null, // null means send immediately
    });

    if (__DEV__) console.log('Test notification sent:', notificationId);
    return notificationId;
  } catch (error) {
    if (__DEV__) console.error('Error sending test notification:', error);
    return null;
  }
}

/**
 * Verify push notification setup
 * Returns diagnostic information about the push notification configuration
 */
export async function verifyPushNotificationSetup(): Promise<{
  isSupported: boolean;
  isExpoGo: boolean;
  isPhysicalDevice: boolean;
  hasPermissions: boolean;
  hasProjectId: boolean;
  projectId?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let projectId: string | undefined;
  
  // Check project ID
  if (Constants.manifest2?.extra?.eas?.projectId) {
    projectId = Constants.manifest2.extra.eas.projectId;
  } else if (Constants.expoConfig?.extra?.eas?.projectId) {
    projectId = Constants.expoConfig.extra.eas.projectId;
  } else if ((Constants.manifest as any)?.extra?.eas?.projectId) {
    projectId = (Constants.manifest as any).extra.eas.projectId;
  }
  
  if (!projectId) {
    errors.push('EAS project ID not found. Run "eas build:configure" or add to app.json');
  }
  
  // Check permissions
  let hasPermissions = false;
  try {
    const status = await getNotificationPermissionStatus();
    hasPermissions = status === 'granted';
    if (!hasPermissions) {
      errors.push(`Notification permissions not granted. Status: ${status}`);
    }
  } catch (error) {
    errors.push('Failed to check notification permissions');
  }
  
  // Check device
  const isPhysicalDevice = Device ? Device.isDevice : true;
  if (!isPhysicalDevice) {
    errors.push('Push notifications only work on physical devices, not simulators/emulators');
  }
  
  return {
    isSupported: !isExpoGo && Platform.OS !== 'web',
    isExpoGo,
    isPhysicalDevice,
    hasPermissions,
    hasProjectId: !!projectId,
    projectId,
    errors,
  };
}

/**
 * Complete push notification setup flow
 * Requests permissions, registers token, sends to backend, and optionally sends test notification
 */
export async function setupPushNotificationsComplete(
  userId?: string,
  sendTest: boolean = false
): Promise<{
  success: boolean;
  token: string | null;
  error?: string;
}> {
  try {
    // Expo Go: no push support — treat as success so callers do not show failure alerts
    if (isExpoGo) {
      return {
        success: true,
        token: null,
      };
    }

    // Step 1: Request permissions
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      return {
        success: false,
        token: null,
        error: 'Notification permissions not granted',
      };
    }

    // Step 2: Register for push notifications
    const token = await registerForPushNotifications();
    if (!token) {
      return {
        success: false,
        token: null,
        error: 'Failed to register for push notifications',
      };
    }

    // Step 3: Send token to backend
    const backendSuccess = await sendTokenToBackend(token, userId);
    if (!backendSuccess && __DEV__) {
      console.warn('Token registered but failed to send to backend');
    }

    // Step 4: Optionally send test notification
    if (sendTest) {
      await sendTestNotification(
        'Push Notifications Enabled',
        'You will now receive push notifications from Picker Pro'
      );
    }

    return {
      success: true,
      token,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (__DEV__) console.error('Error in setupPushNotificationsComplete:', error);
    return {
      success: false,
      token: null,
      error: errorMessage,
    };
  }
}
