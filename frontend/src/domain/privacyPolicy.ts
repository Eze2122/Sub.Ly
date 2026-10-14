// Privacy policy text (single source for in-app screen, docs/privacy.html and docs/POLITICA_PRIVACIDAD.md).
export const PRIVACY_URL = "https://eze2122.github.io/-subly-privacy/privacy.html";
export const PRIVACY_CONTACT = "ezequiel21lv@gmail.com";
export const PRIVACY_SECTIONS: [string, string][] = [
  [
    "Resumen",
    "Sub.Ly (la app aparece como “Subly” en tu teléfono) es una aplicación para Android que te ayuda a organizar suscripciones, servicios, facturas y pagos recurrentes. No requiere crear una cuenta. Esta política describe qué información trata la aplicación, dónde se procesa y cómo podés eliminarla."
  ],
  [
    "1. Información que registrás",
    "Nombres de servicios, categorías, importes, monedas, fechas de vencimiento y de pago, estados, uso declarado (si lo indicás), notas personales, tipos de cambio manuales y preferencias de recordatorios. Se guardan en el almacenamiento privado de la aplicación en tu teléfono. No se suben automáticamente a ningún servidor ni se sincronizan entre dispositivos. La copia de seguridad automática de Android está desactivada para estos datos."
  ],
  [
    "2. Conexión opcional con Gmail: permiso",
    "La conexión con Gmail es opcional. Sub.Ly solicita únicamente el permiso de solo lectura de Gmail (https://www.googleapis.com/auth/gmail.readonly) mediante la autorización oficial de Google para Android. Sub.Ly no puede enviar, borrar ni modificar correos y nunca te pide tu contraseña de Google."
  ],
  [
    "3. Qué se lee y dónde se procesa",
    "Sub.Ly busca correos de los últimos 12 meses (y luego solo correos nuevos) que contengan términos relacionados con facturas, recibos, comprobantes, suscripciones, renovaciones, vencimientos o pruebas gratuitas. De esos correos lee el remitente, el asunto, la fecha, el fragmento de vista previa y una parte del texto. No descarga archivos adjuntos. El análisis se realiza en tu teléfono: los correos se descargan directamente desde Google a tu dispositivo, se analizan en memoria y su contenido se descarta. Los datos de Gmail no se envían al servidor de Sub.Ly ni a terceros."
  ],
  [
    "4. Qué se guarda en tu teléfono",
    "La dirección de correo de la cuenta conectada (para mostrarte qué cuenta está vinculada); los identificadores técnicos de los mensajes ya analizados, no su contenido, para no analizarlos dos veces; los servicios creados a partir de correos (nombre, categoría, importe, moneda, frecuencia, fechas y una referencia al remitente); y las detecciones pendientes de confirmación (nombre, categoría, importe, moneda, frecuencia, fechas detectadas, motivo, nivel de confianza, referencia al remitente y hasta 10 identificadores de mensajes). Los permisos de acceso los administran los servicios de Google Play en tu dispositivo; Sub.Ly no guarda tokens de Google de forma permanente."
  ],
  [
    "5. Sincronización diaria",
    "Mientras Gmail esté conectado y tu suscripción esté activa, Android puede ejecutar aproximadamente una vez al día una búsqueda de correos nuevos, con el mismo procesamiento local. El momento exacto lo decide el sistema."
  ],
  [
    "6. Uso limitado de los datos de Google",
    "El uso y la transferencia a cualquier otra aplicación de la información recibida de las APIs de Google por parte de Sub.Ly se ajustan a la Política de Datos del Usuario de los Servicios de API de Google (Google API Services User Data Policy), incluidos los requisitos de Uso Limitado. Original en inglés: “Sub.Ly's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.” Los datos de Gmail se usan solamente para detectar y organizar tus suscripciones, facturas y pagos dentro de la aplicación. No se venden, no se usan para publicidad, no se transfieren a terceros y no son leídos por personas, ya que se procesan únicamente en tu dispositivo."
  ],
  [
    "7. Desconectar Google y eliminar datos",
    "Desde Ajustes → Conexión con Gmail → Desconectar Gmail podés conservar los servicios detectados en Gmail o eliminarlos junto con sus pagos asociados. En ambos casos, Sub.Ly solicita a Google la revocación del acceso, borra los permisos en caché del teléfono y elimina la dirección de la cuenta conectada, los identificadores de mensajes analizados, las detecciones pendientes y las referencias de detecciones descartadas. Los registros que creaste manualmente no se modifican. También podés retirar el acceso desde myaccount.google.com/connections. Al desinstalar la aplicación se eliminan todos sus datos locales."
  ],
  [
    "8. Exportación y copias cifradas",
    "El CSV contiene tus servicios y pagos confirmados; no incluye credenciales, identificadores de mensajes ni contenido de correos. Las copias cifradas contienen tus registros, pagos, tipos de cambio, preferencias, las detecciones pendientes (con sus identificadores de mensajes y referencias a remitentes) y las referencias de detecciones descartadas; no incluyen credenciales de Google, la dirección de la cuenta conectada, la lista de mensajes analizados ni contenido de correos. Se cifran en tu teléfono con una contraseña que elegís (AES-256 con verificación de integridad). La contraseña no se guarda; si la perdés, la copia no puede recuperarse."
  ],
  [
    "9. Suscripción y Google Play",
    "La suscripción se contrata y se cobra a través de Google Play. Sub.Ly no recibe ni guarda datos de tarjetas. Para validarla, la app envía al servidor de Sub.Ly, mediante HTTPS, el token de compra de Google Play, el identificador del producto y un identificador anónimo de instalación (hash). El servidor consulta Google Play y guarda solo un hash del token de compra, el estado y el vencimiento de la suscripción y ese identificador anónimo. Si la suscripción termina, tus datos locales no se borran y podés consultarlos y exportarlos."
  ],
  [
    "10. Notificaciones, analítica y publicidad",
    "Los recordatorios se programan localmente en tu teléfono. Sub.Ly no muestra anuncios ni usa servicios de analítica de terceros. Los registros técnicos del servidor no contienen contenido de correos, tokens de Google ni datos financieros."
  ],
  [
    "11. Conservación y solicitudes",
    "Los datos locales se conservan hasta que los elimines, desconectes Gmail eligiendo eliminar o desinstales la aplicación. El estado de suscripción en el servidor se conserva mientras sea necesario para validar el acceso; podés solicitar información o su eliminación escribiendo al contacto."
  ],
  [
    "12. Menores, seguridad y cambios",
    "Sub.Ly no está dirigida a menores ni solicita deliberadamente su información. Aplicamos medidas razonables (almacenamiento privado del sistema, HTTPS, cifrado de copias); ningún sistema es infalible. Si esta política cambia, actualizaremos la fecha indicada al comienzo."
  ],
  [
    "13. Contacto",
    "Responsable: Sub.Ly · ezequiel21lv@gmail.com"
  ]
];
