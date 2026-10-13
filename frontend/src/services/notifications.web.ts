// Web preview: local notifications are not available in the browser.
import type { AppState } from "@/src/domain/types.ts";

export type PermissionInfo = { status: "granted" | "denied" | "undetermined"; canAskAgain: boolean };
export async function getPermission(): Promise<PermissionInfo> {
  return { status: "undetermined", canAskAgain: false };
}
export async function requestPermission(): Promise<PermissionInfo> {
  return { status: "undetermined", canAskAgain: false };
}
export function rescheduleSoon(_s: AppState) {}
export async function reschedule(_s: AppState) {
  return 0;
}
export const notificationsSupported = false;
