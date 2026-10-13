// Local notifications (Android). Identifiers are deterministic, so a full
// reschedule never creates duplicates. Called after every persisted change.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NOTIF_PREFIX, planNotifications } from "@/src/domain/reminders.ts";
import type { AppState } from "@/src/domain/types.ts";

const CHANNEL = "subly-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PermissionInfo = { status: "granted" | "denied" | "undetermined"; canAskAgain: boolean };

export async function getPermission(): Promise<PermissionInfo> {
  const p = await Notifications.getPermissionsAsync();
  return { status: p.status as PermissionInfo["status"], canAskAgain: p.canAskAgain };
}

export async function requestPermission(): Promise<PermissionInfo> {
  await ensureChannel();
  const p = await Notifications.requestPermissionsAsync();
  return { status: p.status as PermissionInfo["status"], canAskAgain: p.canAskAgain };
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Recordatorios de pagos",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function rescheduleSoon(state: AppState) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    reschedule(state).catch(() => undefined);
  }, 600);
}

export async function reschedule(state: AppState) {
  const perm = await getPermission();
  if (perm.status !== "granted") return 0;
  await ensureChannel();
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const planned = planNotifications(state);
  const wanted = new Set(planned.map((p) => p.id));
  for (const n of existing) {
    if (n.identifier.startsWith(NOTIF_PREFIX) && !wanted.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  const have = new Set(existing.map((n) => n.identifier));
  for (const p of planned) {
    if (have.has(p.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL },
    });
  }
  return planned.length;
}

export const notificationsSupported = true;
