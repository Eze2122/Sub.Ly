// Google Play Billing is not available on web.
export function iapAvailable() {
  return false;
}
export async function connect() {
  return false;
}
export type PlayOffer = { productId: string; title: string; basePrice: string | null; trialDays: number | null; offerToken: string; offerId: string | null };
export async function fetchOffer(_id: string, _basePlanId: string): Promise<PlayOffer | null> {
  return null;
}
export async function purchase(_a: string, _b: string, _c: string) {
  throw new Error("Google Play Billing solo está disponible en Android.");
}
export function onPurchase(_cb: unknown, _err: unknown) {
  return () => undefined;
}
export async function finish(_raw: unknown) {}
export async function ownedPurchases(_id: string): Promise<{ purchaseToken: string; raw: any }[]> {
  return [];
}
export async function openManageSubscription(_a: string, _b: string) {
  return false;
}
