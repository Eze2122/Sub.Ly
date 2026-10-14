// Core domain types for Subly. Dates are local calendar dates "YYYY-MM-DD".
// Money is stored as integer minor units (cents) + ISO 4217 currency code.

export type CategoryId =
  | "streaming"
  | "software"
  | "telecom"
  | "utilities"
  | "insurance"
  | "home"
  | "loans"
  | "gym"
  | "other";

export const CATEGORIES: { id: CategoryId; label: string; icon: string; chart: string }[] = [
  { id: "streaming", label: "Streaming y entretenimiento", icon: "play-circle-outline", chart: "chart1" },
  { id: "software", label: "Aplicaciones y software", icon: "apps-outline", chart: "chart2" },
  { id: "telecom", label: "Internet y telefonía", icon: "wifi-outline", chart: "chart3" },
  { id: "utilities", label: "Agua, gas y electricidad", icon: "flash-outline", chart: "chart4" },
  { id: "insurance", label: "Seguros y salud", icon: "shield-checkmark-outline", chart: "chart5" },
  { id: "home", label: "Alquiler y gastos del hogar", icon: "home-outline", chart: "chart6" },
  { id: "loans", label: "Préstamos y cuotas", icon: "card-outline", chart: "chart7" },
  { id: "gym", label: "Gimnasio y membresías", icon: "barbell-outline", chart: "chart8" },
  { id: "other", label: "Otros", icon: "ellipsis-horizontal-circle-outline", chart: "chart9" },
];

export type Frequency = "weekly" | "monthly" | "quarterly" | "annual" | "custom" | "once";

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensual" },
  { id: "quarterly", label: "Trimestral" },
  { id: "annual", label: "Anual" },
  { id: "custom", label: "Personalizada" },
  { id: "once", label: "Pago único" },
];

export type IntervalUnit = "day" | "week" | "month" | "year";
export type CustomInterval = { count: number; unit: IntervalUnit };

export type ServiceStatus = "upcoming" | "due_today" | "paid" | "overdue" | "trial" | "cancelled";

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  upcoming: "Próximo",
  due_today: "Vence hoy",
  paid: "Pagado",
  overdue: "Atrasado",
  trial: "Prueba gratuita",
  cancelled: "Cancelado",
};

export type Source = "manual" | "gmail";

export type Usage = "high" | "medium" | "low";
export const USAGE_LABEL: Record<Usage, string> = { high: "Lo uso mucho", medium: "A veces", low: "Lo uso poco" };

export type Service = {
  id: string;
  name: string;
  description?: string;
  category: CategoryId;
  amountMinor: number;
  currency: string;
  frequency: Frequency;
  customInterval?: CustomInterval;
  /** Day of month the cycle is anchored to (handles month-end). */
  anchorDay?: number;
  nextDue: string | null;
  lastPaid?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
  cancelled: boolean;
  cancelledAt?: string | null;
  reminders: boolean;
  source: Source;
  sourceRef?: string | null;
  notes?: string;
  /** Uso declarado por el usuario (nunca inferido). */
  usage?: Usage | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  serviceId: string;
  serviceName: string;
  category: CategoryId;
  dueDate: string | null;
  paidDate: string;
  amountMinor: number;
  currency: string;
  /** "manual" = user confirmed; "gmail_receipt" = user confirmed a detected receipt. */
  evidence: "manual" | "gmail_receipt";
  createdAt: string;
};

export type SuggestionKind = "subscription" | "invoice" | "receipt" | "trial" | "renewal";

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  name: string;
  category: CategoryId;
  amountMinor: number | null;
  currency: string | null;
  frequency: Frequency;
  nextDue: string | null;
  trialEnd: string | null;
  lastSeen: string;
  sourceRef: string;
  messageIds: string[];
  reason: string;
  confidence: number;
  possibleDuplicateOf?: string | null;
  createdAt: string;
};

export type ExchangeRate = {
  id: string;
  from: string;
  to: string;
  /** 1 unit of `from` = rate units of `to`. */
  rate: number;
  updatedAt: string;
};

export type NotificationPrefs = {
  d7: boolean;
  d3: boolean;
  d1: boolean;
  d0: boolean;
  overdue: boolean;
  trialEnd: boolean;
};

export type Settings = {
  mainCurrency: string;
  currencies: string[];
  notifications: NotificationPrefs;
};

export type GmailMeta = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: "idle" | "ok" | "error" | "reauth";
  lastError: string | null;
  lastNewCount: number;
  initialScanDone: boolean;
  processedIds: string[];
};

export type AppState = {
  schemaVersion: number;
  services: Service[];
  payments: Payment[];
  suggestions: Suggestion[];
  dismissedRefs: string[];
  rates: ExchangeRate[];
  settings: Settings;
  gmail: GmailMeta;
};

export const BASE_CURRENCIES = ["ARS", "USD", "EUR", "BRL"];

export function categoryOf(id: CategoryId) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
export function frequencyLabel(s: Pick<Service, "frequency" | "customInterval">) {
  if (s.frequency === "custom" && s.customInterval) {
    const u = { day: ["día", "días"], week: ["semana", "semanas"], month: ["mes", "meses"], year: ["año", "años"] }[
      s.customInterval.unit
    ];
    return `Cada ${s.customInterval.count} ${s.customInterval.count === 1 ? u[0] : u[1]}`;
  }
  return FREQUENCIES.find((f) => f.id === s.frequency)?.label ?? "";
}
