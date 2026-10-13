// Pure state transitions (CRUD, payments, suggestions, restore). No I/O here.
import { addDays, computeStatus, firstDueOnOrAfter, isValidISO, nextDueAfter, parseISO } from "./dates.ts";
import type { AppState, CategoryId, CustomInterval, Frequency, Payment, Service, Suggestion } from "./types.ts";

export const SCHEMA_VERSION = 2;

export function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    services: [],
    payments: [],
    suggestions: [],
    dismissedRefs: [],
    rates: [],
    settings: {
      mainCurrency: "ARS",
      currencies: ["ARS", "USD", "EUR", "BRL"],
      notifications: { d7: true, d3: true, d1: true, d0: true, overdue: true, trialEnd: true },
    },
    gmail: {
      connected: false,
      email: null,
      connectedAt: null,
      lastSyncAt: null,
      lastSyncStatus: "idle",
      lastError: null,
      lastNewCount: 0,
      initialScanDone: false,
      processedIds: [],
    },
  };
}

/** Schema migrations. v1 -> v2 added `dismissedRefs` and `reminders` per service. */
export function migrate(raw: any): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  let s = { ...raw };
  const v = Number(s.schemaVersion ?? 1);
  if (v < 2) {
    s.dismissedRefs = s.dismissedRefs ?? [];
    s.services = (s.services ?? []).map((x: any) => ({ reminders: true, ...x }));
  }
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...(s.settings ?? {}), notifications: { ...base.settings.notifications, ...(s.settings?.notifications ?? {}) } },
    gmail: { ...base.gmail, ...(s.gmail ?? {}) },
    schemaVersion: SCHEMA_VERSION,
  };
}

