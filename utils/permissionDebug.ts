import type { PermissionsState } from "@/state/authContext";

const PREFIX = "[PermissionDebug]";

/** Enable verbose permission + navigation tracing in dev builds. */
export const PERMISSION_DEBUG = __DEV__;

export function logPermissionUpdate(
  source: string,
  permissionType: keyof PermissionsState,
  newStatus: string,
  permissions: PermissionsState
): void {
  if (!PERMISSION_DEBUG) return;
  console.log(PREFIX, "Permission Update", {
    source,
    permissionType,
    newStatus,
    permissions: { ...permissions },
  });
}

export function logProceedStep(step: string, extra?: Record<string, unknown>): void {
  if (!PERMISSION_DEBUG) return;
  console.log(PREFIX, "PROCEED", step, extra ?? {});
}

export function logRouteTransition(screen: string, action: string, target?: string): void {
  if (!PERMISSION_DEBUG) return;
  console.log(PREFIX, "Route", { screen, action, target });
}

export function logValidationSnapshot(label: string, payload: Record<string, unknown>): void {
  if (!PERMISSION_DEBUG) return;
  console.log(PREFIX, "Validation", label, payload);
}

export function logOsVsUi(snapshot: Record<string, unknown>): void {
  if (!PERMISSION_DEBUG) return;
  console.log(PREFIX, "OS vs UI", snapshot);
}
