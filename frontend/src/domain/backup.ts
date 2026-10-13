// CSV export (UTF-8 with BOM, ';' separator for es-AR spreadsheets) and
// encrypted backups: PBKDF2-SHA256 -> AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC).
import CryptoJS from "crypto-js";

import { computeStatus } from "./dates.ts";
import { migrate } from "./operations.ts";
import { categoryOf, frequencyLabel, STATUS_LABEL, type AppState } from "./types.ts";

function cell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function amount(minor: number) {
  return (minor / 100).toFixed(2).replace(".", ",");
}

export function servicesCsv(state: AppState, today: string) {
  const head = [
    "Nombre", "Descripción", "Categoría", "Importe", "Moneda", "Frecuencia", "Próximo vencimiento", "Último pago",
    "Estado", "Inicio", "Finalización", "Inicio prueba", "Fin prueba", "Recordatorios", "Origen", "Notas", "Creado", "Modificado",
  ];
  const rows = state.services.map((s) => [
    s.name, s.description ?? "", categoryOf(s.category).label, amount(s.amountMinor), s.currency, frequencyLabel(s),
    s.nextDue ?? "", s.lastPaid ?? "", STATUS_LABEL[computeStatus(s, today)], s.startDate ?? "", s.endDate ?? "",
    s.trialStart ?? "", s.trialEnd ?? "", s.reminders ? "Sí" : "No", s.source === "gmail" ? "Gmail" : "Manual",
    s.notes ?? "", s.createdAt, s.updatedAt,
  ]);
  const pays = state.payments.map((p) => [p.serviceName, categoryOf(p.category).label, p.dueDate ?? "", p.paidDate, amount(p.amountMinor), p.currency, p.evidence === "manual" ? "Confirmado por el usuario" : "Comprobante Gmail confirmado"]);
  const lines = [
    head.map(cell).join(";"),
    ...rows.map((r) => r.map(cell).join(";")),
    "",
    ["Pago confirmado de", "Categoría", "Vencimiento", "Fecha de pago", "Importe", "Moneda", "Evidencia"].map(cell).join(";"),
    ...pays.map((r) => r.map(cell).join(";")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}

export const BACKUP_FORMAT = "subly-backup";
export const BACKUP_VERSION = 1;
export const KDF_ITERATIONS = 60000;

/** Data included in a backup: records & settings only. No OAuth tokens, no Gmail content. */
function exportable(state: AppState): AppState {
  return {
    ...state,
    gmail: { ...state.gmail, processedIds: [], email: null, connected: false, lastError: null },
  };
}

function wordsFromBytes(bytes: Uint8Array) {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}
function deriveKeys(password: string, salt: CryptoJS.lib.WordArray, iterations: number) {
  const key = CryptoJS.PBKDF2(password, salt, { keySize: 512 / 32, iterations, hasher: CryptoJS.algo.SHA256 });
  const encKey = CryptoJS.lib.WordArray.create(key.words.slice(0, 8), 32);
  const macKey = CryptoJS.lib.WordArray.create(key.words.slice(8, 16), 32);
  return { encKey, macKey };
}

export function validatePassword(p: string) {
  if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

/** `randomBytes` must come from a CSPRNG (expo-crypto). */
export function encryptBackup(state: AppState, password: string, randomBytes: (n: number) => Uint8Array, createdAt: string) {
  const salt = wordsFromBytes(randomBytes(16));
  const iv = wordsFromBytes(randomBytes(16));
  const { encKey, macKey } = deriveKeys(password, salt, KDF_ITERATIONS);
  const plain = JSON.stringify(exportable(state));
  const ct = CryptoJS.AES.encrypt(plain, encKey, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).ciphertext;
  const header = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, kdf: { alg: "PBKDF2-SHA256", iterations: KDF_ITERATIONS, salt: salt.toString(CryptoJS.enc.Base64) }, cipher: "AES-256-CBC", mac: "HMAC-SHA256" };
  const ivB64 = iv.toString(CryptoJS.enc.Base64);
  const ctB64 = ct.toString(CryptoJS.enc.Base64);
  const macInput = `${JSON.stringify(header)}.${ivB64}.${ctB64}`;
  const mac = CryptoJS.HmacSHA256(macInput, macKey).toString(CryptoJS.enc.Base64);
  return JSON.stringify({ ...header, iv: ivB64, ct: ctB64, tag: mac });
}

export class BackupError extends Error {}

export function decryptBackup(fileText: string, password: string): AppState {
  let obj: any;
  try {
    obj = JSON.parse(fileText);
  } catch {
    throw new BackupError("El archivo no es una copia de Subly válida.");
  }
  if (obj?.format !== BACKUP_FORMAT) throw new BackupError("El archivo no es una copia de Subly.");
  if (obj.version > BACKUP_VERSION) throw new BackupError("La copia fue creada con una versión más nueva de Subly.");
  if (!obj.iv || !obj.ct || !obj.tag || !obj.kdf?.salt) throw new BackupError("La copia está incompleta o dañada.");
  const header = { format: obj.format, version: obj.version, createdAt: obj.createdAt, kdf: obj.kdf, cipher: obj.cipher, mac: obj.mac };
  const salt = CryptoJS.enc.Base64.parse(obj.kdf.salt);
  const { encKey, macKey } = deriveKeys(password, salt, Number(obj.kdf.iterations) || KDF_ITERATIONS);
  const expected = CryptoJS.HmacSHA256(`${JSON.stringify(header)}.${obj.iv}.${obj.ct}`, macKey).toString(CryptoJS.enc.Base64);
  if (expected !== obj.tag) throw new BackupError("Contraseña incorrecta o archivo modificado/dañado.");
  const plain = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(obj.ct) }),
    encKey,
    { iv: CryptoJS.enc.Base64.parse(obj.iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  ).toString(CryptoJS.enc.Utf8);
  try {
    return migrate(JSON.parse(plain));
  } catch {
    throw new BackupError("No se pudo leer el contenido de la copia.");
  }
}
