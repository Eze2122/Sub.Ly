# Política de privacidad de Subly (versión inicial 1.0)

> Texto inicial coherente con el comportamiento actual de la app. Revisalo con asesoramiento legal antes de publicarlo en un dominio propio.

## Resumen
Subly es una app para organizar suscripciones, servicios y pagos. No requiere crear una cuenta. Tus registros se guardan en tu dispositivo.

## Datos que guardás
Nombre del servicio, categoría, importes, monedas, fechas, estados, notas personales, pagos confirmados, tipos de cambio y preferencias. Se almacenan localmente en el dispositivo y no se suben automáticamente a ningún servidor.

## Conexión opcional con Gmail
Si la activás, Subly usa Google OAuth con el permiso de solo lectura (gmail.readonly) para buscar facturas, recibos, renovaciones y pruebas gratuitas de los últimos 12 meses. El contenido de los correos se procesa en memoria en tu dispositivo y se descarta. Solo se conservan los datos extraídos (nombre, importe, moneda, fechas) y los identificadores técnicos de mensajes necesarios para evitar duplicados. Los mensajes viajan directamente entre tu dispositivo y los servidores de Google; no pasan por servidores de Subly. Los tokens de acceso se guardan cifrados en el almacenamiento seguro del sistema.

## Desconexión de Gmail
Podés desconectar Gmail en cualquier momento. Subly solicita a Google la revocación del acceso y borra las credenciales del dispositivo. Elegís si conservar o eliminar los registros detectados; los registros manuales no se modifican. También podés revisar los accesos en tu cuenta de Google.

## Suscripción y Google Play Billing
La suscripción se contrata y cobra a través de Google Play. Subly no recibe ni guarda datos de tarjetas. Para validar la suscripción, la app envía al servidor de Subly el token de compra de Google Play y un identificador anónimo de instalación (hash). El servidor consulta el estado en la Google Play Developer API y guarda únicamente el estado de la suscripción, su vencimiento y un hash del token. Las comunicaciones usan HTTPS.

## Notificaciones
Los recordatorios se programan localmente en el dispositivo. No se envían a servidores externos.

## Copias de seguridad y exportación
Las exportaciones CSV y las copias cifradas se generan en tu dispositivo y vos elegís dónde guardarlas. Las copias se cifran con una contraseña que solo vos conocés; si la perdés, la copia no puede recuperarse. No incluyen tokens ni contenido de correos.

## Analítica y publicidad
Subly no muestra anuncios ni envía tus datos financieros a servicios de analítica de terceros. Los registros técnicos del servidor no contienen datos de correos ni tokens.

## Conservación y eliminación
Los datos locales permanecen hasta que los elimines o desinstales la app. Si la suscripción termina, tus datos no se borran y podés consultarlos y exportarlos. El estado de suscripción en el servidor se conserva mientras sea necesario para validar el acceso.

## Limitaciones
Subly depende de servicios de Google (Gmail API, Google Play). La detección automática es aproximada y puede requerir tu confirmación. Ningún sistema es infalible; aplicamos medidas razonables de seguridad sin poder garantizar seguridad absoluta.

