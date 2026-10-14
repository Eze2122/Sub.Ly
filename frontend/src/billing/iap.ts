// Thin wrapper over expo-iap (Google Play Billing). The native module only exists in
// development/production builds; in Expo Go it is absent and `iapAvailable()` is false.
import { Platform } from "react-native";

let IAP: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  IAP = Platform.OS === "android" ? require("expo-iap") : null;
} catch {
  IAP = null;
}

let connected = false;

export function iapAvailable() {
  return !!IAP;
}

export async function connect() {
  if (!IAP) return false;
  if (connected) return true;
  try {
    connected = !!(await IAP.initConnection());
  } catch {
    connected = false;
  }
  return connected;
}

export type PlayOffer = {
  productId: string;
  title: string;
  basePrice: string | null;
  trialDays: number | null;
  offerToken: string;
  offerId: string | null;
};

function periodDays(iso: string) {
  const m = iso.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 365 + Number(m[2] ?? 0) * 30 + Number(m[3] ?? 0) * 7 + Number(m[4] ?? 0);
}

/** Reads the real offer of the given base plan from Google Play (price + optional free trial). */
export async function fetchOffer(productId: string, basePlanId: string): Promise<PlayOffer | null> {
  if (!(await connect())) return null;
  const products = await IAP.fetchProducts({ skus: [productId], type: "subs" });
  const p = (products ?? []).find((x: any) => x.id === productId);
  if (!p) return null;
  // Only offers of the configured base plan; Play returns only offers the user is eligible for.
  const offers: any[] = (p.subscriptionOffers ?? []).filter((o: any) => o.basePlanIdAndroid === basePlanId);
  const withTrial = offers.find((o) => (o.pricingPhasesAndroid?.pricingPhaseList ?? []).some((ph: any) => Number(ph.priceAmountMicros) === 0));
  const chosen = withTrial ?? offers.find((o) => o.id === basePlanId) ?? offers[0];
  if (!chosen?.offerTokenAndroid) return null;
  const phases: any[] = chosen.pricingPhasesAndroid?.pricingPhaseList ?? [];
  const free = phases.find((ph) => Number(ph.priceAmountMicros) === 0);
  const paid = [...phases].reverse().find((ph) => Number(ph.priceAmountMicros) > 0);
  return {
    productId,
    title: p.title ?? p.displayName ?? "Subly Premium",
    basePrice: paid?.formattedPrice ?? p.displayPrice ?? null,
    trialDays: free ? periodDays(free.billingPeriod) : null,
    offerToken: chosen.offerTokenAndroid,
    offerId: chosen.id ?? null,
  };
}

export async function purchase(productId: string, offerToken: string, obfuscatedAccountId: string) {
  if (!(await connect())) throw new Error("Google Play Billing no está disponible en esta compilación.");
  await IAP.requestPurchase({
    type: "subs",
    request: { google: { skus: [productId], subscriptionOffers: [{ sku: productId, offerToken }], obfuscatedAccountId } },
  });
}

export function onPurchase(cb: (p: { purchaseToken: string; productId: string; raw: any }) => void, onError: (msg: string, cancelled: boolean) => void) {
  if (!IAP) return () => undefined;
  const a = IAP.purchaseUpdatedListener((p: any) => {
    if (p?.purchaseToken) cb({ purchaseToken: p.purchaseToken, productId: p.productId ?? p.id, raw: p });
  });
  const b = IAP.purchaseErrorListener((e: any) => {
    const cancelled = String(e?.code ?? "").toLowerCase().includes("cancel");
    onError(cancelled ? "Compra cancelada." : "No se pudo completar la compra.", cancelled);
  });
  return () => {
    a?.remove?.();
    b?.remove?.();
  };
}

export async function finish(raw: any) {
  if (!IAP) return;
  try {
    await IAP.finishTransaction({ purchase: raw, isConsumable: false });
  } catch {
    // acknowledgement is also performed server-side
  }
}

export async function ownedPurchases(productId: string): Promise<{ purchaseToken: string; raw: any }[]> {
  if (!(await connect())) return [];
  const list = await IAP.getAvailablePurchases();
  return (list ?? [])
    .filter((p: any) => (p.productId ?? p.id) === productId && p.purchaseToken)
    .map((p: any) => ({ purchaseToken: p.purchaseToken, raw: p }));
}

export async function openManageSubscription(productId: string, packageName: string) {
  if (!(await connect())) return false;
  await IAP.deepLinkToSubscriptions({ skuAndroid: productId, packageNameAndroid: packageName });
  return true;
}
