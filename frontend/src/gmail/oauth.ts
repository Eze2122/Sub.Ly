// Gmail read-only authorization on Android via Google Identity Services
// AuthorizationClient (local module `modules/subly-google-auth`).
// Only scope: gmail.readonly. No client ID or secret in the app: Google matches the
// Android OAuth client by package (com.eze2122.subly) + signing SHA-1.
// Access tokens are short-lived and kept only in memory; Google Play services
// renews them silently. Nothing is persisted except removal of legacy tokens.
import { Platform } from "react-native";

import { SublyGoogleAuth } from "@/modules/subly-google-auth";
import { storage } from "@/src/utils/storage";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const LEGACY_TOKEN_KEY = "subly.gmail.tokens";
const TOKEN_TTL_MS = 45 * 60 * 1000;

export type OAuthAvailability = { ok: true } | { ok: false; reason: "platform" | "native_missing"; message: string };

export function oauthAvailability(): OAuthAvailability {
  if (Platform.OS !== "android") return { ok: false, reason: "platform", message: "La conexión con Gmail está disponible en la app de Android." };
  if (!SublyGoogleAuth) return { ok: false, reason: "native_missing", message: "Requiere la app instalada desde una compilación Android de Sub.Ly (no disponible en Expo Go)." };
  return { ok: true };
}

export class ReauthRequired extends Error {
  constructor() {
    super("REAUTH_REQUIRED");
  }
}
export class OAuthError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function oauthErrorMessage(e: unknown) {
  const code = e instanceof OAuthError ? e.code : "AUTH_FAILED";
  switch (code) {
    case "CANCELED":
      return "Cancelaste la autorización. Podés seguir usando Sub.Ly manualmente.";
    case "SCOPE_DENIED":
      return "No otorgaste el permiso de lectura de Gmail. Sub.Ly sigue funcionando en modo manual.";
    case "DEVELOPER_ERROR":
      return "Configuración pendiente en Google Cloud: falta el cliente OAuth Android (paquete com.eze2122.subly + SHA-1 de la firma), la Gmail API o tu cuenta como usuario de prueba.";
    case "NETWORK_ERROR":
      return "Sin conexión con Google. Revisá internet e intentá de nuevo.";
    default:
      return "No se pudo completar la autorización con Google. Intentá nuevamente.";
  }
}

let cache: { token: string; exp: number } | null = null;

async function callNative(interactive: boolean) {
  if (!SublyGoogleAuth) throw new ReauthRequired();
  try {
    return await SublyGoogleAuth.authorize(interactive);
  } catch (e: any) {
    if (e?.code === "INTERACTION_REQUIRED") throw new ReauthRequired();
    throw new OAuthError(String(e?.code ?? "AUTH_FAILED"));
  }
}

/** Shows Google's account/consent UI when needed. Throws OAuthError on failure. */
export async function authorizeInteractive() {
  const r = await callNative(true);
  if (!r.accessToken || !r.grantedScopes.includes(GMAIL_SCOPE)) throw new OAuthError("SCOPE_DENIED");
  cache = { token: r.accessToken, exp: Date.now() + TOKEN_TTL_MS };
}

/** Silent token (no UI). `force` evicts the cached token first (after a 401). */
export async function getAccessToken(force = false): Promise<string> {
  if (!force && cache && cache.exp > Date.now()) return cache.token;
  if (cache) {
    const old = cache.token;
    cache = null;
    if (force) await SublyGoogleAuth?.clearToken(old).catch(() => null);
  }
  let r;
  try {
    r = await callNative(false);
  } catch (e) {
    if (e instanceof OAuthError) throw new ReauthRequired();
    throw e;
  }
  if (!r.accessToken || !r.grantedScopes.includes(GMAIL_SCOPE)) throw new ReauthRequired();
  cache = { token: r.accessToken, exp: Date.now() + TOKEN_TTL_MS };
  return r.accessToken;
}

/** Revokes the grant at Google (best effort, revokes the whole app grant) and clears local tokens. */
export async function revokeAndClear() {
  let token = cache?.token ?? null;
  if (!token) token = await callNative(false).then((r) => r.accessToken).catch(() => null);
  try {
    if (token) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `token=${encodeURIComponent(token)}`,
      });
    }
  } finally {
    if (token) await SublyGoogleAuth?.clearToken(token).catch(() => null);
    cache = null;
    await storage.secureRemove(LEGACY_TOKEN_KEY);
  }
}
