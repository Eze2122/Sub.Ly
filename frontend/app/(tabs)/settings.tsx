import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEntitlement } from "@/src/billing/entitlement.ts";
import { Logo } from "@/src/components/Logo";
import { Button, Card, Divider, Notice, Row, T } from "@/src/components/ui";
import { commit, useAppState } from "@/src/data/store.ts";
import type { NotificationPrefs } from "@/src/domain/types.ts";
import { usesNativeTabs } from "@/src/navigation";
import { getPermission, notificationsSupported, requestPermission, reschedule, type PermissionInfo } from "@/src/services/notifications";
import { radius, spacing, useTheme } from "@/src/theme";

const NOTIF: { k: keyof NotificationPrefs; label: string }[] = [
  { k: "d7", label: "7 días antes del vencimiento" },
  { k: "d3", label: "3 días antes" },
  { k: "d1", label: "1 día antes" },
  { k: "d0", label: "El día del vencimiento" },
  { k: "overdue", label: "Pagos atrasados" },
  { k: "trialEnd", label: "Fin de pruebas gratuitas" },
];

export default function Settings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const st = useAppState();
  const ent = useEntitlement();
  const [perm, setPerm] = useState<PermissionInfo | null>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useFocusEffect(useCallback(() => { getPermission().then(setPerm).catch(() => undefined); }, []));

  const ask = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p.status === "granted") reschedule(st).catch(() => undefined);
  };
  const setPref = (k: keyof NotificationPrefs, v: boolean) =>
    commit((s) => ({ ...s, settings: { ...s.settings, notifications: { ...s.settings.notifications, [k]: v } } }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <T v="title">Ajustes</T>
      </View>
      <ScrollView testID="settings-scroll" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}>
        <Card style={{ backgroundColor: colors.brand, borderColor: colors.heroBorder }}>
          <Logo size={36} />
          <T v="body" style={{ color: colors.heroMuted, marginTop: spacing.sm }}>Tus pagos, bajo control.</T>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
            <T v="bodyStrong" testID="settings-premium-state" style={{ color: colors.onBrand }}>
              {ent.premium ? (ent.state === "trial" ? "Prueba gratuita activa" : "Premium activa") : ent.devUnlocked ? "Modo desarrollo" : "Sin suscripción activa"}
            </T>
            <Button testID="settings-premium-button" small kind="hero" title={ent.premium ? "Gestionar" : "Ver planes"} onPress={() => router.push("/premium")} />
          </View>
        </Card>

        <Card>
          <Row testID="settings-gmail" icon="mail-outline" title="Conexión con Gmail" subtitle={st.gmail.connected ? `Conectado${st.gmail.email ? ` · ${st.gmail.email}` : ""}` : "No conectado"} onPress={() => router.push("/gmail")} />
          <Divider />
          <Row testID="settings-currencies" icon="swap-horizontal-outline" title="Monedas y tipos de cambio" subtitle={`Moneda principal: ${st.settings.mainCurrency}`} onPress={() => router.push("/currencies")} />
          <Divider />
          <Row testID="settings-backup" icon="cloud-download-outline" title="Exportar y copias de seguridad" subtitle="CSV y copias cifradas" onPress={() => router.push("/backup")} />
          <Divider />
          <Row testID="settings-privacy" icon="shield-checkmark-outline" title="Privacidad y datos" subtitle="Cómo tratamos tu información" onPress={() => router.push("/privacy")} />
        </Card>

        <Card testID="settings-notifications">
          <T v="h3">Recordatorios</T>
          {!notificationsSupported ? (
            <View style={{ marginTop: spacing.md }}>
              <Notice tone="info" icon="phone-portrait-outline" title="Disponible en Android" body="Las notificaciones locales se programan en el dispositivo. La vista previa web no las admite." />
            </View>
          ) : perm && perm.status !== "granted" ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Notice testID="settings-notif-permission" tone="warning" icon="notifications-off-outline" title="Notificaciones desactivadas" body="Activá los permisos para recibir avisos antes de cada vencimiento. El resto de Subly funciona igual sin ellos." />
              {perm.canAskAgain ? (
                <Button testID="settings-notif-allow" small title="Permitir notificaciones" icon="notifications-outline" onPress={ask} />
              ) : (
                <Button testID="settings-notif-open-settings" small kind="secondary" title="Abrir ajustes del sistema" icon="open-outline" onPress={() => Linking.openSettings()} />
              )}
            </View>
          ) : null}
          <View style={{ marginTop: spacing.sm }}>
            {NOTIF.map((n, i) => (
              <View key={n.k}>
                {i ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
                  <T v="body" style={{ flex: 1 }}>{n.label}</T>
                  <Switch testID={`settings-notif-${n.k}`} value={st.settings.notifications[n.k]} onValueChange={(v) => { setPref(n.k, v); }} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
                </View>
              </View>
            ))}
          </View>
          <T v="caption" style={{ marginTop: spacing.sm }}>Los avisos se envían a las 9:00. Android puede demorarlos por ahorro de batería.</T>
        </Card>

        <View style={{ alignItems: "center", gap: 4, paddingVertical: spacing.md, borderRadius: radius.md }}>
          <T v="caption">Subly {Constants.expoConfig?.version ?? ""}</T>
          <T v="caption">Tus registros se guardan en este dispositivo.</T>
        </View>
      </ScrollView>
    </View>
  );
}
