import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldLabel, Input } from "@/src/components/fields";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Button, Card, Chip, Divider, Ionicons, Notice, T } from "@/src/components/ui";
import { now } from "@/src/data/actions.ts";
import { commit, useAppState } from "@/src/data/store.ts";
import { formatDate } from "@/src/domain/dates.ts";
import { validateRate } from "@/src/domain/money.ts";
import { uid } from "@/src/domain/operations.ts";
import type { ExchangeRate } from "@/src/domain/types.ts";
import { spacing, useTheme } from "@/src/theme";

export default function Currencies() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const st = useAppState();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExchangeRate | null>(null);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState(st.settings.mainCurrency);
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const used = new Set(st.services.map((s) => s.currency));

  const addCurrency = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return toast("Usá un código ISO de 3 letras (ej.: CLP).", "error");
    if (st.settings.currencies.includes(c)) return toast("Esa moneda ya está en la lista.", "info");
    await commit((s) => ({ ...s, settings: { ...s.settings, currencies: [...s.settings.currencies, c] } }));
    setCode("");
    toast(`Moneda ${c} agregada.`);
  };
  const removeCurrency = async (c: string) => {
    if (used.has(c) || c === st.settings.mainCurrency) return toast("No se puede quitar: está en uso o es la moneda principal.", "info");
    await commit((s) => ({ ...s, settings: { ...s.settings, currencies: s.settings.currencies.filter((x) => x !== c) } }));
  };
  const openRate = (r?: ExchangeRate) => {
    setEditing(r ?? null);
    setFrom(r?.from ?? "USD");
    setTo(r?.to ?? st.settings.mainCurrency);
    setValue(r ? String(r.rate).replace(".", ",") : "");
    setErr(null);
    setOpen(true);
  };
  const saveRate = async () => {
    const v = Number(value.replace(/\./g, "").replace(",", "."));
    const e = validateRate(from, to, v);
    if (e) return setErr(e);
    const dup = st.rates.find((r) => r.id !== editing?.id && ((r.from === from && r.to === to) || (r.from === to && r.to === from)));
    if (dup) return setErr(`Ya existe un tipo de cambio entre ${from} y ${to}. Editalo en lugar de crear otro.`);
    await commit((s) => ({
      ...s,
      rates: editing ? s.rates.map((r) => (r.id === editing.id ? { ...r, from, to, rate: v, updatedAt: now() } : r)) : [...s.rates, { id: uid("rate"), from, to, rate: v, updatedAt: now() }],
    }));
    setOpen(false);
    toast("Tipo de cambio guardado.");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader testID="currencies-header" title="Monedas" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Card>
          <T v="h3">Moneda principal</T>
          <T v="caption" style={{ marginBottom: spacing.md }}>Se usa para los resúmenes convertidos. Cada registro mantiene su moneda original.</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {st.settings.currencies.map((c) => <Chip key={c} testID={`currencies-main-${c}`} label={c} selected={st.settings.mainCurrency === c} onPress={() => commit((s) => ({ ...s, settings: { ...s.settings, mainCurrency: c } }))} />)}
          </ScrollView>
        </Card>

        <Card>
          <T v="h3">Monedas disponibles</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.md }}>
            {st.settings.currencies.map((c) => <Chip key={c} testID={`currencies-item-${c}`} label={c} icon={used.has(c) || c === st.settings.mainCurrency ? undefined : "close"} onPress={() => removeCurrency(c)} />)}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Input testID="currencies-new-code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="Código (ej.: CLP)" autoCapitalize="characters" maxLength={3} style={{ flex: 1 }} />
            <Button testID="currencies-add" title="Agregar" onPress={addCurrency} />
          </View>
        </Card>

        <Card testID="currencies-rates">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T v="h3">Tipos de cambio manuales</T>
            <Button testID="currencies-add-rate" small title="Nuevo" icon="add" onPress={() => openRate()} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Notice tone="info" icon="information-circle-outline" title="Valores definidos por vos" body="No son cotizaciones oficiales ni se actualizan automáticamente. Cambiar un tipo de cambio no modifica los importes originales." />
          </View>
          {st.rates.length === 0 ? <T v="body" color="muted" style={{ marginTop: spacing.md }}>Sin tipos de cambio configurados.</T> : st.rates.map((r, i) => (
            <View key={r.id}>
              {i ? <Divider /> : null}
              <Pressable testID={`currencies-rate-${r.from}-${r.to}`} onPress={() => openRate(r)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md, minHeight: 56 }}>
                <Ionicons name="swap-horizontal" size={18} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong">1 {r.from} = {r.rate.toLocaleString("es-AR", { maximumFractionDigits: 6 })} {r.to}</T>
                  <T v="caption">Actualizado {formatDate(r.updatedAt.slice(0, 10))}</T>
                </View>
                <Pressable testID={`currencies-rate-delete-${r.from}-${r.to}`} hitSlop={8} onPress={() => commit((s) => ({ ...s, rates: s.rates.filter((x) => x.id !== r.id) }))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Editar tipo de cambio" : "Nuevo tipo de cambio"} testID="rate-sheet">
        <FieldLabel label="Desde">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {st.settings.currencies.map((c) => <Chip key={c} testID={`rate-sheet-from-${c}`} label={c} selected={from === c} onPress={() => setFrom(c)} />)}
          </ScrollView>
        </FieldLabel>
        <FieldLabel label="Hacia">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {st.settings.currencies.map((c) => <Chip key={c} testID={`rate-sheet-to-${c}`} label={c} selected={to === c} onPress={() => setTo(c)} />)}
          </ScrollView>
        </FieldLabel>
        <FieldLabel label={`Valor: 1 ${from} equivale a…`} error={err ?? undefined}>
          <Input testID="rate-sheet-value" value={value} onChangeText={setValue} placeholder={`Cantidad de ${to}`} keyboardType="decimal-pad" error={!!err} />
        </FieldLabel>
        <Button testID="rate-sheet-save" title="Guardar" icon="checkmark" onPress={saveRate} />
      </Sheet>
    </View>
  );
}
