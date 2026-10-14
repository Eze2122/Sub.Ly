import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField, FieldLabel, Input, Segmented } from "@/src/components/fields";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Button, Chip, Notice, T } from "@/src/components/ui";
import { now, today, usePremiumAction } from "@/src/data/actions.ts";
import { useAppState } from "@/src/data/store.ts";
import { firstDueOnOrAfter, parseISO, todayISO } from "@/src/domain/dates.ts";
import { formatAmountInput, parseAmount } from "@/src/domain/money.ts";
import { createService, findDuplicate, updateService, validateServiceInput, type FieldErrors, type ServiceInput } from "@/src/domain/operations.ts";
import { CATEGORIES, FREQUENCIES, type CategoryId, type Frequency, type IntervalUnit, type Usage } from "@/src/domain/types.ts";
import { spacing, useTheme } from "@/src/theme";

const UNITS: { id: IntervalUnit; label: string }[] = [
  { id: "day", label: "Días" },
  { id: "week", label: "Semanas" },
  { id: "month", label: "Meses" },
  { id: "year", label: "Años" },
];

export default function ServiceForm() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, fromSuggestion } = useLocalSearchParams<{ id?: string; fromSuggestion?: string }>();
  const st = useAppState();
  const run = usePremiumAction();
  const existing = st.services.find((s) => s.id === id);
  const sug = st.suggestions.find((s) => s.id === fromSuggestion);
  const init = existing ?? null;

  const [name, setName] = useState(init?.name ?? sug?.name ?? "");
  const [description, setDescription] = useState(init?.description ?? "");
  const [category, setCategory] = useState<CategoryId>(init?.category ?? sug?.category ?? "other");
  const [amount, setAmount] = useState(init ? formatAmountInput(init.amountMinor) : sug?.amountMinor ? formatAmountInput(sug.amountMinor) : "");
  const [currency, setCurrency] = useState(init?.currency ?? sug?.currency ?? st.settings.mainCurrency);
  const [frequency, setFrequency] = useState<Frequency>(init?.frequency ?? sug?.frequency ?? "monthly");
  const [customCount, setCustomCount] = useState(String(init?.customInterval?.count ?? 2));
  const [customUnit, setCustomUnit] = useState<IntervalUnit>(init?.customInterval?.unit ?? "month");
  const [nextDue, setNextDue] = useState<string | null>(init ? init.nextDue : sug?.nextDue ?? null);
  const [lastPaid, setLastPaid] = useState<string | null>(init?.lastPaid ?? null);
  const [startDate, setStartDate] = useState<string | null>(init?.startDate ?? null);
  const [endDate, setEndDate] = useState<string | null>(init?.endDate ?? null);
  const [trialStart, setTrialStart] = useState<string | null>(init?.trialStart ?? null);
  const [trialEnd, setTrialEnd] = useState<string | null>(init?.trialEnd ?? sug?.trialEnd ?? null);
  const [reminders, setReminders] = useState(init?.reminders ?? true);
  const [notes, setNotes] = useState(init?.notes ?? "");
  const [usage, setUsageSel] = useState<Usage | "none">(init?.usage ?? "none");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [showTrial, setShowTrial] = useState(!!(init?.trialEnd || sug?.trialEnd));

  const input: ServiceInput = useMemo(
    () => ({
      name, description, category, amountMinor: amount.trim() ? parseAmount(amount) : trialEnd ? 0 : null, currency, frequency,
      customInterval: frequency === "custom" ? { count: Number(customCount), unit: customUnit } : undefined,
      nextDue, lastPaid, startDate, endDate, trialStart, trialEnd, reminders, notes,
      usage: usage === "none" ? null : usage,
      source: existing?.source ?? (sug ? "gmail" : "manual"),
      sourceRef: existing?.sourceRef ?? sug?.sourceRef ?? null,
    }),
    [name, description, category, amount, currency, frequency, customCount, customUnit, nextDue, lastPaid, startDate, endDate, trialStart, trialEnd, reminders, notes, usage, existing, sug],
  );

  const dup = !existing && name.trim().length > 2 ? findDuplicate(st, name, null) : null;

  const suggestNext = () => {
    if (!startDate || frequency === "once") return;
    setNextDue(firstDueOnOrAfter({ frequency, customInterval: input.customInterval, anchorDay: parseISO(startDate).d, endDate }, startDate, todayISO()));
  };

  const save = async () => {
    const e = validateServiceInput(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    let newId = id;
    const ok = await run((s) => {
      if (existing) return updateService(s, existing.id, input, now(), today());
      const r = createService(s, input, now(), today());
      newId = r.service.id;
      return sug ? { ...r.state, suggestions: r.state.suggestions.filter((x) => x.id !== sug.id) } : r.state;
    }, existing ? "Cambios guardados." : "Servicio agregado.");
    setSaving(false);
    if (ok) {
      if (existing) router.back();
      else router.replace(`/service/${newId}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader testID="service-form-header" title={existing ? "Editar servicio" : "Nuevo servicio"} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {sug ? <Notice tone="info" icon="mail-outline" title="Datos detectados en Gmail" body="Revisá y corregí la información antes de guardar." /> : null}
        <FieldLabel label="Nombre del servicio" error={errors.name}>
          <Input testID="service-form-name" value={name} onChangeText={setName} placeholder="Ej.: Internet del hogar" error={!!errors.name} maxLength={60} />
        </FieldLabel>
        {dup ? <Notice testID="service-form-duplicate" tone="warning" icon="copy-outline" title="Posible duplicado" body={`Ya existe “${dup.name}”. Podés guardarlo igual si es otro registro.`} /> : null}

        <FieldLabel label="Categoría">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {CATEGORIES.map((c) => <Chip key={c.id} testID={`service-form-category-${c.id}`} label={c.label} selected={category === c.id} onPress={() => setCategory(c.id)} />)}
          </ScrollView>
        </FieldLabel>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Importe" error={errors.amountMinor}>
              <Input testID="service-form-amount" value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="decimal-pad" error={!!errors.amountMinor} />
            </FieldLabel>
          </View>
        </View>
        <FieldLabel label="Moneda" error={errors.currency}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {st.settings.currencies.map((c) => <Chip key={c} testID={`service-form-currency-${c}`} label={c} selected={currency === c} onPress={() => setCurrency(c)} />)}
          </ScrollView>
        </FieldLabel>

        <FieldLabel label="Frecuencia">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {FREQUENCIES.map((f) => <Chip key={f.id} testID={`service-form-frequency-${f.id}`} label={f.label} selected={frequency === f.id} onPress={() => setFrequency(f.id)} />)}
          </ScrollView>
        </FieldLabel>
        {frequency === "custom" ? (
          <FieldLabel label="Repetir cada" error={errors.customCount}>
            <View style={{ gap: spacing.sm }}>
              <Input testID="service-form-custom-count" value={customCount} onChangeText={setCustomCount} keyboardType="number-pad" error={!!errors.customCount} />
              <Segmented testID="service-form-custom-unit" options={UNITS} value={customUnit} onChange={setCustomUnit} />
            </View>
          </FieldLabel>
        ) : null}

        <FieldLabel label={frequency === "once" ? "Fecha de vencimiento" : "Próximo vencimiento"} error={errors.nextDue} hint={frequency !== "once" && startDate ? undefined : "Al confirmar un pago se calcula el siguiente automáticamente."}>
          <DateField testID="service-form-next-due" value={nextDue} onChange={setNextDue} error={!!errors.nextDue} />
        </FieldLabel>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Inicio (opcional)" error={errors.startDate}>
              <DateField testID="service-form-start" value={startDate} onChange={setStartDate} placeholder="Sin fecha" />
            </FieldLabel>
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Finalización (opcional)" error={errors.endDate}>
              <DateField testID="service-form-end" value={endDate} onChange={setEndDate} placeholder="Sin fecha" />
            </FieldLabel>
          </View>
        </View>
        {startDate && frequency !== "once" ? <Button testID="service-form-calc-next" small kind="ghost" icon="calculator-outline" title="Calcular próximo vencimiento desde el inicio" onPress={suggestNext} /> : null}
        <FieldLabel label="Último pago (opcional)" error={errors.lastPaid}>
          <DateField testID="service-form-last-paid" value={lastPaid} onChange={setLastPaid} placeholder="Sin registrar" />
        </FieldLabel>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T v="bodyStrong">Tiene prueba gratuita</T>
          <Switch testID="service-form-trial-toggle" value={showTrial} onValueChange={(v) => { setShowTrial(v); if (!v) { setTrialStart(null); setTrialEnd(null); } }} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
        </View>
        {showTrial ? (
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Inicio de prueba" error={errors.trialStart}>
                <DateField testID="service-form-trial-start" value={trialStart} onChange={setTrialStart} placeholder="Opcional" />
              </FieldLabel>
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Fin de prueba" error={errors.trialEnd}>
                <DateField testID="service-form-trial-end" value={trialEnd} onChange={setTrialEnd} placeholder="Elegir" />
              </FieldLabel>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">Recordatorios</T>
            <T v="caption">Según los avisos activos en Ajustes</T>
          </View>
          <Switch testID="service-form-reminders" value={reminders} onValueChange={setReminders} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
        </View>

        <FieldLabel label="¿Cuánto lo usás? (opcional)" hint="Se usa solo para la alerta de ahorro en Reportes.">
          <Segmented testID="service-form-usage" options={[{ id: "none", label: "Sin indicar" }, { id: "high", label: "Mucho" }, { id: "medium", label: "A veces" }, { id: "low", label: "Poco" }]} value={usage} onChange={setUsageSel} />
        </FieldLabel>

        <FieldLabel label="Descripción (opcional)">
          <Input testID="service-form-description" value={description} onChangeText={setDescription} placeholder="Ej.: Plan familiar" maxLength={120} />
        </FieldLabel>
        <FieldLabel label="Notas personales (opcional)">
          <Input testID="service-form-notes" value={notes} onChangeText={setNotes} placeholder="Solo se guardan en este dispositivo" multiline maxLength={500} />
        </FieldLabel>
        {Object.keys(errors).length ? <Notice testID="service-form-errors" tone="error" icon="alert-circle-outline" title="Revisá los campos marcados" /> : null}
        <Button testID="service-form-save" title={existing ? "Guardar cambios" : "Agregar servicio"} icon="checkmark" onPress={save} loading={saving} />
      </KeyboardAwareScrollView>
    </View>
  );
}
