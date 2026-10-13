// UI-facing actions: wrap pure transitions with persistence + premium guard.
import { useRouter } from "expo-router";
import { useCallback } from "react";

import { getEntitlement } from "@/src/billing/entitlement.ts";
import { useToast } from "@/src/components/Toast";
import { todayISO } from "@/src/domain/dates.ts";

import { commit } from "./store.ts";
import type { AppState } from "@/src/domain/types.ts";

export const now = () => new Date().toISOString();
export const today = () => todayISO();

export function canEditNow() {
  const e = getEntitlement();
  return e.premium || e.devUnlocked;
}

/** Runs a premium mutation; when not allowed, explains and opens the paywall. */
export function usePremiumAction() {
  const router = useRouter();
  const toast = useToast();
  return useCallback(
    async (fn: (s: AppState) => AppState, success?: string) => {
      if (!canEditNow()) {
        toast("Esta acción requiere Subly Premium.", "info");
        router.push("/premium");
        return false;
      }
      const ok = await commit(fn);
      if (!ok) toast("No se pudo guardar. Revisá el espacio disponible e intentá de nuevo.", "error");
      else if (success) toast(success);
      return ok;
    },
    [router, toast],
  );
}

export function useGuard() {
  const router = useRouter();
  const toast = useToast();
  return useCallback(
    (fn: () => void) => {
      if (!canEditNow()) {
        toast("Esta acción requiere Subly Premium.", "info");
        router.push("/premium");
        return;
      }
      fn();
    },
    [router, toast],
  );
}
