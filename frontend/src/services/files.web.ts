// Web preview: download via Blob and read with the document picker.
import * as DocumentPicker from "expo-document-picker";

export async function saveAndShare(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function pickTextFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0] as any;
  if (a.file) return await a.file.text();
  return await (await fetch(a.uri)).text();
}
