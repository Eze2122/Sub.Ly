# Configuración de Google para Subly (OAuth, Gmail API, Play Billing)

> Ningún valor de este documento es una credencial real. Donde aparece `<...>` debés reemplazarlo por el valor de **tu** proyecto.

## Arquitectura real (determina qué credenciales se necesitan)

| Pieza | Tecnología | Credencial necesaria |
|---|---|---|
| App Android | Expo SDK 57 / React Native, `expo-auth-session` (OAuth 2.0 Authorization Code + **PKCE**) | **Client ID OAuth de tipo Android** (público). **No** usa client secret. |
| Lectura de Gmail | Llamadas directas del dispositivo a `gmail.googleapis.com` con el access token | Gmail API habilitada en el proyecto de Google Cloud |
| Validación de compras | Backend FastAPI → Google Play Developer API `purchases.subscriptionsv2.get` | **Cuenta de servicio** (secreta, solo backend) vinculada a Play Console |
| Notificaciones de suscripción (opcional) | Pub/Sub push autenticado → `POST /api/billing/rtdn` | Tema Pub/Sub + cuenta de servicio de push |

**No se necesita un cliente OAuth "Web"**: la versión web de la vista previa no conecta Gmail (Google exige client secret para clientes web, y no debe incluirse en una app). Por lo tanto **no hay orígenes JavaScript autorizados que registrar**.

