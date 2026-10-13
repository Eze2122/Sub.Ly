// Persistent local store. The full app state is a versioned JSON document stored
// via the pre-shipped storage util (AsyncStorage/SQLite-backed on Android), written
// atomically in a serialized queue. Schema migrations live in domain/operations.ts.
import { useSyncExternalStore } from "react";

import { emptyState, migrate } from "@/src/domain/operations.ts";
import type { AppState } from "@/src/domain/types.ts";
import { storage } from "@/src/utils/storage";

const KEY = "subly.state";
let state: AppState = emptyState();
let loaded = false;
let loading: Promise<AppState> | null = null;
const listeners = new Set<() => void>();
const afterWrite = new Set<(s: AppState) => void>();
let writeChain: Promise<unknown> = Promise.resolve();
let lastWriteOk = true;

export function loadState(): Promise<AppState> {
  if (loaded) return Promise.resolve(state);
  if (!loading) {
    loading = (async () => {
      const raw = await storage.getItem(KEY, null as string | null);
      try {
        state = raw ? migrate(JSON.parse(String(raw))) : emptyState();
      } catch {
        // Corrupted document: keep a copy so the user can recover it, start clean.
        await storage.setItem(`${KEY}.corrupt.${Date.now()}`, String(raw));
        state = emptyState();
      }
      loaded = true;
      listeners.forEach((l) => l());
      return state;
    })();
  }
  return loading;
}

export function getState() {
  return state;
}
export function isLoaded() {
  return loaded;
}

/** Applies a pure transition and persists it. Returns false if the write failed. */
export async function commit(fn: (s: AppState) => AppState): Promise<boolean> {
  await loadState();
  const prev = state;
  const next = fn(prev);
  if (next === prev) return true;
  state = next;
  listeners.forEach((l) => l());
  const p = writeChain.then(async () => {
    lastWriteOk = await storage.setItem(KEY, JSON.stringify(next));
    if (!lastWriteOk) {
      state = prev;
      listeners.forEach((l) => l());
    } else {
      afterWrite.forEach((cb) => cb(next));
    }
    return lastWriteOk;
  });
  writeChain = p;
  return p;
}

export function onPersisted(cb: (s: AppState) => void) {
  afterWrite.add(cb);
  return () => afterWrite.delete(cb);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}
export function useLoaded(): boolean {
  return useSyncExternalStore(subscribe, isLoaded, isLoaded);
}
