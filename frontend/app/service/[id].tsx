import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField, FieldLabel, Input } from "@/src/components/fields";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { Button, Card, Divider, EmptyState, IconButton, Ionicons, Notice, StatusBadge, T } from "@/src/components/ui";
import { now, today, useGuard, usePremiumAction } from "@/src/data/actions.ts";
import { useAppState } from "@/src/data/store.ts";
import { computeStatus, formatDate, relativeDue, todayISO } from "@/src/domain/dates.ts";
import { convertTotals, formatAmountInput, formatMoney, monthlyEquivalent, parseAmount } from "@/src/domain/money.ts";
import { cancelService, confirmPayment, deletePayment, deleteService, reactivateService } from "@/src/domain/operations.ts";
import { categoryOf, frequencyLabel } from "@/src/domain/types.ts";
import { spacing, useTheme } from "@/src/theme";

export default function ServiceDetail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useAppState();
  const run = usePremiumAction();
  const guard = useGuard();
  const s = st.services.find((x) => x.id === id);
  const [payOpen, setPayOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payDate, setPayDate] = useState<string | null>(todayISO());
  const [payAmount, setPayAmount] = useState("");
  const [payErr, setPayErr] = useState<string | null>(null);

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScreenHeader testID="service-detail-header" title="Servicio" />
        <EmptyState testID="service-detail-missing" icon="help-circle-outline" title="Registro no encontrado" body="Puede que haya sido eliminado." action="Volver al inicio" onAction={() => router.replace("/")} />
      </View>
    );
  }
  const t = todayISO();
  const status = computeStatus(s, t);
  const cat = categoryOf(s.category);
  const history = st.payments.filter((p) => p.serviceId === s.id).sort((a, b) => b.paidDate.localeCompare(a.paidDate));
  const monthly = Math.round(monthlyEquivalent(s));
  const main = st.settings.mainCurrency;
  const conv = s.currency !== main ? convertTotals({ [s.currency]: s.amountMinor }, main, st.rates) : null;

  const openPay = () => guard(() => { setPayAmount(formatAmountInput(s.amountMinor)); setPayDate(t); setPayErr(null); setPayOpen(true); });
  const doPay = async () => {
    const amt = parseAmount(payAmount);
    if (!payDate) return setPayErr("Elegí la fecha de pago.");
    if (amt === null) return setPayErr("Ingresá un importe válido.");
    if (payDate > t) return setPayErr("La fecha de pago no puede ser futura.");
    const ok = await run((x) => confirmPayment(x, s.id, payDate, amt, now()), "Pago confirmado.");
    if (ok) setPayOpen(false);
  };
  const doDelete = async (withHistory: boolean) => {
    const ok = await run((x) => deleteService(x, s.id, withHistory), "Registro eliminado.");
    if (ok) {
      setDelOpen(false);
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader dark testID="service-detail-header" title={s.name} right={<IconButton testID="service-detail-edit" tone="hero" icon="create-outline" label="Editar" onPress={() => guard(() => router.push({ pathname: "/service/form", params: { id: s.id } }))} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={cat.icon as any} size={16} color={colors.mintBright} />
            <T v="caption" style={{ color: colors.heroMuted }}>{cat.label}{s.source === "gmail" ? " · Detectado en Gmail" : ""}</T>
          </View>
          <T v="hero" testID="service-detail-amount" style={{ color: colors.onBrand }}>{formatMoney(s.amountMinor, s.currency)}</T>
          {conv && conv.missing.length === 0 ? <T v="caption" style={{ color: colors.heroMuted }}>≈ {formatMoney(conv.total, main)} (tipo manual)</T> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <StatusBadge status={status} testID="service-detail-status" />
            <T v="caption" style={{ color: colors.heroMuted }}>{frequencyLabel(s)} · {relativeDue(s.nextDue, t)}</T>
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {status === "overdue" ? <Notice testID="service-detail-overdue" tone="error" icon="warning-outline" title="Pago atrasado" body={`Venció el ${formatDate(s.nextDue)}. Si ya pagaste, confirmalo para calcular el próximo vencimiento.`} /> : null}
          {!s.cancelled && s.nextDue ? (
            <Button testID="service-detail-confirm-payment" title="Confirmar pago" icon="checkmark-done" onPress={openPay} />
          ) : null}

          <Card testID="service-detail-info">
            <Info label="Próximo vencimiento" value={formatDate(s.nextDue)} />
            <Info label="Último pago" value={formatDate(s.lastPaid)} />
            {s.frequency !== "once" ? <Info label="Equivalente mensual" value={formatMoney(monthly, s.currency)} /> : null}
            <Info label="Inicio" value={formatDate(s.startDate)} />
            <Info label="Finalización" value={formatDate(s.endDate)} />
            {s.trialEnd ? <Info label="Prueba gratuita" value={`${formatDate(s.trialStart)} → ${formatDate(s.trialEnd)}`} /> : null}
            <Info label="Recordatorios" value={s.reminders && !s.cancelled ? "Activados" : "Desactivados"} />
            <Info label="Origen" value={s.source === "gmail" ? "Gmail" : "Manual"} />
            {s.description ? <Info label="Descripción" value={s.description} /> : null}
            {s.notes ? <Info label="Notas" value={s.notes} /> : null}
            <Info label="Creado" value={formatDate(s.createdAt.slice(0, 10))} />
            <Info label="Modificado" value={formatDate(s.updatedAt.slice(0, 10))} last />
          </Card>

          <Card testID="service-detail-history">
            <T v="h3" style={{ marginBottom: spacing.sm }}>Historial de pagos</T>
            {history.length === 0 ? <T v="body" color="muted">Sin pagos confirmados.</T> : history.map((p, i) => (
              <View key={p.id}>
                {i ? <Divider /> : null}
                <View testID={`service-detail-payment-${p.id}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{formatMoney(p.amountMinor, p.currency)}</T>
                    <T v="caption">Pagado {formatDate(p.paidDate)}{p.dueDate ? ` · vencía ${formatDate(p.dueDate)}` : ""}</T>
                  </View>
                  <Pressable testID={`service-detail-payment-delete-${p.id}`} hitSlop={10} accessibilityLabel="Eliminar pago" onPress={() => run((x) => deletePayment(x, p.id), "Pago eliminado del historial.")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="trash-outline" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>

          {s.cancelled ? (
            <Button testID="service-detail-reactivate" kind="secondary" icon="refresh" title="Reactivar servicio" onPress={() => run((x) => reactivateService(x, s.id, now()), "Servicio reactivado.")} />
          ) : (
            <Button testID="service-detail-cancel" kind="secondary" icon="pause-circle-outline" title="Marcar como cancelado" onPress={() => guard(() => setCancelOpen(true))} />
          )}
          <Button testID="service-detail-delete" kind="danger" icon="trash-outline" title="Eliminar registro" onPress={() => guard(() => setDelOpen(true))} />
        </View>
      </ScrollView>

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title="Confirmar pago" testID="pay-sheet">
        <T v="body" color="muted">Registrá el pago del vencimiento del {formatDate(s.nextDue)}. Solo confirmalo si el pago se realizó.</T>
        <FieldLabel label="Fecha de pago">
          <DateField testID="pay-sheet-date" value={payDate} onChange={setPayDate} allowClear={false} />
        </FieldLabel>
        <FieldLabel label={`Importe pagado (${s.currency})`}>
          <Input testID="pay-sheet-amount" value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" />
        </FieldLabel>
        {payErr ? <T v="caption" color="errorText" testID="pay-sheet-error">{payErr}</T> : null}
        <Button testID="pay-sheet-confirm" title="Confirmar pago" icon="checkmark" onPress={doPay} />
      </Sheet>

      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar servicio" testID="cancel-sheet">
        <T v="body" color="muted">Se conserva el historial de pagos y se detienen sus recordatorios. Podés reactivarlo cuando quieras.</T>
        <Button testID="cancel-sheet-confirm" title="Marcar como cancelado" onPress={async () => { if (await run((x) => cancelService(x, s.id, today(), now()), "Servicio cancelado.")) setCancelOpen(false); }} />
      </Sheet>

      <Sheet visible={delOpen} onClose={() => setDelOpen(false)} title="Eliminar registro" testID="delete-sheet">
        <T v="body" color="muted">Se eliminará “{s.name}” y sus recordatorios. {history.length ? `Tiene ${history.length} pago(s) confirmados en el historial.` : "No tiene pagos registrados."}</T>
        {history.length ? <Button testID="delete-sheet-keep-history" kind="secondary" title="Eliminar y conservar historial" onPress={() => doDelete(false)} /> : null}
        <Button testID="delete-sheet-confirm" kind="danger" title={history.length ? "Eliminar todo, incluido el historial" : "Eliminar"} onPress={() => doDelete(true)} />
      </Sheet>
    </View>
  );
}

function Info({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <T v="body" color="muted">{label}</T>
      <T v="bodyStrong" style={{ flexShrink: 1, textAlign: "right" }}>{value}</T>
    </View>
  );
}
