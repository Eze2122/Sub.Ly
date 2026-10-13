// Google OAuth 2.0 (Authorization Code + PKCE) for Gmail read-only access.
// Public Android client ID only (no client secret in the app). Tokens live in
// secure storage (Android Keystore-backed EncryptedSharedPreferences).
import Constants from "expo-constants";
import { exchangeCodeAsync, makeRedirectUri, refreshAsync, revokeAsync, useAuthRequest, ResponseType } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
const TOKEN_KEY = "subly.gmail.tokens";

export const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export type OAuthAvailability =
  | { ok: true }
  | { ok: false; reason: "pending_config" | "platform" ; message: string };

export function oauthAvailability(): OAuthAvailability {
  if (Platform.OS !== "android") return { ok: false, reason: "platform", message: "La conexión con Gmail está disponible en la app de Android." };
  if (!ANDROID_CLIENT_ID) return { ok: false, reason: "pending_config", message: "Configuración pendiente: falta el Client ID de Android de Google OAuth (EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)." };
  return { ok: true };
}

/** Redirect for Google "Android" OAuth clients: <applicationId>:/oauth2redirect */
export function redirectUri() {
  const pkg = Constants.expoConfig?.android?.package ?? "";
  return makeRedirectUri({ native: `${pkg}:/oauth2redirect` });
}

type Tokens = { accessToken: string; refreshToken: string | null; expiresAt: number };

export function useGmailAuthRequest() {
  return useAuthRequest(
    {
      clientId: ANDROID_CLIENT_ID || "unconfigured",
      responseType: ResponseType.Code,
      redirectUri: redirectUri(),
      scopes: [GMAIL_SCOPE, "email"],
      usePKCE: true,
      extraParams: { access_type: "offline", prompt: "consent" },
    },
    discovery,
  );
}

export async function exchangeCode(code: string, codeVerifier: string) {
  const res = await exchangeCodeAsync(
    { clientId: ANDROID_CLIENT_ID, code, redirectUri: redirectUri(), extraParams: { code_verifier: codeVerifier } },
    discovery,
  );
  const old = await loadTokens();
  const t: Tokens = {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken ?? old?.refreshToken ?? null,
    expiresAt: Date.now() + (res.expiresIn ?? 3600) * 1000,
  };
  await storage.secureSet(TOKEN_KEY, JSON.stringify(t));
  return t;
}

export async function loadTokens(): Promise<Tokens | null> {
  const raw = await storage.secureGet(TOKEN_KEY, null as string | null);
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export class ReauthRequired extends Error {
  constructor() {
    super("REAUTH_REQUIRED");
  }
}

export async function getAccessToken(force = false): Promise<string> {
  const t = await loadTokens();
  if (!t) throw new ReauthRequired();
  if (!force && t.expiresAt > Date.now() + 60000) return t.accessToken;
  if (!t.refreshToken) throw new ReauthRequired();
  try {
    const r = await refreshAsync({ clientId: ANDROID_CLIENT_ID, refreshToken: t.refreshToken }, discovery);
    const next: Tokens = { accessToken: r.accessToken, refreshToken: r.refreshToken ?? t.refreshToken, expiresAt: Date.now() + (r.expiresIn ?? 3600) * 1000 };
    await storage.secureSet(TOKEN_KEY, JSON.stringify(next));
    return next.accessToken;
  } catch {
    throw new ReauthRequired();
  }
}

/** Revokes the grant at Google (best effort) and always deletes local tokens. */
export async function revokeAndClear() {
  const t = await loadTokens();
  try {
    if (t) await revokeAsync({ token: t.refreshToken ?? t.accessToken }, discovery);
  } finally {
    await storage.secureRemove(TOKEN_KEY);
  }
}
