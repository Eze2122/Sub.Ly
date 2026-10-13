import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEntitlement } from "@/src/billing/entitlement.ts";
import { Donut } from "@/src/components/charts";
import { Logo } from "@/src/components/Logo";
import { MonthCalendar } from "@/src/components/MonthCalendar";
import { PremiumNotice } from "@/src/components/PremiumNotice";
import { ServiceRow } from "@/src/components/ServiceRow";
import { useToast } from "@/src/components/Toast";
import { Card, EmptyState, IconButton, Ionicons, SectionHeader, T, type IconName } from "@/src/components/ui";
import { canEditNow, useGuard } from "@/src/data/actions.ts";
import { useAppState } from "@/src/data/store.ts";
import { formatDate, formatShort, todayISO } from "@/src/domain/dates.ts";
import { convertTotals, formatMoney } from "@/src/domain/money.ts";
import { categoryDistribution, summarize } from "@/src/domain/stats.ts";
import { categoryOf, type CategoryId } from "@/src/domain/types.ts";
import { runSync } from "@/src/gmail/sync.ts";
import { usesNativeTabs } from "@/src/navigation";
import { radius, shadow, spacing, useTheme, type ThemeColors } from "@/src/theme";

export default function Dashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const st = useAppState();
  const ent = useEntitlement();
  const toast = useToast();
  const guard = useGuard();
  const today = todayISO();
  const [syncing, setSyncing] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const sum = useMemo(() => summarize(st.services, today), [st.services, today]);
  const main = st.settings.mainCurrency;
  const conv = convertTotals(sum.monthly, main, st.rates);
  const convAnnual = convertTotals(sum.annual, main, st.rates);
  const currencies = Object.keys(sum.monthly);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const marks = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of sum.active) {
      if (!s.nextDue) continue;
      m[s.nextDue] = s.nextDue < today ? colors.error : s.nextDue === today ? colors.warning : colors.brandPrimary;
    }
    return m;
  }, [sum.active, today, colors]);

  const dist = useMemo(() => {
    const d = categoryDistribution(st.services, today);
    const cur = d[main] ? main : Object.keys(d)[0];
    if (!cur) return null;
    const slices = Object.entries(d[cur])
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, label: categoryOf(k as CategoryId).label, value: v, color: colors[categoryOf(k as CategoryId).chart as keyof ThemeColors], valueLabel: formatMoney(v, cur) }));
    const total = slices.reduce((a, s) => a + s.value, 0);
    return { cur, slices, total };
  }, [st.services, today, main, colors]);

  const sync = async () => {
    if (!st.gmail.connected) return router.push("/gmail");
    if (!canEditNow()) return router.push("/premium");
    setSyncing(true);
    const r = await runSync();
    setSyncing(false);
    toast(r.ok ? `Sincronización completa: ${r.created} nuevos, ${r.suggested} sugerencias.` : r.error ?? "Error", r.ok ? "success" : "error");
  };

  const empty = st.services.length === 0;
  const dayList = day ? sum.active.filter((s) => s.nextDue === day) : [];
  const payments = [...st.payments].sort((a, b) => b.paidDate.localeCompare(a.paidDate)).slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ backgroundColor: colors.brand, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Logo size={34} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton testID="dashboard-sync-button" tone="hero" icon={syncing ? "hourglass-outline" : "sync-outline"} label="Sincronizar Gmail" onPress={sync} />
          <IconButton testID="dashboard-add-button" tone="hero" icon="add" label="Agregar servicio" onPress={() => guard(() => router.push("/service/form"))} />
        </View>
      </View>
      <ScrollView
        testID="dashboard-scroll"
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} tintColor={colors.onBrand} />}
      >
        {/* Hero */}
        <View style={{ backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingBottom: 56, gap: spacing.md }}>
          <T v="overline" style={{ color: colors.mintBright }}>Total mensual estimado</T>
          {currencies.length === 0 ? (
            <T v="hero" testID="dashboard-monthly-total" style={{ color: colors.onBrand }}>{formatMoney(0, main)}</T>
          ) : (
            <View style={{ gap: 4 }}>
              {currencies.map((c, i) => (
                <T key={c} v={i === 0 ? "hero" : "h2"} testID={`dashboard-monthly-${c}`} style={{ color: colors.onBrand, fontVariant: ["tabular-nums"] }}>{formatMoney(sum.monthly[c], c)}</T>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}>
            <View>
              <T v="caption" style={{ color: colors.heroMuted }}>Anual estimado</T>
              <T v="bodyStrong" testID="dashboard-annual-total" style={{ color: colors.onBrand }}>
                {currencies.length ? currencies.map((c) => formatMoney(sum.annual[c], c)).join(" · ") : formatMoney(0, main)}
              </T>
            </View>
            {currencies.length > 1 && conv.missing.length < currencies.length ? (
              <View>
                <T v="caption" style={{ color: colors.heroMuted }}>Convertido a {main} (tipo manual)</T>
                <T v="bodyStrong" testID="dashboard-converted-total" style={{ color: colors.onBrand }}>
                  {formatMoney(conv.total, main)}/mes · {formatMoney(convAnnual.total, main)}/año{conv.missing.length ? ` · sin ${conv.missing.join(", ")}` : ""}
                </T>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <HeroStat testID="dashboard-stat-today" icon="alert-circle-outline" label="Vencen hoy" value={sum.dueToday.length} tone={colors.warning} />
            <HeroStat testID="dashboard-stat-overdue" icon="warning-outline" label="Atrasados" value={sum.overdue.length} tone={colors.error} />
            <HeroStat testID="dashboard-stat-active" icon="layers-outline" label="Activos" value={sum.active.length} tone={colors.mintBright} />
          </View>
        </View>

        <View style={{ marginTop: -40, paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <StatusStrip
            gmailConnected={st.gmail.connected}
            lastSync={st.gmail.lastSyncAt}
            gmailStatus={st.gmail.lastSyncStatus}
            premium={ent.premium}
            devUnlocked={ent.devUnlocked}
            onGmail={() => router.push("/gmail")}
            onPremium={() => router.push("/premium")}
          />
          <PremiumNotice testID="dashboard-premium-notice" />

          {st.suggestions.length > 0 ? (
            <Pressable testID="dashboard-suggestions-banner" onPress={() => router.push("/gmail")}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Ionicons name="sparkles-outline" size={20} color={colors.brandPrimary} />
                <T v="bodyStrong" style={{ flex: 1 }}>{st.suggestions.length} detecciones de Gmail para revisar</T>
                <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
              </Card>
            </Pressable>
          ) : null}

          {empty ? (
            <Card testID="dashboard-empty">
              <EmptyState
                testID="dashboard-empty-state"
                icon="wallet-outline"
                title="Empezá a ordenar tus pagos"
                body="Agregá tu primer servicio o conectá Gmail para detectar suscripciones y facturas automáticamente."
                action="Agregar servicio"
                onAction={() => guard(() => router.push("/service/form"))}
              />
              <Pressable testID="dashboard-empty-gmail" onPress={() => router.push("/gmail")} style={{ alignItems: "center", paddingBottom: spacing.md, minHeight: 44, justifyContent: "center" }}>
                <T v="label" color="brandPrimary">Conectar Gmail</T>
              </Pressable>
            </Card>
          ) : (
            <>
              {sum.overdue.length > 0 ? <ListCard testID="dashboard-overdue" title="Pagos atrasados" items={sum.overdue} today={today} onOpen={(id) => router.push(`/service/${id}`)} /> : null}
              {sum.dueToday.length > 0 ? <ListCard testID="dashboard-due-today" title="Vencen hoy" items={sum.dueToday} today={today} onOpen={(id) => router.push(`/service/${id}`)} /> : null}
              <ListCard testID="dashboard-upcoming" title="Próximos 30 días" items={sum.upcoming.slice(0, 6)} today={today} onOpen={(id) => router.push(`/service/${id}`)} emptyText="No hay vencimientos en los próximos 30 días." action="Ver todos" onAction={() => router.push("/services")} />
              {sum.trials.length > 0 ? <ListCard testID="dashboard-trials" title="Pruebas gratuitas activas" items={sum.trials} today={today} onOpen={(id) => router.push(`/service/${id}`)} /> : null}

              <Card testID="dashboard-renewals">
                <SectionHeader title="Próximas renovaciones" />
                {sum.renewals.length === 0 ? (
                  <T v="body" color="muted">Sin renovaciones en los próximos 60 días.</T>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    {sum.renewals.map((s) => (
                      <Pressable key={s.id} testID={`dashboard-renewal-${s.id}`} onPress={() => router.push(`/service/${s.id}`)} style={{ width: 132, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, gap: 4 }}>
                        <T v="caption">{formatShort(s.nextDue!)}</T>
                        <T v="bodyStrong" numberOfLines={1}>{s.name}</T>
                        <T v="caption" color="onSurfaceTertiary">{formatMoney(s.amountMinor, s.currency)}</T>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </Card>

              <Card testID="dashboard-calendar-card">
                <SectionHeader title="Calendario de vencimientos" />
                <MonthCalendar testID="dashboard-calendar" initial={today} today={today} selected={day} onSelect={(d) => setDay(d === day ? null : d)} marks={marks} />
                {day ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <T v="label" color="muted">{formatDate(day)}</T>
                    {dayList.length === 0 ? <T v="body" color="muted">Sin vencimientos este día.</T> : dayList.map((s) => <ServiceRow key={s.id} s={s} today={today} testID={`dashboard-day-row-${s.id}`} onPress={() => router.push(`/service/${s.id}`)} />)}
                  </View>
                ) : null}
              </Card>

              {dist && dist.slices.length > 0 ? (
                <Card testID="dashboard-category-card">
                  <SectionHeader title="Gasto mensual por categoría" action="Reportes" onAction={() => router.push("/reports")} testID="dashboard-to-reports" />
                  <Donut testID="dashboard-category-donut" slices={dist.slices} centerTop={formatMoney(dist.total, dist.cur)} centerBottom={`${dist.cur} / mes`} size={140} />
                </Card>
              ) : null}

              <Card testID="dashboard-history">
                <SectionHeader title="Pagos confirmados" />
                {payments.length === 0 ? (
                  <T v="body" color="muted">Todavía no confirmaste pagos. Usá “Confirmar pago” en el detalle de un servicio.</T>
                ) : (
                  payments.map((p) => (
                    <View key={p.id} testID={`dashboard-payment-${p.id}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md }}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      <View style={{ flex: 1 }}>
                        <T v="bodyStrong" numberOfLines={1}>{p.serviceName}</T>
                        <T v="caption">Pagado el {formatDate(p.paidDate)}</T>
                      </View>
                      <T v="bodyStrong">{formatMoney(p.amountMinor, p.currency)}</T>
                    </View>
                  ))
                )}
              </Card>
            </>
          )}
          <T v="caption" style={{ textAlign: "center" }}>Los totales son estimaciones según la frecuencia de cada servicio; los pagos confirmados se registran por separado.</T>
        </View>
      </ScrollView>
    </View>
  );
}

function HeroStat({ icon, label, value, tone, testID }: { icon: IconName; label: string; value: number; tone: string; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.heroCard, borderWidth: 1, borderColor: colors.heroBorder, borderRadius: radius.md, padding: spacing.md, gap: 4 }}>
      <Ionicons name={icon} size={16} color={tone} />
      <T v="h2" style={{ color: colors.onBrand }}>{value}</T>
      <T v="caption" style={{ color: colors.heroMuted }}>{label}</T>
    </View>
  );
}

function StatusStrip(p: { gmailConnected: boolean; lastSync: string | null; gmailStatus: string; premium: boolean; devUnlocked: boolean; onGmail: () => void; onPremium: () => void }) {
  const { colors } = useTheme();
  const last = p.lastSync ? new Date(p.lastSync) : null;
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Pressable testID="dashboard-gmail-status" onPress={p.onGmail} style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 2, ...shadow }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="mail-outline" size={16} color={p.gmailConnected ? colors.brandPrimary : colors.muted} />
          <T v="label">Gmail</T>
        </View>
        <T v="caption" numberOfLines={1}>
          {!p.gmailConnected ? "No conectado" : p.gmailStatus === "reauth" ? "Requiere autorizar" : last ? `Sinc. ${last.toLocaleDateString("es-AR")} ${last.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "Sin sincronizar"}
        </T>
      </Pressable>
      <Pressable testID="dashboard-subscription-status" onPress={p.onPremium} style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 2, ...shadow }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="diamond-outline" size={16} color={p.premium ? colors.brandPrimary : colors.muted} />
          <T v="label">Subly Premium</T>
        </View>
        <T v="caption" numberOfLines={1}>{p.premium ? "Activa (verificada)" : p.devUnlocked ? "Modo desarrollo" : "Inactiva"}</T>
      </Pressable>
    </View>
  );
}

function ListCard({ title, items, today, onOpen, testID, emptyText, action, onAction }: { title: string; items: ReturnType<typeof summarize>["active"]; today: string; onOpen: (id: string) => void; testID: string; emptyText?: string; action?: string; onAction?: () => void }) {
  return (
    <Card testID={testID}>
      <SectionHeader title={title} action={action} onAction={onAction} testID={`${testID}-action`} />
      {items.length === 0 ? <T v="body" color="muted">{emptyText}</T> : items.map((s) => <ServiceRow key={s.id} s={s} today={today} testID={`${testID}-row-${s.id}`} onPress={() => onOpen(s.id)} />)}
    </Card>
  );
}
