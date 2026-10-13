// Pure reminder planning (deterministic identifiers => no duplicates on reschedule).
import { addDays, computeStatus, todayISO } from "./dates.ts";
import { formatMoney } from "./money.ts";
import type { AppState } from "./types.ts";

export const NOTIF_PREFIX = "subly:";
export const MAX_SCHEDULED = 60;
export type Planned = { id: string; at: Date; title: string; body: string };

function at9(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 9, 0, 0);
}

export function planNotifications(state: AppState, now: Date = new Date()): Planned[] {
  const today = todayISO(now);
  const prefs = state.settings.notifications;
  const out: Planned[] = [];
  const offsets: [keyof typeof prefs, number, string][] = [
    ["d7", 7, "vence en 7 días"],
    ["d3", 3, "vence en 3 días"],
    ["d1", 1, "vence mañana"],
    ["d0", 0, "vence hoy"],
  ];
  let overdueCount = 0;
  for (const s of state.services) {
    if (s.cancelled || !s.reminders) continue;
    const status = computeStatus(s, today);
    if (status === "overdue") overdueCount++;
    if (s.nextDue && status !== "overdue") {
      for (const [k, n, label] of offsets) {
        if (!prefs[k]) continue;
        const when = at9(addDays(s.nextDue, -n));
        if (when > now) out.push({ id: `${NOTIF_PREFIX}${s.id}:${k}:${s.nextDue}`, at: when, title: `${s.name} ${label}`, body: `${formatMoney(s.amountMinor, s.currency)} · Tocá para ver el detalle.` });
      }
    }
    if (prefs.trialEnd && s.trialEnd) {
      for (const n of [1, 0]) {
        const when = at9(addDays(s.trialEnd, -n));
        if (when > now) out.push({ id: `${NOTIF_PREFIX}${s.id}:trial${n}:${s.trialEnd}`, at: when, title: `Tu prueba de ${s.name} ${n ? "termina mañana" : "termina hoy"}`, body: "Revisá si querés continuar o cancelar antes del primer cobro." });
      }
    }
  }
  if (prefs.overdue && overdueCount > 0) {
    const tomorrow = at9(addDays(today, 1));
    out.push({ id: `${NOTIF_PREFIX}overdue:${addDays(today, 1)}`, at: tomorrow, title: overdueCount === 1 ? "Tenés 1 pago atrasado" : `Tenés ${overdueCount} pagos atrasados`, body: "Confirmá los pagos realizados para mantener todo al día." });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}
