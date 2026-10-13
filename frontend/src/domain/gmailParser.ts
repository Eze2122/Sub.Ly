// On-device Gmail heuristics. Input: minimal message facts (sender, subject, date, text).
// Output: detections. Message bodies are never persisted; only extracted fields are kept.
import { addDays, addMonths, diffDays, toISO } from "./dates.ts";
import type { CategoryId, Frequency, SuggestionKind } from "./types.ts";

export type MailFacts = {
  id: string;
  from: string;
  subject: string;
  date: string; // ISO date YYYY-MM-DD
  text: string; // subject + snippet + plain text (in memory only)
};

export type Detection = {
  messageId: string;
  senderKey: string;
  name: string;
  kind: SuggestionKind;
  amountMinor: number | null;
  currency: string | null;
  date: string;
  trialEnd: string | null;
  renewDate: string | null;
};

const KW = {
  trial: /(prueba gratuita|per[ií]odo de prueba|free trial|trial (ends|period|will end)|tu prueba (termina|finaliza|vence))/i,
  receipt: /(recibimos tu pago|pago (recibido|aprobado|acreditado|confirmado|exitoso)|gracias por tu pago|payment (received|confirmed|successful)|comprobante de pago|receipt|recibo de pago|we('ve| have) charged|se (acredit|debit)[oó])/i,
  renewal: /(se renovar[aá]|renovaci[oó]n autom[aá]tica|pr[oó]xima renovaci[oó]n|will (auto-?)?renew|renews on|renewal (date|notice)|tu suscripci[oó]n se renueva)/i,
  invoice: /(factura|invoice|tu resumen|vencimiento|fecha de vencimiento|due date|monto a pagar|amount due)/i,
  subscription: /(suscripci[oó]n|subscription|membres[ií]a|membership|plan (mensual|anual|premium)|monthly plan|annual plan)/i,
  noise: /(newsletter|oferta|promo(ci[oó]n)?|descuento|sale|% off|webinar|unsubscribe from marketing)/i,
};

const CUR: [RegExp, string][] = [
  [/(?:US\$|U\$S|USD)\s?([\d.,]+)/i, "USD"],
  [/([\d.,]+)\s?(?:USD|US\$)/i, "USD"],
  [/R\$\s?([\d.,]+)/i, "BRL"],
  [/(?:BRL)\s?([\d.,]+)/i, "BRL"],
  [/€\s?([\d.,]+)/, "EUR"],
  [/([\d.,]+)\s?(?:€|EUR)/i, "EUR"],
  [/(?:EUR)\s?([\d.,]+)/i, "EUR"],
  [/(?:ARS)\s?\$?\s?([\d.,]+)/i, "ARS"],
  [/([\d.,]+)\s?ARS/i, "ARS"],
  [/(?:^|[^A-Z$])\$\s?([\d.,]+)/, "ARS"],
];

function parseNum(s: string): number | null {
  let t = s.replace(/[.,]$/, "");
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    t = t.split(dec === "." ? "," : ".").join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastDot >= 0 && /\.\d{3}$/.test(t) && !/\.\d{1,2}$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 100000000 ? Math.round(n * 100) : null;
}

export function extractAmount(text: string): { amountMinor: number; currency: string } | null {
  for (const [re, cur] of CUR) {
    const m = text.match(re);
    if (m) {
      const v = parseNum(m[1]);
      if (v) return { amountMinor: v, currency: cur };
    }
  }
  return null;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12,
};

/** Finds a date mentioned near renewal/trial wording (dd/mm/yyyy or "15 de marzo de 2026"). */
export function extractFutureDate(text: string, ref: string): string | null {
  const m1 = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m1) {
    const y = Number(m1[3].length === 2 ? `20${m1[3]}` : m1[3]);
    const iso = `${y}-${String(Number(m1[2])).padStart(2, "0")}-${String(Number(m1[1])).padStart(2, "0")}`;
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso) && iso >= ref) return iso;
  }
  const m2 = text.toLowerCase().match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?(?:\s+(?:de\s+)?(\d{4}))?/);
  if (m2 && MONTHS[m2[2]]) {
    const refY = Number(ref.slice(0, 4));
    let y = m2[3] ? Number(m2[3]) : refY;
    let iso = `${y}-${String(MONTHS[m2[2]]).padStart(2, "0")}-${String(Number(m2[1])).padStart(2, "0")}`;
    if (!m2[3] && iso < ref) {
      y += 1;
      iso = `${y}-${iso.slice(5)}`;
    }
    if (iso >= ref && /^\d{4}-\d{2}-(0[1-9]|[12]\d|3[01])$/.test(iso)) return iso;
  }
  return null;
}

