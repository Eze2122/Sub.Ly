import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCanEdit } from "@/src/billing/entitlement.ts";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Button, Card, Divider, Ionicons, Notice, T } from "@/src/components/ui";
import { now, today, usePremiumAction } from "@/src/data/actions.ts";
import { commit, useAppState } from "@/src/data/store.ts";
import { formatDate } from "@/src/domain/dates.ts";
import { formatMoney } from "@/src/domain/money.ts";
import { createService, dismissSuggestion, removeGmailRecords, suggestionToInput } from "@/src/domain/operations.ts";
import { FREQUENCIES } from "@/src/domain/types.ts";
import { disableDailySync, enableDailySync } from "@/src/gmail/background";
import { authorizeInteractive, oauthAvailability, oauthErrorMessage, revokeAndClear } from "@/src/gmail/oauth.ts";
import { fetchProfileEmail, runSync } from "@/src/gmail/sync.ts";
import { spacing, useTheme } from "@/src/theme";

export default function GmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const st = useAppState();
  const canEdit = useCanEdit();
  const run = usePremiumAction();
  const avail = oauthAvailability();
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null);
  const [discOpen, setDiscOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const g = st.gmail;

  const connect = async () => {
    if (!canEdit) return router.push("/premium");
    setOauthError(null);
    setBusy("connect");
    try {
      await authorizeInteractive();
      const email = await fetchProfileEmail();
      await commit((s) => ({ ...s, gmail: { ...s.gmail, connected: true, email, connectedAt: s.gmail.connectedAt ?? now(), lastSyncStatus: "idle", lastError: null } }));
      await enableDailySync();
      toast("Gmail conectado. Analizando los últimos 12 meses…");
      setBusy("sync");
      const r = await runSync();
      toast(r.ok ? `Análisis completo: ${r.created} registros creados, ${r.suggested} sugerencias.` : r.error ?? "Error", r.ok ? "success" : "error");
    } catch (e) {
      setOauthError(oauthErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const sync = async () => {
    if (!canEdit) return router.push("/premium");
    setBusy("sync");
    const r = await runSync();
    setBusy(null);
    toast(r.ok ? `Sincronizado: ${r.created} nuevos, ${r.suggested} sugerencias.` : r.error ?? "Error", r.ok ? "success" : "error");
  };
  const disconnect = async (removeRecords: boolean) => {
    setBusy("disconnect");
    try {
      await revokeAndClear();
    } catch {
      // Local tokens are always deleted; remote revoke may fail offline.
    }
    await disableDailySync();
    await commit((s) => {
      const base = removeRecords ? removeGmailRecords(s) : { ...s, suggestions: [] };
      return { ...base, dismissedRefs: [], gmail: { ...base.gmail, connected: false, email: null, lastSyncStatus: "idle", lastError: null, processedIds: [], initialScanDone: false } };
    });
    setBusy(null);
    setDiscOpen(false);
    toast(removeRecords ? "Gmail desconectado y registros detectados eliminados." : "Gmail desconectado. Se conservaron los registros.");
  };

  const gmailCount = st.services.filter((s) => s.source === "gmail").length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader testID="gmail-header" title="Conexión con Gmail" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Card testID="gmail-status-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: g.connected ? colors.brandTertiary : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={g.connected ? "mail-open-outline" : "mail-outline"} size={22} color={g.connected ? colors.onBrandTertiary : colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3" testID="gmail-status-text">{g.connected ? "Conectado" : !avail.ok && avail.reason === "native_missing" ? "Requiere compilación Android" : "No conectado"}</T>
              <T v="caption">{g.connected ? g.email ?? "Cuenta de Google autorizada" : "Subly funciona igual de forma manual"}</T>
            </View>
          </View>
          {g.connected ? (
            <View style={{ marginTop: spacing.md, gap: 4 }}>
              <T v="caption" testID="gmail-last-sync">Última sincronización: {g.lastSyncAt ? new Date(g.lastSyncAt).toLocaleString("es-AR") : "todavía no"}</T>
              <T v="caption">Estado: {busy === "sync" ? "sincronizando…" : g.lastSyncStatus === "ok" ? `correcta · ${g.lastNewCount} novedades` : g.lastSyncStatus === "error" ? "con errores" : g.lastSyncStatus === "reauth" ? "requiere nueva autorización" : "pendiente"}</T>
              {g.lastError ? <T v="caption" color="errorText" testID="gmail-last-error">{g.lastError}</T> : null}
              <T v="caption">Sincronización automática aproximadamente diaria; Android decide el momento exacto según batería y conexión.</T>
            </View>
          ) : null}
        </Card>

        {!avail.ok ? <Notice testID="gmail-unavailable" tone={avail.reason === "native_missing" ? "warning" : "info"} icon={avail.reason === "native_missing" ? "construct-outline" : "phone-portrait-outline"} title={avail.reason === "native_missing" ? "Disponible en la app instalada" : "Disponible en Android"} body={avail.message} /> : null}
        {oauthError ? <Notice testID="gmail-oauth-error" tone="error" icon="alert-circle-outline" title="Autorización no completada" body={oauthError} /> : null}

        {!g.connected ? (
          <Card>
            <T v="h3">¿Qué analiza Subly?</T>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {[
                ["eye-outline", "Solo lectura (gmail.readonly). Subly no puede enviar, borrar ni modificar correos."],
                ["search-outline", "Busca facturas, recibos, renovaciones y pruebas gratuitas de los últimos 12 meses."],
                ["phone-portrait-outline", "El análisis se hace en tu teléfono. No guardamos tus correos en ningún servidor."],
                ["document-text-outline", "Solo se guardan nombre, importe, moneda, fechas e identificadores para evitar duplicados."],
                ["log-out-outline", "Podés desconectar Gmail cuando quieras."],
              ].map(([i, txt]) => (
                <View key={txt} style={{ flexDirection: "row", gap: spacing.md }}>
                  <Ionicons name={i as any} size={18} color={colors.brandPrimary} />
                  <T v="body" style={{ flex: 1 }}>{txt}</T>
                </View>
              ))}
            </View>
            <Button testID="gmail-connect-button" title="Conectar con Google" icon="logo-google" style={{ marginTop: spacing.lg }} disabled={!avail.ok} loading={busy === "connect"} onPress={connect} />
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {g.lastSyncStatus === "reauth" ? <Button testID="gmail-reauth-button" title="Volver a autorizar" icon="key-outline" disabled={!avail.ok} onPress={connect} /> : null}
            <Button testID="gmail-sync-button" title="Sincronizar ahora" icon="sync-outline" loading={busy === "sync"} onPress={sync} />
            <Button testID="gmail-disconnect-button" kind="secondary" title="Desconectar Gmail" icon="log-out-outline" onPress={() => setDiscOpen(true)} />
          </View>
        )}

        <Card testID="gmail-suggestions">
          <T v="h3">Detecciones para revisar</T>
          <T v="caption" style={{ marginBottom: spacing.sm }}>Casos ambiguos o posibles duplicados. Una factura no se considera pagada.</T>
          {st.suggestions.length === 0 ? <T v="body" color="muted">No hay detecciones pendientes.</T> : st.suggestions.map((sg, i) => (
            <View key={sg.id} testID={`gmail-suggestion-${sg.id}`}>
              {i ? <Divider /> : null}
              <View style={{ paddingVertical: spacing.md, gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                  <T v="bodyStrong" style={{ flex: 1 }}>{sg.name}</T>
                  <T v="bodyStrong">{sg.amountMinor && sg.currency ? formatMoney(sg.amountMinor, sg.currency) : "Importe no detectado"}</T>
                </View>
                <T v="caption">{FREQUENCIES.find((f) => f.id === sg.frequency)?.label} · {sg.nextDue ? `próximo ${formatDate(sg.nextDue)}` : `visto ${formatDate(sg.lastSeen)}`}{sg.trialEnd ? ` · prueba hasta ${formatDate(sg.trialEnd)}` : ""}</T>
                <T v="caption">{sg.reason} · confianza {Math.round(sg.confidence * 100)}%</T>
                {sg.possibleDuplicateOf ? <T v="caption" color="warningText">Posible duplicado de un registro existente</T> : null}
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4 }}>
                  <Button small testID={`gmail-suggestion-accept-${sg.id}`} title="Confirmar" icon="checkmark" disabled={!sg.amountMinor && !sg.trialEnd} onPress={() => run((s) => { const r = createService(s, suggestionToInput(sg, today()), now(), today()); return { ...r.state, suggestions: r.state.suggestions.filter((x) => x.id !== sg.id) }; }, "Registro creado.")} style={{ flex: 1 }} />
                  <Button small kind="secondary" testID={`gmail-suggestion-edit-${sg.id}`} title="Corregir" onPress={() => router.push({ pathname: "/service/form", params: { fromSuggestion: sg.id } })} style={{ flex: 1 }} />
                  <Button small kind="ghost" testID={`gmail-suggestion-dismiss-${sg.id}`} title="Descartar" onPress={() => commit((s) => dismissSuggestion(s, sg.id))} style={{ flex: 1 }} />
                </View>
              </View>
            </View>
          ))}
        </Card>

        <Button testID="gmail-google-permissions" kind="ghost" title="Revisar permisos en tu cuenta de Google" icon="open-outline" onPress={() => Linking.openURL("https://myaccount.google.com/connections")} />
      </ScrollView>

      <Sheet visible={discOpen} onClose={() => setDiscOpen(false)} title="Desconectar Gmail" testID="gmail-disconnect-sheet">
        <T v="body" color="muted">Revocaremos la autorización en Google y borraremos de este dispositivo las credenciales, la cuenta conectada, los identificadores de mensajes analizados y las detecciones pendientes. Los registros creados manualmente no se modifican.</T>
        <Button testID="gmail-disconnect-keep" title={`Desconectar y conservar ${gmailCount} registro(s) detectados`} loading={busy === "disconnect"} onPress={() => disconnect(false)} />
        <Button testID="gmail-disconnect-remove" kind="danger" title="Desconectar y eliminar registros de Gmail" onPress={() => disconnect(true)} />
      </Sheet>
    </View>
  );
}
