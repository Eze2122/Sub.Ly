// Premium entitlement. Source of truth: backend verification against the Google Play
// Developer API. The device caches only the last *verified* result; local flags alone
// never grant access. Without a verified active subscription, records remain readable
// and exportable.
import * as Crypto from "expo-crypto";
import { useSyncExternalStore } from "react";

import { storage } from "@/src/utils/storage";

import { finish, iapAvailable, ownedPurchases } from "./iap";

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const CACHE_KEY = "subly.entitlement";
const TOKEN_KEY = "subly.purchaseToken";
const INSTALL_KEY = "subly.installId";

export type PlayState = "active" | "trial" | "grace" | "on_hold" | "paused" | "canceled_active" | "expired" | "none";

export type BillingConfig = { configured: boolean; productId: string | null; packageName: string | null; missing: string[] };

export type Entitlement = {
  premium: boolean;
  state: PlayState;
  expiryTime: string | null;
  verifiedAt: string | null;
  autoRenewing: boolean | null;
  /** UI-only: build is in development mode and billing is not configured yet. */
  devUnlocked: boolean;
  check: "idle" | "checking" | "ok" | "offline" | "not_configured" | "unavailable" | "error";
  message: string | null;
  config: BillingConfig | null;
};

const initial: Entitlement = {
  premium: false, state: "none", expiryTime: null, verifiedAt: null, autoRenewing: null,
  devUnlocked: false, check: "idle", message: null, config: null,
};
let ent: Entitlement = initial;
const listeners = new Set<() => void>();
function set(p: Partial<Entitlement>) {
  ent = { ...ent, ...p };
  listeners.forEach((l) => l());
}

export function premiumFromVerified(state: PlayState, expiryTime: string | null, now = Date.now()) {
  const okState = state === "active" || state === "trial" || state === "grace" || state === "canceled_active";
  return okState && !!expiryTime && new Date(expiryTime).getTime() > now;
}

type Cached = { state: PlayState; expiryTime: string | null; verifiedAt: string; autoRenewing: boolean | null };

export async function getCachedEntitlement(): Promise<{ premium: boolean; cached: Cached | null }> {
  const raw = await storage.secureGet(CACHE_KEY, null as string | null);
  if (!raw) return { premium: false, cached: null };
  try {
    const c: Cached = JSON.parse(String(raw));
    return { premium: premiumFromVerified(c.state, c.expiryTime), cached: c };
  } catch {
    return { premium: false, cached: null };
  }
}

export async function installId() {
  let id = await storage.getItem(INSTALL_KEY, null as string | null);
  if (!id) {
    id = Crypto.randomUUID();
    await storage.setItem(INSTALL_KEY, id);
  }
  return String(id);
}
export async function obfuscatedAccountId() {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `subly:${await installId()}`);
}

async function fetchConfig(): Promise<BillingConfig> {
  const r = await fetch(`${API}/billing/config`);
  if (!r.ok) throw new Error("config");
  return r.json();
}

export async function verifyWithBackend(purchaseToken: string, productId: string) {
  const r = await fetch(`${API}/billing/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaseToken, productId, installHash: await obfuscatedAccountId() }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 503) return { kind: "not_configured" as const };
  if (!r.ok) return { kind: "rejected" as const, message: (data?.detail as string) ?? "Compra no válida." };
  return { kind: "ok" as const, data: data as { entitled: boolean; state: PlayState; expiryTime: string | null; autoRenewing: boolean | null } };
}

async function storeVerified(d: { state: PlayState; expiryTime: string | null; autoRenewing: boolean | null }, token: string | null) {
  const c: Cached = { ...d, verifiedAt: new Date().toISOString() };
  await storage.secureSet(CACHE_KEY, JSON.stringify(c));
  if (token) await storage.secureSet(TOKEN_KEY, token);
  set({ premium: premiumFromVerified(d.state, d.expiryTime), state: d.state, expiryTime: d.expiryTime, verifiedAt: c.verifiedAt, autoRenewing: d.autoRenewing });
}

/** Handles a purchase result from Google Play: verify server-side, then acknowledge. */
export async function handlePurchase(purchaseToken: string, productId: string, raw: any) {
  const v = await verifyWithBackend(purchaseToken, productId);
  if (v.kind === "ok") {
    await storeVerified(v.data, purchaseToken);
    if (v.data.entitled) await finish(raw);
    set({ check: "ok", message: v.data.entitled ? null : "Google Play no reporta una suscripción activa." });
    return v.data.entitled;
  }
  set({ check: v.kind === "not_configured" ? "not_configured" : "error", message: v.kind === "rejected" ? v.message : "La validación de compras no está configurada en el servidor." });
  return false;
}

/** Re-checks entitlement: loads cache, reads config, restores owned purchases and verifies. */
export async function refreshEntitlement(opts: { restore?: boolean } = {}) {
  set({ check: "checking" });
  const { cached } = await getCachedEntitlement();
  if (cached) set({ premium: premiumFromVerified(cached.state, cached.expiryTime), state: cached.state, expiryTime: cached.expiryTime, verifiedAt: cached.verifiedAt, autoRenewing: cached.autoRenewing });
  let config: BillingConfig;
  try {
    config = await fetchConfig();
  } catch {
    set({ check: "offline", message: "No se pudo verificar la suscripción (sin conexión). Se mantiene el último estado verificado." });
    return;
  }
  const devUnlocked = !config.configured && __DEV__;
  set({ config, devUnlocked });
  if (!config.configured || !config.productId) {
    set({ check: "not_configured", message: "Google Play Billing está pendiente de configuración." });
    return;
  }
  if (!iapAvailable()) {
    set({ check: "unavailable", message: "Las compras requieren la app instalada desde Google Play (no disponible en esta vista previa)." });
    return;
  }
  try {
    const owned = await ownedPurchases(config.productId);
    const stored = await storage.secureGet(TOKEN_KEY, null as string | null);
    const tokens = Array.from(new Set([...owned.map((o) => o.purchaseToken), ...(stored ? [String(stored)] : [])]));
    if (tokens.length === 0) {
      await storeVerified({ state: "none", expiryTime: null, autoRenewing: null }, null);
      set({ check: "ok", message: opts.restore ? "No encontramos compras de Subly en esta cuenta de Google Play." : null });
      return;
    }
    for (const t of tokens) {
      const raw = owned.find((o) => o.purchaseToken === t)?.raw;
      const v = await verifyWithBackend(t, config.productId);
      if (v.kind === "ok") {
        await storeVerified(v.data, t);
        if (v.data.entitled && raw) await finish(raw);
        if (v.data.entitled) break;
      }
    }
    set({ check: "ok", message: null });
  } catch {
    set({ check: "error", message: "No se pudo comprobar la suscripción. Reintentá más tarde." });
  }
}

export function getEntitlement() {
  return ent;
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useEntitlement() {
  return useSyncExternalStore(subscribe, getEntitlement, getEntitlement);
}
/** Whether premium actions (create/edit/manage, Gmail sync) are allowed. */
export function useCanEdit() {
  const e = useEntitlement();
  return e.premium || e.devUnlocked;
}
