# Estado de integraciones de Subly

Fecha: junio 2026. Estado **honesto**: nada externo está declarado como operativo sin prueba real.

| Integración | Código | Configuración externa | Probado con credenciales reales |
|---|---|---|---|
| Gmail OAuth nativo (`AuthorizationClient`, solo `gmail.readonly`) | Implementado (`frontend/modules/subly-google-auth`, `frontend/src/gmail/oauth.ts`) | **Pendiente**: cliente OAuth Android (paquete + SHA-1), consentimiento en Testing | **No** (no compilado ni probado en dispositivo) |
| Gmail API (lectura, análisis 12 meses, incremental, sugerencias, dedupe) | Implementado (`frontend/src/gmail/sync.ts`, `src/domain/gmailParser.ts`) | **Pendiente**: Gmail API habilitada + consentimiento | **No** (heurísticas probadas con correos simulados en tests unitarios) |
| Sincronización diaria (WorkManager vía `expo-background-task`) | Implementado (`frontend/src/gmail/background.ts`) | Requiere compilación Android | **No** |
| Google Play Billing (`expo-iap`) | Implementado (`frontend/src/billing/iap.ts`, `app/premium.tsx`) | **Pendiente**: producto + oferta en Play Console | **No** |
| Backend de validación (`subscriptionsv2.get`, acknowledge, RTDN) | Implementado (`backend/server.py`) | **Pendiente**: cuenta de servicio, `PLAY_*`, Pub/Sub | **No** (lógica probada con respuestas simuladas) |
| Notificaciones locales | Implementado (`frontend/src/services/notifications.ts`) | Permiso del usuario | Planificación probada en tests; entrega real requiere dispositivo |
| Base local, CRUD, vencimientos, monedas, estadísticas, CSV, copias cifradas | Implementado | Ninguna | **Sí** (tests automatizados + pruebas de UI) |

## Comportamiento mientras falta configuración
- Gmail: muestra "Configuración pendiente" y deshabilita *Conectar con Google*. Web: "Disponible en Android".
- Billing: `GET /api/billing/config` → `configured:false`; `POST /api/billing/verify` → 503. La app **no** simula compras ni concede premium.
- **Modo desarrollo**: solo en compilaciones de desarrollo (`__DEV__`) y solo si el backend reporta Billing no configurado, se habilitan las funciones de edición para poder probar, con un aviso visible. En una compilación de producción (`__DEV__ = false`) las funciones premium quedan bloqueadas hasta verificar una suscripción real.

## Datos que todavía tenés que proporcionar
| Dato | Dónde se configura |
|---|---|
| Nombre de paquete definitivo: **`com.eze2122.subly`** (ya configurado) | `frontend/app.json` → `android.package`, `scheme` |
| Variable del backend con el mismo paquete | `backend/.env` o secretos → `PLAY_PACKAGE_NAME=com.eze2122.subly` |
| SHA-1 / SHA-256 de las firmas | Google Cloud → cliente OAuth Android |
| Cliente OAuth Android (paquete + SHA-1) | Solo en Google Cloud; la app no necesita Client ID |
| Política pública: https://eze2122.github.io/-subly-privacy/privacy.html (subir `docs/privacy.html` actualizado) | Pantalla de consentimiento OAuth y ficha de Play |
| ID del producto de suscripción | `backend/.env` → `PLAY_SUBSCRIPTION_ID` |
| Paquete para validación | `backend/.env` → `PLAY_PACKAGE_NAME` |
| Clave JSON de la cuenta de servicio | Secreto del despliegue `PLAY_SERVICE_ACCOUNT_JSON` (JSON o base64); nunca en el repo. Alternativa: `PLAY_SERVICE_ACCOUNT_FILE` |
| Pub/Sub (opcional) | `PUBSUB_AUDIENCE`, `PUBSUB_PUSH_SERVICE_ACCOUNT` |
| URL definitiva del backend (HTTPS) | `EXPO_PUBLIC_BACKEND_URL` (Emergent la asigna al publicar) |

