# Configuración de Google para Sub.Ly (Gmail OAuth nativo y Play Billing)

> Ningún valor de este documento es una credencial real. Gmail OAuth **no fue probado todavía en un dispositivo real**.

## Arquitectura de autorización (Android)
| Pieza | Implementación | Credencial |
|---|---|---|
| Autorización Gmail | Módulo local `frontend/modules/subly-google-auth` (Kotlin) con **Google Identity Services `AuthorizationClient`** (`play-services-auth` 21.4.0), el método recomendado por Google para Android | **Cliente OAuth tipo Android** en Google Cloud (paquete + SHA-1). **No** hay Client ID, secreto ni URI de redirección en la app |
| Lectura de Gmail | El teléfono llama a `gmail.googleapis.com` con un access token de corta duración (solo en memoria) | Gmail API habilitada |
| Renovación | `authorize()` silencioso vía Google Play services; ante 401 se limpia el token en caché (`GoogleAuthUtil.clearToken`) y se reintenta una vez | — |
| Revocación | `POST https://oauth2.googleapis.com/revoke` + limpieza de caché local | — |

Permiso único solicitado: `https://www.googleapis.com/auth/gmail.readonly`. El correo de la cuenta se obtiene con `users.getProfile` de Gmail (cubierto por ese permiso); ya **no** se solicita `email`. No se necesita cliente Web, orígenes JavaScript ni esquema de URI personalizado (el flujo anterior por navegador fue eliminado).

## Pasos en Google Cloud (se pueden hacer desde el navegador del teléfono)
1. Crear/seleccionar proyecto → *APIs y servicios → Biblioteca* → habilitar **Gmail API** (y *Google Play Android Developer API* para Billing).
2. *Google Auth Platform → Branding*: nombre **Sub.Ly** (mismo nombre que en la política), correo de soporte, página de inicio `https://eze2122.github.io/-subly-privacy/index.html`, política `https://eze2122.github.io/-subly-privacy/privacy.html`, dominio autorizado `eze2122.github.io` (verificalo en Google Search Console).
3. *Audience*: Externo, estado **Testing**, agregá tu cuenta en **Usuarios de prueba**.
4. *Data Access*: agregá solo `.../auth/gmail.readonly` (alcance restringido).
5. *Clients → Crear cliente → Android*: paquete `com.eze2122.subly` + **SHA-1** real de la firma del APK que vas a instalar. Creá un cliente por cada firma (compilación de prueba de Emergent y, más adelante, la clave de firma de Google Play). No hace falta copiar el Client ID a la app.

## Obtener la SHA-1 (requiere la compilación final autorizada)
- `apksigner verify --print-certs subly.apk` (línea `SHA-1 digest`) o `keytool -printcert -jarfile subly.apk`.
- O pedir el certificado de firma de la compilación a support@emergent.sh.
- App publicada en Play: Play Console → Integridad de la app → certificado de la clave de firma.

## Dónde se configura cada dato
| Dato | Lugar |
|---|---|
| Paquete | `frontend/app.json` → `android.package` = `com.eze2122.subly` |
| Permiso Gmail | `frontend/modules/subly-google-auth/android/.../SublyGoogleAuthModule.kt` y `frontend/src/gmail/oauth.ts` |
| SHA-1 / cliente Android | Solo en Google Cloud |
| Producto de suscripción y validación | Backend: `PLAY_SUBSCRIPTION_ID`, `PLAY_PACKAGE_NAME`, `PLAY_SERVICE_ACCOUNT_FILE` |

## Prueba real (en el teléfono, con la compilación instalada)
1. Ajustes → Conexión con Gmail → **Conectar con Google** → elegir la cuenta de prueba → aceptar lectura de Gmail.
2. Verificar estado "Conectado" con tu correo, fecha de última sincronización y registros/sugerencias reales.
3. *Sincronizar ahora*; luego *Desconectar* (conservar y eliminar) y comprobar en myaccount.google.com/connections que el acceso desaparece.

## Diagnóstico
| Mensaje en la app / código | Causa |
|---|---|
| "Configuración pendiente en Google Cloud" (`DEVELOPER_ERROR`) | Falta el cliente Android, la SHA-1 no coincide con el APK instalado, Gmail API deshabilitada o la cuenta no es usuario de prueba |
| "Cancelaste la autorización" (`CANCELED`) | El usuario cerró la pantalla de Google |
| "No otorgaste el permiso de lectura" (`SCOPE_DENIED`) | Se rechazó el permiso de Gmail |
| "Necesitás volver a autorizar" (`INTERACTION_REQUIRED`, 401/403) | Acceso revocado o caducado; en modo Testing Google puede exigir reautorizar a los 7 días |
| "Requiere compilación Android" | Expo Go / web: el módulo nativo no existe ahí |

## Verificación para producción
`gmail.readonly` es restringido: para más de 100 usuarios, Google exige verificación OAuth (política pública con la declaración de *Limited Use*, dominio verificado, video de demostración) y puede pedir una evaluación de seguridad. La decisión es de Google.

# Google Play Billing

1. **Play Console** → crear app con el paquete definitivo → subir un AAB a una pista de prueba interna (Billing requiere una versión subida).
2. *Monetizar → Productos → Suscripciones* → crear suscripción (ID a elección, p. ej. `subly_premium_mensual`) → **plan base mensual con renovación automática**, precio **US$ 2** y precios regionales (Play convierte o los fijás vos).
3. En el plan base, crear **oferta de prueba gratuita de 7 días** (fase gratuita P7D) para nuevos clientes. Recomendado: etiqueta de oferta `trial` (Subly la usa para mostrar "Prueba gratuita activa").
4. Configurá **cuentas de prueba de licencias** (*Configuración → Pruebas de licencias*).
5. Copiá el ID real a `PLAY_SUBSCRIPTION_ID` y el paquete a `PLAY_PACKAGE_NAME`.

### Google Play Developer API (backend)
1. En Google Cloud, habilitá *Google Play Android Developer API*.
2. Creá una **cuenta de servicio** sin roles de proyecto; generá una clave JSON y guardala **solo** en el servidor (`PLAY_SERVICE_ACCOUNT_FILE`).
3. Play Console → *Usuarios y permisos → Invitar usuario* → email de la cuenta de servicio → permisos de la app: **Ver información financiera** y **Gestionar pedidos y suscripciones** (mínimo necesario).
4. Puede tardar hasta 24 h en propagarse.

### RTDN (opcional, recomendado)
1. Pub/Sub → crear tema `projects/<proyecto>/topics/subly-rtdn`; dar rol *Publicador* a `google-play-developer-notifications@system.gserviceaccount.com`.
2. Crear suscripción **push** a `https://<tu-backend>/api/billing/rtdn` con **autenticación** habilitada (cuenta de servicio de push, audiencia = `PUBSUB_AUDIENCE`).
3. Play Console → *Monetizar → Configuración de monetización* → tema de RTDN → *Enviar notificación de prueba*.

### Verificación
- `GET /api/billing/config` debe devolver `"configured": true`.
- Con una cuenta de prueba: Premium → la app muestra precio y prueba **leídos de Google Play** → comprar → el backend responde `entitled: true` → reinstalar → *Recuperar compras* restaura el acceso.
- Una compra cancelada sigue activa hasta `expiryTime`; luego la app bloquea edición pero mantiene consulta y exportación.
