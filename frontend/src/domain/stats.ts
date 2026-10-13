// Derived statistics computed from real user records only.
import { addDays, computeStatus, parseISO, pad } from "./dates.ts";
import { addTo, monthlyEquivalent, type CurrencyTotals } from "./money.ts";
import type { CategoryId, Payment, Service, ServiceStatus } from "./types.ts";

export type Summary = {
  monthly: CurrencyTotals;
  annual: CurrencyTotals;
  byStatus: Record<ServiceStatus, Service[]>;
  upcoming: Service[];
  dueToday: Service[];
  overdue: Service[];
  trials: Service[];
  active: Service[];
  renewals: Service[];
};

export function isActive(s: Service) {
  return !s.cancelled;
}

export function summarize(services: Service[], today: string): Summary {
  const byStatus: Record<ServiceStatus, Service[]> = {
    upcoming: [], due_today: [], paid: [], overdue: [], trial: [], cancelled: [],
  };
  const monthly: CurrencyTotals = {};
  for (const s of services) {
    byStatus[computeStatus(s, today)].push(s);
    if (!s.cancelled && s.frequency !== "once" && (!s.endDate || s.endDate >= today)) {
      addTo(monthly, s.currency, monthlyEquivalent(s));
    }
  }
  for (const k of Object.keys(monthly)) monthly[k] = Math.round(monthly[k]);
  const annual: CurrencyTotals = {};
  for (const [k, v] of Object.entries(monthly)) annual[k] = Math.round(v * 12);
  const sortDue = (a: Service, b: Service) => (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999");
  const in30 = addDays(today, 30);
  const active = services.filter(isActive).sort(sortDue);
  return {
    monthly,
    annual,
    byStatus,
    upcoming: active.filter((s) => s.nextDue && s.nextDue > today && s.nextDue <= in30),
    dueToday: byStatus.due_today,
    overdue: byStatus.overdue.sort(sortDue),
    trials: byStatus.trial.sort((a, b) => (a.trialEnd ?? "").localeCompare(b.trialEnd ?? "")),
    active,
    renewals: active.filter(
      (s) => s.frequency !== "once" && s.nextDue && s.nextDue > today && s.nextDue <= addDays(today, 60),
    ),
  };
}

/** Monthly estimate per category for a currency (minor units). */
export function categoryDistribution(services: Service[], today: string) {
  const out: Record<string, Record<CategoryId, number>> = {};
  for (const s of services) {
    if (s.cancelled || s.frequency === "once" || (s.endDate && s.endDate < today)) continue;
    out[s.currency] = out[s.currency] ?? ({} as Record<CategoryId, number>);
    out[s.currency][s.category] = (out[s.currency][s.category] ?? 0) + Math.round(monthlyEquivalent(s));
  }
  return out;
}

export function monthKey(iso: string) {
  const { y, m } = parseISO(iso);
  return `${y}-${pad(m)}`;
}
export function lastMonths(today: string, n: number) {
  const { y, m } = parseISO(today);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    keys.push(`${Math.floor(total / 12)}-${pad((total % 12) + 1)}`);
  }
  return keys;
}

/** Confirmed payments grouped by month and currency. */
export function paidByMonth(payments: Payment[], months: string[]) {
  const out: Record<string, CurrencyTotals> = {};
  for (const k of months) out[k] = {};
  for (const p of payments) {
    const k = monthKey(p.paidDate);
    if (out[k]) addTo(out[k], p.currency, p.amountMinor);
  }
  return out;
}

/** Due dates within a month (for the calendar), including projected recurring dates. */
export function dueDatesInMonth(services: Service[], year: number, month: number) {
  const map: Record<string, Service[]> = {};
  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-31`;
  for (const s of services) {
    if (s.cancelled || !s.nextDue) continue;
    if (s.nextDue >= start && s.nextDue <= end) (map[s.nextDue] = map[s.nextDue] ?? []).push(s);
  }
  return map;
}
