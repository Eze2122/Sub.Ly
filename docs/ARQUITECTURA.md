# Subly — Arquitectura, instalación y compilación

## Estructura
```
frontend/                      Expo SDK 57 (React Native 0.86, expo-router)
  app/                         Pantallas (rutas)
    (tabs)/index|services|reports|settings.tsx
    service/form.tsx, service/[id].tsx, gmail.tsx, premium.tsx,
    currencies.tsx, backup.tsx, privacy.tsx
  src/domain/                  Lógica de negocio PURA (testeable con node --test)
    types, dates (vencimientos, fin de mes, bisiestos), money (centavos, conversión),
    operations (CRUD, pagos, restauración, migraciones), stats, reminders,
    gmailParser (heurísticas), backup (CSV + cifrado)
  src/data/                    Persistencia local (store.ts) + acciones con control premium
  src/gmail/                   Autorización (usa modules/subly-google-auth), Gmail API + sincronización, tarea diaria
modules/subly-google-auth/     Módulo nativo Android local (AuthorizationClient, gmail.readonly)
  src/billing/                 expo-iap (Play Billing) + entitlement verificado por backend
  src/services/                Notificaciones locales, archivos (compartir/elegir)
  src/components/              Sistema de diseño (ui, Sheet, Toast, charts, calendario)
  src/theme.ts                 Tokens de color/tipografía/espaciado
backend/server.py              FastAPI: /api/billing/config, /verify, /rtdn, /health
backend/tests/                 pytest
docs/                          Configuración, estado, privacidad
```

## Decisiones técnicas
- **Persistencia**: documento JSON versionado (`schemaVersion`) guardado de forma atómica mediante el almacenamiento local del dispositivo (AsyncStorage en Android, SQLite nativo). Escrituras serializadas en cola; si una escritura falla se revierte el estado en memoria. Migraciones en `operations.migrate`. Funciona sin internet. Importes en centavos enteros; fechas como fechas de calendario `YYYY-MM-DD`.
- **Datos sensibles**: los permisos de Gmail los administran los servicios de Google Play (AuthorizationClient); Subly no guarda tokens de Google de forma permanente ni usa refresh tokens. El estado verificado de la suscripción y el token de compra de Play se guardan en `expo-secure-store` (Android Keystore). `android.allowBackup=false` evita que el backup automático de Android copie la base local sin cifrar.
- **Copias**: PBKDF2-SHA256 (60.000 iteraciones, sal aleatoria de 16 bytes) → claves AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC), IV aleatorio, versión de formato, verificación de integridad antes de descifrar. La contraseña no se guarda. Si se pierde, no hay recuperación.
- **Gmail**: búsqueda por palabras clave, 12 meses (máx. 400 mensajes) la primera vez; luego incremental con `after:` + IDs procesados. Cuerpos procesados en memoria y descartados. Alta confianza (≥0,8, recurrencia + importe + fecha) → registro automático; resto → sugerencia para confirmar/corregir/descartar. Dedupe por `sourceRef` (remitente), nombre normalizado e IDs de mensaje.
- **Premium**: concedido solo con verificación del backend contra Google Play; el dispositivo guarda el último resultado verificado y lo respeta hasta su `expiryTime` (sin conexión no se borra nada ni se bloquea la exportación).
- **Sin cuenta de Subly**: no hay registro ni login.

## Ejecutar
```
# Backend
cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8001
# Frontend (vista previa)
cd frontend && yarn install && yarn start
# Tests
cd frontend && node --test src/__tests__/domain.test.ts
cd backend && python -m pytest tests
```

## Compilar APK/AAB
Identificador Android: `com.eze2122.subly` (`app.json`). El proyecto usa Continuous Native Generation: no hay carpetas `android/` ni `ios/` versionadas; se generan en cada compilación a partir de `app.json`, así que no hay archivos nativos que regenerar a mano. Cualquier compilación previa con el identificador anterior se instala como **otra app**: hace falta una compilación nueva.
Gmail OAuth, Billing, tareas en segundo plano y notificaciones requieren una **compilación nativa** (no Expo Go).
1. Configurá las variables (ver `.env.example`).
2. En Emergent: botón **Publish** (arriba a la derecha) → generar compilación Android (APK para pruebas internas, AAB para Play Console).
3. Instalá el APK, verificá icono adaptativo (fondo navy, símbolo de renovación con check menta), splash (navy + símbolo + "Subly" + detalle menta) y recorré `docs/ESTADO_INTEGRACIONES.md`.

## Limitaciones conocidas
- No hay sincronización entre dispositivos (los datos viven en el teléfono; usá copias cifradas para migrar).
- La detección de Gmail es heurística: formatos inusuales pueden no detectarse o requerir corrección.
- Android puede postergar la sincronización diaria y los recordatorios (Doze/ahorro de batería).
- Los tipos de cambio son manuales.
- Con la pantalla de consentimiento en modo *Prueba*, la autorización de Google puede caducar a los 7 días; la app pide volver a autorizar ("reauth").
- La vista web es solo para previsualizar la interfaz: sin Gmail, Billing ni notificaciones.

## Tareas externas pendientes
Ver lista en `docs/ESTADO_INTEGRACIONES.md`.
