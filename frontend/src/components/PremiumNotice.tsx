import { useRouter } from "expo-router";

import { useEntitlement } from "@/src/billing/entitlement.ts";

import { Button, Notice } from "./ui";

/** Explains premium gating (or development mode) without blocking access to data. */
export function PremiumNotice({ testID }: { testID: string }) {
  const e = useEntitlement();
  const router = useRouter();
  if (e.premium) return null;
  if (e.devUnlocked)
    return (
      <Notice testID={testID} tone="info" icon="construct-outline" title="Modo desarrollo" body="Google Play Billing todavía no está configurado. En compilaciones de desarrollo las funciones de edición quedan habilitadas para pruebas; en producción requieren la suscripción." />
    );
  return (
    <Notice testID={testID} tone="warning" icon="lock-closed-outline" title="Sin suscripción activa" body="Podés consultar y exportar tus datos. Para crear, editar o sincronizar necesitás Subly Premium.">
      <Button testID={`${testID}-cta`} small kind="primary" title="Ver Subly Premium" onPress={() => router.push("/premium")} style={{ marginTop: 8, alignSelf: "flex-start" }} />
    </Notice>
  );
}
