import { Alert } from "react-native";

/**
 * Centralized notification helpers.
 *
 * Usage:
 *   appNotify.error("Something went wrong")
 *   appNotify.success("Saved!")
 *   appNotify.confirm("Delete this?", onConfirm)
 *   appNotify.permission("Camera", "Take photos")
 */

export const appNotify = {
  /**
   * Error alert — red, dismissible
   * Use for API failures, validation errors
   */
  error: (message: string, title = "Error") => {
    Alert.alert(title, message, [{ text: "OK" }]);
  },

  /**
   * Success alert — use sparingly,
   * prefer in-screen success modals instead
   */
  success: (message: string, title = "Success") => {
    Alert.alert(title, message, [{ text: "OK" }]);
  },

  /**
   * Confirmation dialog with Cancel + Confirm
   */
  confirm: (
    message: string,
    onConfirm: () => void,
    title = "Confirm",
    confirmLabel = "Confirm",
    destructive = false
  ) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: onConfirm,
      },
    ]);
  },

  /**
   * Permission required — opens Settings
   */
  permission: (permissionName: string, reason: string) => {
    Alert.alert(
      `${permissionName} Permission Required`,
      `Please allow ${reason} in your device settings to continue.`,
      [{ text: "OK" }]
    );
  },

  /**
   * Info alert — neutral
   */
  info: (message: string, title = "Info") => {
    Alert.alert(title, message, [{ text: "OK" }]);
  },

  /**
   * Multi-button alert (e.g. View / Update / Cancel)
   */
  choose: (
    title: string,
    message: string,
    buttons: {
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }[]
  ) => {
    Alert.alert(title, message, buttons);
  },
};
