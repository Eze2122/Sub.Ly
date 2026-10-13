// Pure calendar-date helpers. All dates are "YYYY-MM-DD" in local time.
import type { CustomInterval, Frequency, Service, ServiceStatus } from "./types.ts";

export function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(now: Date = new Date()) {
  return toISO(now);
}
export function parseISO(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
export function isValidISO(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
export function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
export function daysInMonth(y: number, m: number) {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
function fromParts(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function toUTCDays(s: string) {
  const { y, m, d } = parseISO(s);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function diffDays(a: string, b: string) {
  return toUTCDays(a) - toUTCDays(b);
}
export function addDays(s: string, n: number) {
  const { y, m, d } = parseISO(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return fromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
/** Adds months clamping to the end of month; `anchorDay` keeps 31st cycles on month-end. */
export function addMonths(s: string, n: number, anchorDay?: number) {
  const { y, m, d } = parseISO(s);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return fromParts(ny, nm, day);
}

export function intervalOf(frequency: Frequency, custom?: CustomInterval): CustomInterval | null {
  switch (frequency) {
    case "weekly":
      return { count: 1, unit: "week" };
    case "monthly":
      return { count: 1, unit: "month" };
    case "quarterly":
      return { count: 3, unit: "month" };
    case "annual":
      return { count: 12, unit: "month" };
    case "custom":
      return custom && custom.count > 0 ? custom : null;
    default:
      return null;
  }
}

export function addInterval(s: string, iv: CustomInterval, anchorDay?: number, times = 1) {
  const n = iv.count * times;
  switch (iv.unit) {
    case "day":
      return addDays(s, n);
    case "week":
      return addDays(s, n * 7);
    case "month":
      return addMonths(s, n, anchorDay);
    case "year":
      return addMonths(s, n * 12, anchorDay);
  }
}

/** Approximate length in days, used for monthly equivalents. */
export function intervalDays(iv: CustomInterval) {
  return { day: 1, week: 7, month: 30.436875, year: 365.2425 }[iv.unit] * iv.count;
}

/** Next due date after `from` for the service cycle. Returns null for one-time / ended. */
export function nextDueAfter(
  svc: Pick<Service, "frequency" | "customInterval" | "anchorDay" | "endDate">,
  from: string,
): string | null {
  const iv = intervalOf(svc.frequency, svc.customInterval);
  if (!iv) return null;
  const next = addInterval(from, iv, svc.anchorDay);
  if (svc.endDate && next > svc.endDate) return null;
  return next;
}

/** Start date of the period that ends at `due` (previous due date). */
export function previousDue(svc: Pick<Service, "frequency" | "customInterval" | "anchorDay">, due: string) {
  const iv = intervalOf(svc.frequency, svc.customInterval);
  if (!iv) return null;
  return addInterval(due, { ...iv, count: -iv.count }, svc.anchorDay);
}

/** First due date on/after `today` starting from `start`, used to suggest a next due. */
export function firstDueOnOrAfter(
  svc: Pick<Service, "frequency" | "customInterval" | "anchorDay" | "endDate">,
  start: string,
  today: string,
) {
  const iv = intervalOf(svc.frequency, svc.customInterval);
  if (!iv) return start;
  let cur = start;
  let i = 0;
  while (cur < today && i < 2000) {
    i += 1;
    cur = addInterval(start, iv, svc.anchorDay ?? parseISO(start).d, i);
  }
  if (svc.endDate && cur > svc.endDate) return null;
  return cur;
}

export function computeStatus(svc: Service, today: string): ServiceStatus {
  if (svc.cancelled) return "cancelled";
  if (svc.trialEnd && svc.trialEnd >= today && (!svc.trialStart || svc.trialStart <= today)) return "trial";
  if (!svc.nextDue) return "paid";
  if (svc.nextDue < today) return "overdue";
  if (svc.nextDue === today) return "due_today";
  if (svc.lastPaid) {
    const prev = previousDue(svc, svc.nextDue);
    if (prev && svc.lastPaid >= addDays(prev, -7) && diffDays(svc.nextDue, today) > 7) return "paid";
  }
  return "upcoming";
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  const { y, m, d } = parseISO(s);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function formatShort(s: string) {
  const { m, d } = parseISO(s);
  return `${d} ${MONTHS[m - 1]}`;
}
export function relativeDue(s: string | null, today: string) {
  if (!s) return "Sin próximo vencimiento";
  const n = diffDays(s, today);
  if (n === 0) return "Vence hoy";
  if (n === 1) return "Vence mañana";
  if (n > 1) return `En ${n} días`;
  if (n === -1) return "Venció ayer";
  return `Venció hace ${-n} días`;
}
