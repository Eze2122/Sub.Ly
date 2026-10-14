# Subly — PRD

## Problema original
App Android comercial "Subly — Tus pagos, bajo control.": gestión de suscripciones, servicios, facturas, vencimientos, pruebas gratuitas y gastos; Gmail OAuth (solo lectura, análisis en el dispositivo); almacenamiento local offline; recordatorios; estadísticas; monedas con conversión manual; CSV y copias cifradas; suscripción US$2/mes con 7 días gratis vía Google Play Billing validada por backend. Sin cuenta de Subly, sin anuncios, sin marca de Emergent. Las integraciones externas quedan con estado "pendiente" hasta tener credenciales reales.

## Decisiones del usuario
- Credenciales OAuth: aún no → flujo completo + "configuración pendiente" + guía.
- Billing: implementar + backend con estado pendiente.
- Gmail: heurísticas en el dispositivo.
- Copias: AES con contraseña del usuario.

## Arquitectura
Expo SDK 57 + expo-router; dominio puro en `src/domain`; store JSON versionado local; módulo nativo local AuthorizationClient (gmail.readonly); expo-iap; expo-notifications; expo-background-task; crypto-js; FastAPI backend (`/api/billing/config|verify|rtdn`, `/api/health`) + MongoDB (solo estado de suscripción por hash de token). Ver `docs/ARQUITECTURA.md`.

## Implementado (jun 2026)
- Identidad: icono adaptativo, splash navy, logo, tipografía Plus Jakarta Sans, sistema de diseño.
- Dashboard completo, Servicios (búsqueda/filtros/orden/vistas), detalle (confirmar pago, historial, cancelar, eliminar), formulario completo, Reportes, Ajustes, Monedas, Exportar/Copias, Gmail, Premium, Privacidad.
- Tests: frontend 13/13, backend 15/15, UI e2e (testing agent, iteración 3) OK.
- Docs: CONFIGURACION_GOOGLE.md, ESTADO_INTEGRACIONES.md, ARQUITECTURA.md, POLITICA_PRIVACIDAD.md, .env.example.

## Pendiente (externo)
- P0: Client ID OAuth Android + Gmail API + consentimiento; producto de suscripción y oferta 7 días en Play Console; cuenta de servicio Play; build Android y prueba real.
- P1: RTDN Pub/Sub; verificación OAuth de Google para alcance restringido; subir `docs/privacy.html` a GitHub Pages (la versión pública actual es genérica y no menciona gmail.readonly ni Limited Use).
- P2: sincronización entre dispositivos; widgets; tipos de cambio sugeridos.

## Cambios (jun 2026)
- Identificador Android definitivo `com.eze2122.subly` (app.json: android.package + scheme). Prebuild Android verificado (applicationId/namespace/scheme/app_name). iOS bundleIdentifier sin cambios.
- Auditoría pre-publicación: iOS bundleIdentifier unificado, icono de notificación monocromo, deps Expo parche actualizadas, prebuild + bundle Android verificados, regresión e2e OK.
- Iteración 3: OAuth nativo (modules/subly-google-auth, AuthorizationClient, solo gmail.readonly, sin Client ID/secretos en la app); política con Limited Use (docs/privacy.html para GitHub Pages); Alerta de ahorro (uso declarado por el usuario) en Reportes, formulario y detalle; CSV con "Uso declarado".
- Billing: IDs `subly_premium_monthly` / plan `monthly` / paquete `com.eze2122.subly` (defaults del servidor); app filtra la oferta por plan; servidor valida producto + plan + paquete; credencial por secreto `PLAY_SERVICE_ACCOUNT_JSON`; `httpx` y `google-auth` en requirements. Backend 22/22. Falta solo la clave de la cuenta de servicio y prueba real.
- Cierre iteración 3: verificado alcance único gmail.readonly (sin `email`, perfil vía users.getProfile); docs sin referencias al flujo por navegador; privacy.html fechado (junio 2026) y coherente con el código (desconexión/revocación, CSV, copias, Billing).