## 1. APIs a habilitar en Google Cloud
En [console.cloud.google.com](https://console.cloud.google.com) → *APIs y servicios → Biblioteca*:
1. **Gmail API** (para la lectura de correos).
2. **Google Play Android Developer API** (para validar suscripciones desde el backend).
3. **Cloud Pub/Sub API** (solo si usás RTDN).

## 2. Pantalla de consentimiento OAuth
*APIs y servicios → Pantalla de consentimiento de OAuth* (Google Auth Platform):
1. Tipo de usuario **Externo**.
2. Nombre de la app: **Subly**; correo de soporte; logotipo de Subly (opcional, requiere verificación de marca).
3. Dominio de la página de inicio y **URL de la política de privacidad** (obligatoria para alcances restringidos). Usá la política de `docs/POLITICA_PRIVACIDAD.md` publicada en un dominio **que controles** (no registres dominios que todavía no existen).
4. Alcances: agregá **solo** `https://www.googleapis.com/auth/gmail.readonly` y `email` (para mostrar la cuenta conectada).
5. Mientras la app esté en *Prueba*, agregá las cuentas de Gmail de prueba en **Usuarios de prueba** (máx. 100).

## 3. Nombre de paquete Android definitivo
- Identificador definitivo: **`com.eze2122.subly`**, en `frontend/app.json` → `expo.android.package`. El segundo valor de `expo.scheme` es el mismo identificador (se usa como esquema de redirección OAuth).
- Usalo exactamente igual al crear la app en Play Console y el cliente OAuth Android. Después de publicar en Google Play **no puede modificarse**.
- `ios.bundleIdentifier` no se modificó (Subly apunta a Android). Si más adelante publicás en iOS, definilo aparte.

## 4. Huellas SHA-1 y SHA-256
Se necesitan para el cliente OAuth Android (SHA-1) y es recomendable registrar ambas.
- **Compilaciones generadas con Publish (Emergent/EAS):** la firma la gestiona la plataforma. Después de generar la compilación Android, pedí las credenciales de firma (keystore) desde el panel de compilación o a support@emergent.sh, y obtené la huella con `keytool -list -v -keystore <archivo.jks> -alias <alias>` (líneas `SHA1:` y `SHA256:`).
- **Desde el APK instalable de prueba** (sin acceso al keystore): `apksigner verify --print-certs subly.apk` (Android SDK build-tools) o `keytool -printcert -jarfile subly.apk`. Esta es la huella del APK que vas a instalar para probar Gmail OAuth.
- **App publicada en Google Play:** Play Console → *Prueba y lanzamiento → Configuración → Integridad de la app → Certificado de la clave de firma de apps*. Esa es la huella que ve el usuario final; registrala también.
- Si usás compilaciones locales: `cd android && ./gradlew signingReport`.
Creá **un cliente Android por cada huella** (debug/upload/app-signing) que vayas a usar.

## 5. Cliente OAuth para Android
*APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth → Android*:
1. Nombre del paquete: el de `app.json`.
2. Huella SHA-1 del certificado correspondiente.
3. En **Configuración avanzada**, activá **"Habilitar esquema de URI personalizado"** (Google lo deshabilita por defecto en clientes nuevos; Subly usa el esquema `<paquete>:/oauth2redirect`).
4. Copiá el *Client ID* (formato `NUMERO-xxxx.apps.googleusercontent.com`).

## 6. ¿Cliente OAuth web?
No es necesario para esta arquitectura (ver tabla inicial). No crearlo evita exponer un client secret.

## 7. URI de redirección
- Valor real: **`<android.package>:/oauth2redirect`** → hoy: `com.eze2122.subly:/oauth2redirect`.
- Los clientes Android no tienen campo de "URI autorizados": Google valida paquete + firma + esquema personalizado. No hay orígenes JavaScript.

## 8. Permisos de Gmail y justificación
| Alcance | Motivo |
|---|---|
| `gmail.readonly` | Buscar y leer facturas, recibos, renovaciones y pruebas gratuitas para crear registros. Subly **no** envía, borra ni modifica correos. `gmail.metadata` no alcanza porque los importes y fechas están en el cuerpo del mensaje. |
| `email` | Mostrar qué cuenta está conectada. |

## 9. Verificación y revisiones de Google
- `gmail.readonly` es un **alcance restringido**. Para publicar a más de 100 usuarios: verificación de la app OAuth (dominio, política de privacidad, video demostrativo del uso del permiso) y, como los datos se procesan en el dispositivo y no se almacenan en servidores, normalmente aplica la evaluación de "Limited Use"; Google puede exigir una **evaluación de seguridad (CASA)** si los datos restringidos llegaran a un servidor. Los plazos los define Google (semanas).
- Play Console: completar *Seguridad de los datos* declarando datos financieros y correos procesados en el dispositivo.

## 10. Dónde se configura cada identificador
| Dato | Archivo / lugar |
|---|---|
| Client ID Android | `frontend/.env` → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (o secreto de despliegue con el mismo nombre). Leído en `frontend/src/gmail/oauth.ts`. |
| Paquete Android / esquema | `frontend/app.json` → `android.package` y `scheme` |
| ID de producto de suscripción | Backend: `PLAY_SUBSCRIPTION_ID` (`backend/.env` o secretos). La app lo obtiene de `GET /api/billing/config`. |
| Paquete para validación | Backend: `PLAY_PACKAGE_NAME` |
| Cuenta de servicio Play | Backend: `PLAY_SERVICE_ACCOUNT_FILE` (ruta a JSON fuera del repo) |
| RTDN | Backend: `PUBSUB_AUDIENCE`, `PUBSUB_PUSH_SERVICE_ACCOUNT` |

## 11. Prueba real de conexión y lectura
1. Configurá el Client ID y generá una **compilación Android** (Publish → build). Expo Go **no** sirve para OAuth con esquema propio ni para Billing.
2. Instalá el APK con una cuenta listada como *usuario de prueba*.
3. Ajustes → Conexión con Gmail → *Conectar con Google* → elegir cuenta → aceptar permiso de lectura.
4. Verificá: estado "Conectado" con el email, "Última sincronización" con fecha, y registros/sugerencias creados a partir de correos reales (por ejemplo, un recibo de una suscripción conocida).
5. Probá *Sincronizar ahora*, *Desconectar* (conservar y eliminar) y que el acceso desaparezca en `myaccount.google.com/connections`.

## 12. Diagnóstico de errores
| Error | Causa probable |
|---|---|
| `redirect_uri_mismatch` / `invalid_request` "Custom URI scheme is not enabled" | Esquema personalizado deshabilitado en el cliente Android, o `scheme` de `app.json` ≠ paquete. |
| `unauthorized_client` / `invalid_client` | Client ID de otro tipo (web/iOS) o SHA-1 que no coincide con la firma del APK instalado. |
| `access_denied` | El usuario rechazó, o la cuenta no está en *Usuarios de prueba*. |
| `403 insufficientPermissions` en Gmail | Gmail API no habilitada o alcance no concedido. Subly muestra "Necesitás volver a autorizar". |
| `invalid_grant` al refrescar | Token revocado o caducado (apps en modo *Prueba* caducan refresh tokens a los 7 días). La app pide reautorizar. |
| `429` | Cuota de Gmail API; reintentar luego. |

---

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
