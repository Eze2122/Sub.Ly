// Gmail API client (read-only) + sync orchestrator. Message content is processed
// in memory on the device and discarded; only extracted fields are persisted.
import { commit, getState, loadState } from "@/src/data/store.ts";
import { todayISO } from "@/src/domain/dates.ts";
import { AUTO_CREATE_CONFIDENCE, dateFromHeader, detect, groupDetections, type Detection, type MailFacts } from "@/src/domain/gmailParser.ts";
import { createService, findDuplicate, suggestionToInput, uid } from "@/src/domain/operations.ts";
import type { AppState, Suggestion } from "@/src/domain/types.ts";

import { getAccessToken, ReauthRequired } from "./oauth.ts";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const INITIAL_MAX = 400;
const INCREMENTAL_MAX = 150;
const KEYWORDS =
  '(factura OR recibo OR comprobante OR suscripción OR suscripcion OR subscription OR renovación OR renewal OR receipt OR invoice OR "prueba gratuita" OR "free trial" OR "tu pago" OR "your payment" OR vencimiento OR membresía OR membership)';

async function gmailGet(path: string): Promise<any> {
  let token = await getAccessToken();
  let r = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) {
    token = await getAccessToken(true);
    r = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (r.status === 401 || r.status === 403) throw new ReauthRequired();
  if (r.status === 429) throw new Error("Gmail limitó temporalmente las solicitudes. Probá más tarde.");
  if (!r.ok) throw new Error(`Gmail respondió con un error (${r.status}).`);
  return r.json();
}

export async function fetchProfileEmail(): Promise<string | null> {
  const p = await gmailGet("profile");
  return p?.emailAddress ?? null;
}

function b64urlDecode(data: string) {
  const s = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = globalThis.atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return bin;
  }
}

function extractText(part: any, depth = 0): string {
  if (!part || depth > 6) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return b64urlDecode(part.body.data);
  for (const p of part.parts ?? []) {
    const t = extractText(p, depth + 1);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return b64urlDecode(part.body.data).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  }
  return "";
}

async function listIds(query: string, max: number) {
  const ids: string[] = [];
  let pageToken = "";
  while (ids.length < max) {
    const q = encodeURIComponent(query);
    const res = await gmailGet(`messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`);
    for (const m of res.messages ?? []) ids.push(m.id);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return ids.slice(0, max);
}

async function readFacts(id: string): Promise<MailFacts> {
  const m = await gmailGet(`messages/${encodeURIComponent(id)}?format=full`);
  const h: Record<string, string> = {};
  for (const x of m.payload?.headers ?? []) h[String(x.name).toLowerCase()] = x.value;
  const body = extractText(m.payload).slice(0, 6000);
  return {
    id: m.id,
    from: h.from ?? "",
    subject: h.subject ?? "",
    date: dateFromHeader(h.date ?? "", Number(m.internalDate)),
    text: `${m.snippet ?? ""}\n${body}`,
  };
}

/** Applies grouped detections to state: auto-create confident ones, otherwise suggest. */
export function applyDetections(state: AppState, dets: Detection[], nowIso: string, today: string) {
  let s = state;
  let created = 0;
  let suggested = 0;
  for (const g of groupDetections(dets, today)) {
    const ref = `gmail:${g.senderKey}`;
    if (s.dismissedRefs.includes(`${ref}|${g.kind}`)) continue;
    const existing = findDuplicate(s, g.name, ref);
    const sg: Suggestion = {
      id: uid("sug"),
      kind: g.kind,
      name: g.name,
      category: g.category,
      amountMinor: g.amountMinor,
      currency: g.currency,
      frequency: g.frequency,
      nextDue: g.nextDue,
      trialEnd: g.trialEnd,
      lastSeen: g.lastSeen,
      sourceRef: ref,
      messageIds: g.messageIds.slice(-10),
      reason: g.reason,
      confidence: g.confidence,
      possibleDuplicateOf: existing?.id ?? null,
      createdAt: nowIso,
    };
    if (existing?.sourceRef === ref) {
      // Same Gmail source already tracked: only surface relevant changes (amount / trial).
      const changed = (g.amountMinor && g.amountMinor !== existing.amountMinor && g.currency === existing.currency) || (g.trialEnd && g.trialEnd !== existing.trialEnd);
      if (!changed) continue;
      sg.reason = `Cambio detectado en ${existing.name}: ${sg.reason}`;
    } else if (!existing && g.confidence >= AUTO_CREATE_CONFIDENCE && g.amountMinor && g.currency && g.nextDue) {
      s = createService(s, suggestionToInput(sg, today), nowIso, today).state;
      created++;
      continue;
    }
    s = { ...s, suggestions: [...s.suggestions.filter((x) => x.sourceRef !== ref), sg] };
    suggested++;
  }
  return { state: s, created, suggested };
}

let running: Promise<SyncResult> | null = null;
export type SyncResult = { ok: boolean; created: number; suggested: number; scanned: number; error?: string; reauth?: boolean };

export function runSync(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncResult> {
  await loadState();
  const st = getState();
  if (!st.gmail.connected) return { ok: false, created: 0, suggested: 0, scanned: 0, error: "Gmail no está conectado." };
  const initial = !st.gmail.initialScanDone;
  try {
    const after = st.gmail.lastSyncAt && !initial ? Math.floor(new Date(st.gmail.lastSyncAt).getTime() / 1000) - 86400 * 2 : null;
    const q = `${KEYWORDS} ${after ? `after:${after}` : "newer_than:12m"} -in:chats`;
    const processed = new Set(st.gmail.processedIds);
    const ids = (await listIds(q, initial ? INITIAL_MAX : INCREMENTAL_MAX)).filter((id) => !processed.has(id));
    const dets: Detection[] = [];
    for (const id of ids) {
      try {
        const d = detect(await readFacts(id));
        if (d) dets.push(d);
      } catch (e) {
        if (e instanceof ReauthRequired) throw e;
      }
    }
    // Include previous detections' context: re-scan gives recurrence only within this batch,
    // so for incremental runs merge with known Gmail-sourced services via sourceRef dedupe.
    const nowIso = new Date().toISOString();
    const today = todayISO();
    let result = { created: 0, suggested: 0 };
    await commit((s) => {
      const r = applyDetections(s, dets, nowIso, today);
      result = r;
      return {
        ...r.state,
        gmail: {
          ...r.state.gmail,
          lastSyncAt: nowIso,
          lastSyncStatus: "ok",
          lastError: null,
          lastNewCount: r.created + r.suggested,
          initialScanDone: true,
          processedIds: [...r.state.gmail.processedIds, ...ids].slice(-5000),
        },
      };
    });
    return { ok: true, ...result, scanned: ids.length };
  } catch (e) {
    const reauth = e instanceof ReauthRequired;
    const msg = reauth ? "Necesitás volver a autorizar el acceso a Gmail." : e instanceof Error ? e.message : "Error desconocido.";
    await commit((s) => ({ ...s, gmail: { ...s.gmail, lastSyncStatus: reauth ? "reauth" : "error", lastError: msg } }));
    return { ok: false, created: 0, suggested: 0, scanned: 0, error: msg, reauth };
  }
}
