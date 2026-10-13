// Daily background sync via expo-background-task (WorkManager on Android).
// Android decides the exact time (battery, network, Doze); never guaranteed.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { getState, loadState } from "@/src/data/store.ts";
import { getCachedEntitlement } from "@/src/billing/entitlement.ts";

import { runSync } from "./sync.ts";

export const GMAIL_TASK = "subly-gmail-daily-sync";

try {
  TaskManager.defineTask(GMAIL_TASK, async () => {
    try {
      await loadState();
      const ent = await getCachedEntitlement();
      if (!getState().gmail.connected || !ent.premium) return BackgroundTask.BackgroundTaskResult.Success;
      const r = await runSync();
      return r.ok ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
} catch {
  // Task manager unavailable (e.g. Expo Go on some platforms).
}

export async function enableDailySync() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(GMAIL_TASK))) {
      await BackgroundTask.registerTaskAsync(GMAIL_TASK, { minimumInterval: 24 * 60 });
    }
    return true;
  } catch {
    return false;
  }
}

export async function disableDailySync() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(GMAIL_TASK)) await BackgroundTask.unregisterTaskAsync(GMAIL_TASK);
  } catch {
    // ignore
  }
}
