// Save/share and pick files on Android (Storage Access via share sheet / document picker).
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function saveAndShare(filename: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error("No hay una app disponible para guardar el archivo.");
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: "Guardar archivo de Subly" });
}

export async function pickTextFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const f = new File(res.assets[0].uri);
  return await f.text();
}
