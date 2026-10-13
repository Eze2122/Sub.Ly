// Money helpers: integer minor units, per-currency totals, manual conversion.
import { intervalDays, intervalOf } from "./dates.ts";
import type { ExchangeRate, Service } from "./types.ts";

/** Parses "1.234,56", "1234.56", "9,99", "$ 1.500" into minor units. Returns null if invalid. */
export function parseAmount(input: string): number | null {
  let s = (input || "").replace(/[^\d.,-]/g, "");
  if (!s || s === "-" || s.startsWith("-")) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2) s = s.split(",").join("");
    else s = s.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  }
  if ((s.match(/\./g) || []).length > 1) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatMoney(minor: number, currency: string) {
  const v = minor / 100;
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      currencyDisplay: currency === "USD" ? "code" : "symbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2).replace(".", ",")}`;
  }
}
export function formatAmountInput(minor: number) {
  return (minor / 100).toFixed(2).replace(".", ",");
}

/** Monthly-equivalent amount (minor units, float) for a recurring service. */
export function monthlyEquivalent(svc: Pick<Service, "frequency" | "customInterval" | "amountMinor">) {
  const iv = intervalOf(svc.frequency, svc.customInterval);
  if (!iv) return 0;
  return (svc.amountMinor * 30.436875) / intervalDays(iv);
}

export type CurrencyTotals = Record<string, number>;

export function addTo(t: CurrencyTotals, currency: string, minor: number) {
  t[currency] = (t[currency] ?? 0) + minor;
  return t;
}

/** Finds a conversion factor from -> to using a direct rate or its inverse. */
export function findRate(rates: ExchangeRate[], from: string, to: string): { factor: number; rate: ExchangeRate } | null {
  if (from === to) return { factor: 1, rate: { id: "same", from, to, rate: 1, updatedAt: "" } };
  const direct = rates.find((r) => r.from === from && r.to === to && r.rate > 0);
  if (direct) return { factor: direct.rate, rate: direct };
  const inv = rates.find((r) => r.from === to && r.to === from && r.rate > 0);
  if (inv) return { factor: 1 / inv.rate, rate: inv };
  return null;
}

export type Converted = {
  total: number;
  missing: string[];
  usedRates: ExchangeRate[];
};

/** Converts per-currency totals into `target`. Currencies without a rate are listed in `missing`. */
export function convertTotals(totals: CurrencyTotals, target: string, rates: ExchangeRate[]): Converted {
  let total = 0;
  const missing: string[] = [];
  const used: ExchangeRate[] = [];
  for (const [cur, minor] of Object.entries(totals)) {
    if (!minor) continue;
    const r = findRate(rates, cur, target);
    if (!r) {
      missing.push(cur);
      continue;
    }
    if (r.rate.id !== "same") used.push(r.rate);
    total += minor * r.factor;
  }
  return { total: Math.round(total), missing, usedRates: used };
}

export function validateRate(from: string, to: string, value: number): string | null {
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return "Las monedas deben tener 3 letras (ej.: USD).";
  if (from === to) return "Elegí dos monedas distintas.";
  if (!Number.isFinite(value) || value <= 0) return "El valor debe ser mayor que cero.";
  return null;
}
