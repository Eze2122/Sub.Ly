import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Bars, Donut } from "@/src/components/charts";
import { Card, Chip, EmptyState, Notice, SectionHeader, T } from "@/src/components/ui";
import { useAppState } from "@/src/data/store.ts";
import { formatDate, MONTHS_LONG, todayISO } from "@/src/domain/dates.ts";
import { convertTotals, formatMoney } from "@/src/domain/money.ts";
import { categoryDistribution, lastMonths, paidByMonth, summarize } from "@/src/domain/stats.ts";
import { categoryOf, type CategoryId } from "@/src/domain/types.ts";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, useTheme, type ThemeColors } from "@/src/theme";

export default function Reports() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const st = useAppState();
  const today = todayISO();
  const main = st.settings.mainCurrency;
  const sum = useMemo(() => summarize(st.services, today), [st.services, today]);
  const dist = useMemo(() => categoryDistribution(st.services, today), [st.services, today]);
  const months = useMemo(() => lastMonths(today, 6), [today]);
  const paid = useMemo(() => paidByMonth(st.payments, months), [st.payments, months]);
  const estCurrencies = Object.keys(sum.monthly);
  const paidCurrencies = Array.from(new Set(st.payments.map((p) => p.currency)));
  const [distCur, setDistCur] = useState<string | null>(null);
  const [paidCur, setPaidCur] = useState<string | null>(null);
  const dc = distCur && dist[distCur] ? distCur : dist[main] ? main : Object.keys(dist)[0];
  const pc = paidCur && paidCurrencies.includes(paidCur) ? paidCur : paidCurrencies.includes(main) ? main : paidCurrencies[0];
  const conv = convertTotals(sum.monthly, main, st.rates);
  const convA = convertTotals(sum.annual, main, st.rates);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const thisM = months[5];
  const prevM = months[4];
  const paidThis = pc ? paid[thisM][pc] ?? 0 : 0;
  const paidPrev = pc ? paid[prevM][pc] ?? 0 : 0;
  const delta = paidPrev > 0 ? Math.round(((paidThis - paidPrev) / paidPrev) * 100) : null;
  const paidConvThis = convertTotals(paid[thisM], main, st.rates);

  const slices = dc
    ? Object.entries(dist[dc]).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: categoryOf(k as CategoryId).label, value: v, color: colors[categoryOf(k as CategoryId).chart as keyof ThemeColors], valueLabel: formatMoney(v, dc) }))
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <T v="title">Reportes</T>
        <T v="caption">Calculados con tus registros reales</T>
      </View>
      <ScrollView testID="reports-scroll" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}>
        {st.services.length === 0 && st.payments.length === 0 ? (
          <Card>
            <EmptyState testID="reports-empty" icon="pie-chart-outline" title="Sin datos para analizar" body="Cuando registres servicios y confirmes pagos vas a ver tus gastos mensuales, anuales y por categoría." action="Agregar servicio" onAction={() => router.push("/service/form")} />
          </Card>
        ) : (
          <>
            <Card testID="reports-estimates">
              <SectionHeader title="Gasto estimado" />
              <T v="caption" style={{ marginBottom: spacing.sm }}>Proyección según la frecuencia de los servicios activos. No son pagos realizados.</T>
              {estCurrencies.length === 0 ? <T v="body" color="muted">No hay servicios recurrentes activos.</T> : null}
              {estCurrencies.map((c) => (
                <View key={c} testID={`reports-estimate-${c}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <T v="bodyStrong">{c}</T>
                  <View style={{ alignItems: "flex-end" }}>
                    <T v="bodyStrong">{formatMoney(sum.monthly[c], c)} / mes</T>
                    <T v="caption">{formatMoney(sum.annual[c], c)} / año</T>
                  </View>
                </View>
              ))}
              {estCurrencies.length > 0 ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <T v="label">Estimación convertida a {main}</T>
                  <T v="h2" testID="reports-converted-monthly">{formatMoney(conv.total, main)} / mes</T>
                  <T v="caption">{formatMoney(convA.total, main)} / año</T>
                  {conv.usedRates.map((r) => <T key={r.id} v="caption">Tipo manual {r.from}→{r.to}: {r.rate} (actualizado {formatDate(r.updatedAt.slice(0, 10))})</T>)}
                  {conv.missing.length ? (
                    <Notice testID="reports-missing-rates" tone="warning" icon="swap-horizontal-outline" title={`Sin tipo de cambio para ${conv.missing.join(", ")}`} body="Estos importes no están incluidos en el total convertido. Configurá un tipo de cambio manual en Ajustes › Monedas." />
                  ) : null}
                </View>
              ) : null}
            </Card>

            {slices.length > 0 ? (
              <Card testID="reports-category">
                <SectionHeader title="Distribución por categoría" />
                {Object.keys(dist).length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
                    {Object.keys(dist).map((c) => <Chip key={c} testID={`reports-dist-currency-${c}`} label={c} selected={dc === c} onPress={() => setDistCur(c)} />)}
                  </ScrollView>
                ) : null}
                <Donut testID="reports-donut" slices={slices} centerTop={formatMoney(slices.reduce((a, s) => a + s.value, 0), dc!)} centerBottom="por mes" />
                <View style={{ marginTop: spacing.md }}>
                  {slices.map((s) => (
                    <View key={s.key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                      <T v="body" color="onSurfaceTertiary" style={{ flex: 1 }}>{s.label}</T>
                      <T v="bodyStrong">{s.valueLabel}</T>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <Card testID="reports-paid">
              <SectionHeader title="Pagos confirmados" />
              {paidCurrencies.length === 0 ? (
                <T v="body" color="muted">Todavía no hay pagos confirmados. Los pagos se registran solo cuando los confirmás.</T>
              ) : (
                <>
                  {paidCurrencies.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
                      {paidCurrencies.map((c) => <Chip key={c} testID={`reports-paid-currency-${c}`} label={c} selected={pc === c} onPress={() => setPaidCur(c)} />)}
                    </ScrollView>
                  ) : null}
                  <Bars testID="reports-bars" data={months.map((k) => ({ label: MONTHS_LONG[Number(k.slice(5)) - 1].slice(0, 3), value: paid[k][pc!] ?? 0, highlight: k === thisM }))} />
                  <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <T v="caption">Este mes ({pc})</T>
                      <T v="h3" testID="reports-paid-this-month">{formatMoney(paidThis, pc!)}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="caption">Mes anterior</T>
                      <T v="h3">{formatMoney(paidPrev, pc!)}</T>
                    </View>
                  </View>
                  <T v="caption" testID="reports-comparison" style={{ marginTop: spacing.sm }}>
                    {delta === null ? "No hay datos suficientes del mes anterior para comparar." : `${delta >= 0 ? "+" : ""}${delta}% respecto del mes anterior.`}
                  </T>
                  {paidCurrencies.length > 1 && paidConvThis.missing.length === 0 ? <T v="caption">Total del mes convertido: {formatMoney(paidConvThis.total, main)}</T> : null}
                </>
              )}
            </Card>

            <Card testID="reports-upcoming">
              <SectionHeader title="Próximos vencimientos (30 días)" />
              {sum.upcoming.length === 0 ? <T v="body" color="muted">Sin vencimientos próximos.</T> : sum.upcoming.map((s) => (
                <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                  <T v="body" style={{ flex: 1 }} numberOfLines={1}>{formatDate(s.nextDue)} · {s.name}</T>
                  <T v="bodyStrong">{formatMoney(s.amountMinor, s.currency)}</T>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
