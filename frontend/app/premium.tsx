import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { handlePurchase, obfuscatedAccountId, refreshEntitlement, useEntitlement } from "@/src/billing/entitlement.ts";
import { fetchOffer, onPurchase, openManageSubscription, purchase, type PlayOffer } from "@/src/billing/iap";
import { Logo } from "@/src/components/Logo";
import { useToast } from "@/src/components/Toast";
import { Button, IconButton, Ionicons, Notice, T } from "@/src/components/ui";
import { addDays, formatDate, todayISO } from "@/src/domain/dates.ts";
import { radius, spacing, useTheme } from "@/src/theme";

const BENEFITS: [string, string][] = [
  ["albums-outline", "Registros ilimitados de servicios, facturas y suscripciones"],
  ["mail-outline", "Detección automática desde Gmail con análisis en el dispositivo"],
  ["notifications-outline", "Recordatorios antes de cada vencimiento y fin de pruebas"],
  ["pie-chart-outline", "Estadísticas por categoría y moneda, sin anuncios"],
];

export default function Premium() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const ent = useEntitlement();
  const [offer, setOffer] = useState<PlayOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const productId = ent.config?.productId ?? null;

  useEffect(() => {
    if (!ent.config?.configured || !productId) return;
    setLoadingOffer(true);
    fetchOffer(productId).then(setOffer).catch(() => setOffer(null)).finally(() => setLoadingOffer(false));
  }, [ent.config?.configured, productId]);

  useEffect(() => onPurchase(
    async (p) => {
      const ok = await handlePurchase(p.purchaseToken, p.productId, p.raw);
      setBuying(false);
      toast(ok ? "Suscripción verificada. ¡Bienvenido a Subly Premium!" : "No pudimos verificar la compra.", ok ? "success" : "error");
    },
    (msg, cancelled) => {
      setBuying(false);
      toast(msg, cancelled ? "info" : "error");
    },
  ), [toast]);

  const buy = async () => {
    if (!offer || !productId) return;
    setBuying(true);
    try {
      await purchase(productId, offer.offerToken, await obfuscatedAccountId());
    } catch (e) {
      setBuying(false);
      toast(e instanceof Error ? e.message : "No se pudo iniciar la compra.", "error");
    }
  };
  const restore = async () => {
    setRestoring(true);
    await refreshEntitlement({ restore: true });
    setRestoring(false);
  };

  const firstCharge = offer?.trialDays ? addDays(todayISO(), offer.trialDays) : null;
  const notConfigured = ent.check === "not_configured" || (ent.config && !ent.config.configured);

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={32} />
        <IconButton testID="premium-close" tone="hero" icon="close" label="Cerrar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <T v="overline" style={{ color: colors.mintBright }}>Subly Premium</T>
          <T v="title" style={{ color: colors.onBrand }}>Tus pagos, bajo control.</T>
          <T v="body" style={{ color: colors.heroMuted }}>Una sola suscripción mensual. Sin anuncios, sin compras adicionales.</T>
        </View>
        <View style={{ gap: spacing.md }}>
          {BENEFITS.map(([i, txt]) => (
            <View key={txt} style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.heroCard, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={i as any} size={18} color={colors.mintBright} />
              </View>
              <T v="body" style={{ color: colors.onBrand, flex: 1 }}>{txt}</T>
            </View>
          ))}
        </View>

        <View testID="premium-status-card" style={{ backgroundColor: colors.heroCard, borderWidth: 1, borderColor: colors.heroBorder, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
          <T v="label" style={{ color: colors.heroMuted }}>Estado de tu suscripción</T>
          <T v="h3" testID="premium-status" style={{ color: colors.onBrand }}>
            {ent.premium
              ? ent.state === "trial" ? "Prueba gratuita activa" : ent.state === "grace" ? "Activa (período de gracia: revisá tu medio de pago)" : ent.state === "canceled_active" ? "Cancelada, activa hasta el vencimiento" : "Activa"
              : ent.state === "on_hold" ? "En espera: problema con el pago" : ent.state === "expired" ? "Vencida" : "Sin suscripción"}
          </T>
          {ent.expiryTime && ent.premium ? <T v="caption" style={{ color: colors.heroMuted }}>Acceso verificado hasta {formatDate(ent.expiryTime.slice(0, 10))}</T> : null}
          {ent.verifiedAt ? <T v="caption" style={{ color: colors.heroMuted }}>Última verificación con Google Play: {new Date(ent.verifiedAt).toLocaleString("es-AR")}</T> : null}
        </View>

        {notConfigured ? (
          <Notice testID="premium-not-configured" tone="warning" icon="construct-outline" title="Google Play Billing pendiente de configuración" body="Todavía no hay un producto de suscripción configurado en el servidor. No se pueden realizar compras ni se concede acceso premium hasta completar la configuración en Google Play Console." />
        ) : ent.check === "unavailable" ? (
          <Notice testID="premium-unavailable" tone="info" icon="logo-google-playstore" title="Disponible en la app de Google Play" body={ent.message ?? ""} />
        ) : ent.check === "offline" ? (
          <Notice testID="premium-offline" tone="info" icon="cloud-offline-outline" title="Sin conexión" body={ent.message ?? ""} />
        ) : ent.message ? (
          <Notice testID="premium-message" tone="info" icon="information-circle-outline" title="Aviso" body={ent.message} />
        ) : null}

        {offer && !ent.premium ? (
          <View testID="premium-offer" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 2, borderColor: colors.mintBright }}>
            <T v="h3">{offer.title}</T>
            <T v="h2" testID="premium-price">{offer.basePrice ?? "Precio no disponible"} <T v="body" color="muted">/ mes</T></T>
            {offer.trialDays ? <T v="bodyStrong" color="brandPrimary">{offer.trialDays} días de prueba gratuita</T> : null}
            <View style={{ gap: 4, marginTop: spacing.sm }}>
              {offer.trialDays ? <T v="caption">• La prueba comienza al confirmar la suscripción en Google Play.</T> : null}
              {firstCharge ? <T v="caption">• Primer cobro estimado: {formatDate(firstCharge)}, salvo que canceles antes.</T> : null}
              <T v="caption">• Renovación automática mensual al precio indicado por Google Play para tu país.</T>
              <T v="caption">• Cancelás cuando quieras desde Google Play › Suscripciones; mantenés el acceso hasta el fin del período.</T>
              <T v="caption">• Si la suscripción termina, conservás tus datos y podés consultarlos y exportarlos.</T>
            </View>
          </View>
        ) : null}
        {loadingOffer ? <T v="caption" style={{ color: colors.heroMuted }}>Consultando la oferta en Google Play…</T> : null}

        {!ent.premium ? (
          <Button testID="premium-buy-button" kind="hero" title={offer?.trialDays ? `Comenzar ${offer.trialDays} días gratis` : "Suscribirme"} icon="diamond-outline" disabled={!offer} loading={buying} onPress={buy} />
        ) : null}
        <Button testID="premium-restore-button" kind="secondary" title="Recuperar compras" icon="refresh" loading={restoring} onPress={restore} />
        {ent.premium && productId ? (
          <Button testID="premium-manage-button" kind="secondary" title="Gestionar en Google Play" icon="open-outline" onPress={() => openManageSubscription(productId, ent.config?.packageName ?? Constants.expoConfig?.android?.package ?? "")} />
        ) : null}
        <T v="caption" style={{ color: colors.heroMuted, textAlign: "center" }}>Los pagos los procesa Google Play. Subly nunca solicita ni guarda datos de tarjetas.</T>
      </ScrollView>
    </View>
  );
}
