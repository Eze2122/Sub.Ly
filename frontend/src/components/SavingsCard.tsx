import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { now, usePremiumAction } from "@/src/data/actions.ts";
import { convertTotals, formatMoney } from "@/src/domain/money.ts";
import { setUsage } from "@/src/domain/operations.ts";
import { savingsSummary } from "@/src/domain/stats.ts";
import { USAGE_LABEL, type AppState, type Usage } from "@/src/domain/types.ts";
import { spacing, useTheme } from "@/src/theme";

import { Card, Chip, Divider, Ionicons, Notice, SectionHeader, T } from "./ui";

const QUICK: Usage[] = ["high", "medium", "low"];

/** Savings alert: annual cost of subscriptions the user declared as rarely used. */
export function SavingsCard({ st, today }: { st: AppState; today: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const run = usePremiumAction();
  const sv = useMemo(() => savingsSummary(st.services, today), [st.services, today]);
  if (sv.recurringCount === 0) return null;
  const main = st.settings.mainCurrency;
  const curs = Object.keys(sv.annualLow);
  const conv = convertTotals(sv.annualLow, main, st.rates);

  return (
    <Card testID="reports-savings">
      <SectionHeader title="Alerta de ahorro" />
      <T v="caption" style={{ marginBottom: spacing.sm }}>Estimación anual según el importe, la moneda y la frecuencia de las suscripciones que marcaste como poco usadas. Subly no mide tu uso real ni cancela nada.</T>
      {sv.low.length === 0 ? (
        <T v="body" color="muted" testID="reports-savings-empty">Todavía no marcaste suscripciones como poco usadas.</T>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <T v="label" color="muted">Podrías ahorrar por año</T>
          {curs.map((c) => (
            <T key={c} v="h2" testID={`reports-savings-total-${c}`} color="brandPrimary">{formatMoney(sv.annualLow[c], c)}</T>
          ))}
          {curs.length > 1 && conv.missing.length < curs.length ? (
            <T v="caption" testID="reports-savings-converted">≈ {formatMoney(conv.total, main)} con tipos manuales{conv.missing.length ? ` (sin ${conv.missing.join(", ")})` : ""}</T>
          ) : null}
          <T v="body" color="onSurfaceTertiary">Revisá si te conviene pausar o cancelar estas suscripciones desde el proveedor:</T>
          {sv.low.map(({ s, annual }, i) => (
            <View key={s.id}>
              {i ? <Divider /> : null}
              <Pressable testID={`reports-savings-row-${s.id}`} onPress={() => router.push(`/service/${s.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 }}>
                <Ionicons name="trending-down-outline" size={18} color={colors.warning} />
                <T v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{s.name}</T>
                <T v="bodyStrong">{formatMoney(annual, s.currency)}/año</T>
                <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {sv.unrated.length > 0 ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Notice testID="reports-savings-unrated" tone="info" icon="help-circle-outline" title={`Contanos cuánto usás ${sv.unrated.length} ${sv.unrated.length === 1 ? "suscripción" : "suscripciones"}`} body="Sin esa información no se incluyen en la estimación." />
          {sv.unrated.slice(0, 5).map((s) => (
            <View key={s.id} style={{ gap: 6 }}>
              <T v="bodyStrong" numberOfLines={1}>{s.name}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {QUICK.map((u) => (
                  <Chip key={u} testID={`reports-savings-usage-${s.id}-${u}`} label={USAGE_LABEL[u]} onPress={() => run((x) => setUsage(x, s.id, u, now()))} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
