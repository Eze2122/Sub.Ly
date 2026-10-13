// Background tasks are not available on web.
export const GMAIL_TASK = "subly-gmail-daily-sync";
export async function enableDailySync() {
  return false;
}
export async function disableDailySync() {}