## Pasos para completar y verificar
Ver `docs/CONFIGURACION_GOOGLE.md` (secciones 1–12 y Google Play Billing).

## Pruebas ejecutadas
### Automatizadas (ejecutadas)
- `cd frontend && node --test src/__tests__/domain.test.ts` → **12/12 OK**: CRUD; vencimientos de todas las frecuencias; fin de mes y bisiestos; confirmar pago y próximo vencimiento; atrasos/hoy/prueba/cancelado; factura ≠ pago; validación; parseo de importes; no mezclar monedas; conversión directa/inversa y tasa 0; CSV UTF-8 con BOM y sin tokens; copia cifrada (ida y vuelta, contraseña incorrecta, alteración, archivo corrupto, sin email/IDs de Gmail); restauración sin duplicados; migración de esquema v1→v2; detección Gmail (importes ARS/USD/BRL, recurrencia, descarte de promociones); plan de recordatorios sin duplicados y sin cancelados.
- `cd backend && python -m pytest tests` → **15/15 OK**: config pendiente, 503 sin configurar, validación de entrada, token falsificado rechazado (403), producto incorrecto (400/403), RTDN sin auth (401), evaluación de estados (activa, gracia, cancelada vigente, vencida, en espera, prueba).
### UI (vista previa web)
- Ver sección "Resultados del agente de pruebas" más abajo.
### No ejecutables sin credenciales/dispositivo
OAuth real, lectura real de Gmail, compras y restauración en Google Play, RTDN, entrega real de notificaciones, WorkManager, icono/splash en APK instalado (los recursos están generados e integrados en `app.json`; verificar en la primera compilación).

## Resultados del agente de pruebas (UI web 390x844, iteración 1)
Todos los flujos probados pasaron: estado vacío sin datos ficticios; alta de servicio (importe `15.990,50`), validaciones; totales ARS y USD separados; confirmar pago (13 oct → 13 nov + historial); cancelar/reactivar/eliminar con hojas de confirmación; estado Atrasado; búsqueda y filtros; reportes con aviso de tipo de cambio faltante y total convertido tras cargar USD→ARS; preferencias de notificación; Gmail y Premium muestran "pendiente de configuración" sin simular conexión/compra; CSV y validaciones de contraseña de copias; persistencia tras recargar; sin marca de Emergent. Backend: health, config, verify 503/422.

## Auditoría previa a publicación (iteración 2)
- Identificador `com.eze2122.subly` en `android.package`, `ios.bundleIdentifier` y `scheme`; prebuild Android local OK (applicationId/namespace correctos, `allowBackup=false`, permisos innecesarios removidos, icono de notificación monocromo).
- Bundle JavaScript de Android exportado sin errores (`expo export --platform android --no-bytecode`). El paso de bytecode Hermes no se pudo ejecutar en este contenedor (arquitectura aarch64 vs. binario x86-64); no es un problema del proyecto, pero solo se confirma en la compilación real.
- Dependencias alineadas con Expo SDK 57 (`expo install --check` OK). TypeScript sin errores. Tests: frontend 12/12, backend 15/15, UI e2e (agente de pruebas) OK.
- Sin referencias al paquete anterior ni recursos de Emergent en código, recursos ni bundle.

## Cambios (iteración 3)
- OAuth por navegador (expo-auth-session, esquema personalizado) reemplazado por módulo nativo con `AuthorizationClient`; permiso `email` eliminado. Dependencia `expo-auth-session` removida.
- Política reescrita (`docs/privacy.html`, `docs/POLITICA_PRIVACIDAD.md`, pantalla en la app desde `src/domain/privacyPolicy.ts`) con declaración Limited Use.
- Alerta de ahorro en Reportes basada solo en el uso declarado por el usuario.
- El código Kotlin del módulo **no se compiló** (sin compilación autorizada); se verificará en la compilación final.