let counter = 0;
export function uid(prefix = "id") {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${counter.toString(36)}`;
}

export type ServiceInput = {
  name: string;
  description?: string;
  category: CategoryId;
  amountMinor: number | null;
  currency: string;
  frequency: Frequency;
  customInterval?: CustomInterval;
  nextDue: string | null;
  lastPaid?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
  reminders: boolean;
  notes?: string;
  source?: "manual" | "gmail";
  sourceRef?: string | null;
};

export type FieldErrors = Partial<Record<keyof ServiceInput | "customCount", string>>;

export function validateServiceInput(i: ServiceInput): FieldErrors {
  const e: FieldErrors = {};
  if (!i.name.trim()) e.name = "Ingresá el nombre del servicio.";
  else if (i.name.trim().length > 60) e.name = "Máximo 60 caracteres.";
  const inTrialOnly = !!i.trialEnd && (i.amountMinor === null || i.amountMinor === 0);
  if (i.amountMinor === null && !inTrialOnly) e.amountMinor = "Ingresá un importe válido.";
  if (!/^[A-Z]{3}$/.test(i.currency)) e.currency = "Elegí una moneda.";
  if (i.frequency === "custom" && (!i.customInterval || !Number.isInteger(i.customInterval.count) || i.customInterval.count < 1 || i.customInterval.count > 365))
    e.customCount = "Indicá un intervalo entre 1 y 365.";
  if (i.nextDue !== null && !isValidISO(i.nextDue)) e.nextDue = "Fecha inválida.";
  if (i.frequency !== "once" && !i.nextDue && !i.startDate) e.nextDue = "Indicá el próximo vencimiento.";
  for (const k of ["lastPaid", "startDate", "endDate", "trialStart", "trialEnd"] as const) {
    if (i[k] && !isValidISO(i[k])) e[k] = "Fecha inválida.";
  }
  if (i.startDate && i.endDate && i.endDate < i.startDate) e.endDate = "La finalización debe ser posterior al inicio.";
  if (i.trialStart && i.trialEnd && i.trialEnd < i.trialStart) e.trialEnd = "El fin de la prueba debe ser posterior al inicio.";
  return e;
}

function normalize(i: ServiceInput, today: string) {
  let nextDue = i.nextDue;
  if (!nextDue && i.startDate && i.frequency !== "once") {
    nextDue = firstDueOnOrAfter({ frequency: i.frequency, customInterval: i.customInterval, anchorDay: parseISO(i.startDate).d, endDate: i.endDate }, i.startDate, today);
  }
  return {
    name: i.name.trim(),
    description: i.description?.trim() || undefined,
    category: i.category,
    amountMinor: i.amountMinor ?? 0,
    currency: i.currency,
    frequency: i.frequency,
    customInterval: i.frequency === "custom" ? i.customInterval : undefined,
    anchorDay: nextDue ? parseISO(nextDue).d : undefined,
    nextDue,
    lastPaid: i.lastPaid || null,
    startDate: i.startDate || null,
    endDate: i.endDate || null,
    trialStart: i.trialStart || null,
    trialEnd: i.trialEnd || null,
    reminders: i.reminders,
    notes: i.notes?.trim() || undefined,
  };
}

export function createService(state: AppState, i: ServiceInput, nowIso: string, today: string): { state: AppState; service: Service } {
  const service: Service = {
    id: uid("svc"),
    ...normalize(i, today),
    cancelled: false,
    cancelledAt: null,
    source: i.source ?? "manual",
    sourceRef: i.sourceRef ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return { state: { ...state, services: [...state.services, service] }, service };
}

export function updateService(state: AppState, id: string, i: ServiceInput, nowIso: string, today: string): AppState {
  return {
    ...state,
    services: state.services.map((s) => (s.id === id ? { ...s, ...normalize(i, today), updatedAt: nowIso } : s)),
  };
}

/** Deletes a service. Payment history is removed only when `withHistory` is true. */
export function deleteService(state: AppState, id: string, withHistory: boolean): AppState {
  return {
    ...state,
    services: state.services.filter((s) => s.id !== id),
    payments: withHistory ? state.payments.filter((p) => p.serviceId !== id) : state.payments,
  };
}

export function cancelService(state: AppState, id: string, today: string, nowIso: string): AppState {
  return {
    ...state,
    services: state.services.map((s) => (s.id === id ? { ...s, cancelled: true, cancelledAt: today, updatedAt: nowIso } : s)),
  };
}
export function reactivateService(state: AppState, id: string, nowIso: string): AppState {
  return {
    ...state,
    services: state.services.map((s) => (s.id === id ? { ...s, cancelled: false, cancelledAt: null, updatedAt: nowIso } : s)),
  };
}

/** Confirms a payment for the current cycle and advances the next due date. */
export function confirmPayment(
  state: AppState,
  id: string,
  paidDate: string,
  amountMinor: number,
  nowIso: string,
  evidence: Payment["evidence"] = "manual",
): AppState {
  const svc = state.services.find((s) => s.id === id);
  if (!svc || svc.cancelled) return state;
  const dueDate = svc.nextDue;
  const already = state.payments.some((p) => p.serviceId === id && p.dueDate === dueDate && dueDate !== null);
  if (already) return state;
  const payment: Payment = {
    id: uid("pay"),
    serviceId: id,
    serviceName: svc.name,
    category: svc.category,
    dueDate,
    paidDate,
    amountMinor,
    currency: svc.currency,
    evidence,
    createdAt: nowIso,
  };
  const nextDue = dueDate ? nextDueAfter(svc, dueDate) : null;
  return {
    ...state,
    payments: [...state.payments, payment],
    services: state.services.map((s) => (s.id === id ? { ...s, lastPaid: paidDate, nextDue: svc.frequency === "once" ? null : nextDue, updatedAt: nowIso } : s)),
  };
}

export function deletePayment(state: AppState, paymentId: string): AppState {
  return { ...state, payments: state.payments.filter((p) => p.id !== paymentId) };
}

export function normName(n: string) {
  return n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function findDuplicate(state: AppState, name: string, sourceRef?: string | null) {
  const nn = normName(name);
  return state.services.find((s) => (sourceRef && s.sourceRef === sourceRef) || (nn.length > 2 && normName(s.name) === nn)) ?? null;
}

export function suggestionToInput(sg: Suggestion, today: string): ServiceInput {
  return {
    name: sg.name,
    category: sg.category,
    amountMinor: sg.amountMinor,
    currency: sg.currency ?? "USD",
    frequency: sg.frequency,
    nextDue: sg.nextDue && sg.nextDue >= today ? sg.nextDue : sg.nextDue ? addDays(today, 1) : null,
    trialEnd: sg.trialEnd,
    reminders: true,
    source: "gmail",
    sourceRef: sg.sourceRef,
  };
}

export function dismissSuggestion(state: AppState, id: string): AppState {
  const sg = state.suggestions.find((s) => s.id === id);
  return {
    ...state,
    suggestions: state.suggestions.filter((s) => s.id !== id),
    dismissedRefs: sg ? Array.from(new Set([...state.dismissedRefs, `${sg.sourceRef}|${sg.kind}`])) : state.dismissedRefs,
  };
}

/** Removes Gmail-sourced records (manual ones are kept). */
export function removeGmailRecords(state: AppState): AppState {
  const ids = new Set(state.services.filter((s) => s.source === "gmail").map((s) => s.id));
  return {
    ...state,
    services: state.services.filter((s) => !ids.has(s.id)),
    payments: state.payments.filter((p) => !ids.has(p.serviceId)),
    suggestions: [],
  };
}

/** Restore: "replace" swaps all records; "merge" adds records whose id/content is new. */
export function restoreInto(current: AppState, incoming: AppState, mode: "merge" | "replace"): { state: AppState; added: number; skipped: number } {
  if (mode === "replace") {
    return { state: { ...incoming, gmail: current.gmail }, added: incoming.services.length, skipped: 0 };
  }
  const ids = new Set(current.services.map((s) => s.id));
  const keys = new Set(current.services.map((s) => `${normName(s.name)}|${s.currency}|${s.amountMinor}`));
  let skipped = 0;
  const newServices = incoming.services.filter((s) => {
    const dup = ids.has(s.id) || keys.has(`${normName(s.name)}|${s.currency}|${s.amountMinor}`);
    if (dup) skipped++;
    return !dup;
  });
  const payIds = new Set(current.payments.map((p) => p.id));
  const payKeys = new Set(current.payments.map((p) => `${p.serviceId}|${p.dueDate}|${p.paidDate}|${p.amountMinor}`));
  const newPayments = incoming.payments.filter((p) => !payIds.has(p.id) && !payKeys.has(`${p.serviceId}|${p.dueDate}|${p.paidDate}|${p.amountMinor}`));
  const rateKeys = new Set(current.rates.map((r) => `${r.from}|${r.to}`));
  return {
    state: {
      ...current,
      services: [...current.services, ...newServices],
      payments: [...current.payments, ...newPayments],
      rates: [...current.rates, ...incoming.rates.filter((r) => !rateKeys.has(`${r.from}|${r.to}`))],
      settings: { ...current.settings, currencies: Array.from(new Set([...current.settings.currencies, ...incoming.settings.currencies])) },
    },
    added: newServices.length,
    skipped,
  };
}

export { computeStatus };