export function senderInfo(from: string): { key: string; name: string } {
  const email = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const domain = email.split("@")[1] ?? email;
  const parts = domain.split(".").filter((p) => !["com", "net", "org", "ar", "br", "io", "co", "mail", "email", "mailer", "info", "news", "noreply", "no-reply", "accounts", "billing", "e", "em"].includes(p));
  const base = parts[parts.length - 1] ?? domain;
  let display = from.replace(/<[^>]+>/, "").replace(/"/g, "").trim();
  if (!display || display.includes("@") || display.length > 30) display = base.charAt(0).toUpperCase() + base.slice(1);
  display = display.replace(/\b(no-?reply|facturaci[oó]n|billing|team|equipo)\b/gi, "").trim() || base;
  return { key: base, name: display };
}

export function classify(m: MailFacts): SuggestionKind | null {
  const t = `${m.subject}\n${m.text}`;
  if (KW.noise.test(m.subject) && !KW.receipt.test(t) && !KW.renewal.test(t)) return null;
  if (KW.trial.test(t)) return "trial";
  if (KW.receipt.test(t)) return "receipt";
  if (KW.renewal.test(t)) return "renewal";
  if (KW.invoice.test(t)) return "invoice";
  if (KW.subscription.test(t)) return "subscription";
  return null;
}

export function detect(m: MailFacts): Detection | null {
  const kind = classify(m);
  if (!kind) return null;
  const t = `${m.subject}\n${m.text}`;
  const amt = extractAmount(t);
  const s = senderInfo(m.from);
  const future = kind === "trial" || kind === "renewal" || kind === "invoice" ? extractFutureDate(t, m.date) : null;
  return {
    messageId: m.id,
    senderKey: s.key,
    name: s.name,
    kind,
    amountMinor: amt?.amountMinor ?? null,
    currency: amt?.currency ?? null,
    date: m.date,
    trialEnd: kind === "trial" ? future : null,
    renewDate: kind !== "trial" ? future : null,
  };
}

/** Infers frequency from dates of charges from the same sender. */
export function inferFrequency(dates: string[]): Frequency | null {
  const ds = Array.from(new Set(dates)).sort();
  if (ds.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < ds.length; i++) gaps.push(diffDays(ds[i], ds[i - 1]));
  const med = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  if (med >= 6 && med <= 8) return "weekly";
  if (med >= 26 && med <= 35) return "monthly";
  if (med >= 85 && med <= 95) return "quarterly";
  if (med >= 355 && med <= 375) return "annual";
  return null;
}

const CATEGORY_HINTS: [RegExp, CategoryId][] = [
  [/netflix|spotify|disney|hbo|max|prime|youtube|paramount|star|crunchyroll|deezer|twitch|apple ?tv|flow/i, "streaming"],
  [/google|apple|microsoft|adobe|dropbox|notion|github|openai|canva|icloud|figma|slack|zoom|1password/i, "software"],
  [/personal|movistar|claro|telecentro|fibertel|telecom|iplan|tuenti|vodafone|internet/i, "telecom"],
  [/edesur|edenor|metrogas|naturgy|aysa|camuzzi|epec|gas|luz|agua/i, "utilities"],
  [/osde|swiss|galeno|seguro|insurance|sancor|medicus|omint|allianz|zurich|rus/i, "insurance"],
  [/megatlon|smartfit|gym|gimnasio|sportclub|club/i, "gym"],
  [/pr[eé]stamo|cuota|loan|mercadopago cr[eé]dito/i, "loans"],
  [/alquiler|expensas|rent|consorcio/i, "home"],
];
export function guessCategory(name: string, key: string): CategoryId {
  for (const [re, c] of CATEGORY_HINTS) if (re.test(name) || re.test(key)) return c;
  return "other";
}

export type Grouped = {
  senderKey: string;
  name: string;
  category: CategoryId;
  kind: SuggestionKind;
  frequency: Frequency;
  amountMinor: number | null;
  currency: string | null;
  lastSeen: string;
  nextDue: string | null;
  trialEnd: string | null;
  messageIds: string[];
  confidence: number;
  reason: string;
};

/** Groups detections per sender and decides confidence. Invoices are never treated as paid. */
export function groupDetections(dets: Detection[], today: string): Grouped[] {
  const by: Record<string, Detection[]> = {};
  for (const d of dets) (by[d.senderKey] = by[d.senderKey] ?? []).push(d);
  const out: Grouped[] = [];
  for (const [key, list] of Object.entries(by)) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const trial = [...list].reverse().find((d) => d.kind === "trial" && d.trialEnd && d.trialEnd >= today);
    const charges = list.filter((d) => d.kind === "receipt" || d.kind === "renewal" || d.kind === "invoice" || d.kind === "subscription");
    const withAmt = charges.filter((d) => d.amountMinor);
    const freq = inferFrequency(charges.map((d) => d.date));
    const lastAmt = withAmt[withAmt.length - 1];
    const sameCurrency = withAmt.every((d) => d.currency === lastAmt?.currency);
    const amountChanged = withAmt.length >= 2 && withAmt[withAmt.length - 2].amountMinor !== lastAmt?.amountMinor;
    const renewal = [...list].reverse().find((d) => d.renewDate && d.renewDate >= today)?.renewDate ?? null;
    let nextDue: string | null = renewal;
    if (!nextDue && freq && lastAmt) {
      const lastCharge = charges[charges.length - 1].date;
      let cur = lastCharge;
      for (let i = 0; i < 60 && cur < today; i++) {
        cur = freq === "weekly" ? addDays(cur, 7) : addMonths(cur, freq === "monthly" ? 1 : freq === "quarterly" ? 3 : 12);
      }
      nextDue = cur;
    }
    let confidence = 0.3;
    const reasons: string[] = [];
    if (freq) { confidence += 0.35; reasons.push(`${charges.length} cargos con patrón ${freq === "monthly" ? "mensual" : freq === "annual" ? "anual" : freq === "weekly" ? "semanal" : "trimestral"}`); }
    if (lastAmt && sameCurrency) { confidence += 0.2; reasons.push("importe identificado"); }
    if (list.some((d) => d.kind === "renewal" || d.kind === "subscription")) { confidence += 0.15; reasons.push("menciona suscripción o renovación"); }
    if (amountChanged) reasons.push("el importe cambió en el último cargo");
    if (trial) { reasons.push(`prueba gratuita hasta ${trial.trialEnd}`); confidence = Math.max(confidence, 0.6); }
    if (!lastAmt && !trial) confidence = Math.min(confidence, 0.5);
    if (charges.length === 0 && !trial) continue;
    out.push({
      senderKey: key,
      name: last.name,
      category: guessCategory(last.name, key),
      kind: trial ? "trial" : freq ? "subscription" : last.kind,
      frequency: freq ?? (charges.length === 1 && last.kind === "invoice" ? "once" : "monthly"),
      amountMinor: lastAmt?.amountMinor ?? null,
      currency: lastAmt?.currency ?? null,
      lastSeen: last.date,
      nextDue,
      trialEnd: trial?.trialEnd ?? null,
      messageIds: list.map((d) => d.messageId),
      confidence: Math.min(1, Number(confidence.toFixed(2))),
      reason: reasons.join(" · ") || "correo con datos de pago",
    });
  }
  return out;
}

export function dateFromHeader(h: string, fallbackMs?: number) {
  const t = Date.parse(h);
  return toISO(new Date(Number.isFinite(t) ? t : fallbackMs ?? Date.now()));
}

export const AUTO_CREATE_CONFIDENCE = 0.8;
