import * as Crypto from "expo-crypto";
import { useState } from "react";
import { InteractionManager, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldLabel, Input, Segmented } from "@/src/components/fields";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Button, Card, Notice, T } from "@/src/components/ui";
import { commit, getState, useAppState } from "@/src/data/store.ts";
import { BackupError, decryptBackup, encryptBackup, servicesCsv, validatePassword } from "@/src/domain/backup.ts";
import { todayISO } from "@/src/domain/dates.ts";
import { restoreInto } from "@/src/domain/operations.ts";
import type { AppState } from "@/src/domain/types.ts";
import { pickTextFile, saveAndShare } from "@/src/services/files";
import { spacing, useTheme } from "@/src/theme";

const defer = () => new Promise<void>((r) => InteractionManager.runAfterInteractions(() => setTimeout(r, 50)));

export default function Backup() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const st = useAppState();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "csv" | "enc" | "pick" | "restore">(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [rpw, setRpw] = useState("");
  const [rErr, setRErr] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<AppState | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  const exportCsv = async () => {
    setBusy("csv");
    try {
      await saveAndShare(`subly-registros-${todayISO()}.csv`, servicesCsv(getState(), todayISO()), "text/csv");
      toast("CSV generado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo exportar.", "error");
    } finally {
      setBusy(null);
    }
  };

  const createBackup = async () => {
    const e = validatePassword(pw) ?? (pw !== pw2 ? "Las contraseñas no coinciden." : null);
    setErr(e);
    if (e) return;
    setBusy("enc");
    await defer();
    try {
      const txt = encryptBackup(getState(), pw, (n) => Crypto.getRandomBytes(n), new Date().toISOString());
      await saveAndShare(`subly-copia-${todayISO()}.subly`, txt, "application/octet-stream");
      setPw("");
      setPw2("");
      toast("Copia cifrada creada. Guardala en un lugar seguro.");
    } catch {
      toast("No se pudo crear la copia.", "error");
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    setBusy("pick");
    try {
      const t = await pickTextFile();
      if (t) {
        setFileText(t);
        setIncoming(null);
        setRpw("");
        setRErr(null);
      }
    } catch {
      toast("No se pudo leer el archivo.", "error");
    } finally {
      setBusy(null);
    }
  };

  const unlock = async () => {
    if (!fileText) return;
    setBusy("restore");
    await defer();
    try {
      setIncoming(decryptBackup(fileText, rpw));
      setRErr(null);
    } catch (e) {
      setRErr(e instanceof BackupError ? e.message : "No se pudo abrir la copia.");
    } finally {
      setBusy(null);
    }
  };

  const applyRestore = async () => {
    if (!incoming) return;
    let res = { added: 0, skipped: 0 };
    const ok = await commit((s) => {
      const r = restoreInto(s, incoming, mode);
      res = r;
      return r.state;
    });
    setIncoming(null);
    setFileText(null);
    toast(ok ? (mode === "replace" ? "Datos reemplazados por la copia." : `Restauración completa: ${res.added} agregados, ${res.skipped} duplicados omitidos.`) : "No se pudo restaurar.", ok ? "success" : "error");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader testID="backup-header" title="Exportar y copias" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Card testID="backup-csv-card">
          <T v="h3">Exportar a CSV</T>
          <T v="body" color="muted" style={{ marginVertical: spacing.sm }}>{st.services.length} registros y {st.payments.length} pagos confirmados. UTF-8 compatible con Excel, Google Sheets y LibreOffice. No incluye tokens ni contenido de correos.</T>
          <Button testID="backup-export-csv" title="Exportar CSV" icon="document-text-outline" loading={busy === "csv"} onPress={exportCsv} />
        </Card>

        <Card testID="backup-create-card">
          <T v="h3">Crear copia cifrada</T>
          <T v="body" color="muted" style={{ marginVertical: spacing.sm }}>Cifrado AES-256 con una clave derivada de tu contraseña (PBKDF2-SHA256) y verificación de integridad HMAC. La contraseña no se guarda en el archivo ni en el dispositivo.</T>
          <View style={{ gap: spacing.md }}>
            <FieldLabel label="Contraseña de la copia" error={err ?? undefined}>
              <Input testID="backup-password" value={pw} onChangeText={setPw} secureTextEntry placeholder="Mínimo 8 caracteres" autoCapitalize="none" error={!!err} />
            </FieldLabel>
            <FieldLabel label="Repetir contraseña">
              <Input testID="backup-password-confirm" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
            </FieldLabel>
            <Notice tone="warning" icon="key-outline" title="Si perdés la contraseña, la copia no se puede recuperar" body="Nadie, ni siquiera Subly, puede descifrarla sin ella." />
            <Button testID="backup-create" title="Crear copia cifrada" icon="lock-closed-outline" loading={busy === "enc"} onPress={createBackup} />
          </View>
        </Card>

        <Card testID="backup-restore-card">
          <T v="h3">Restaurar una copia</T>
          <T v="body" color="muted" style={{ marginVertical: spacing.sm }}>Elegí un archivo .subly creado por la app.</T>
          <Button testID="backup-pick-file" kind="secondary" title={fileText ? "Elegir otro archivo" : "Elegir archivo"} icon="folder-open-outline" loading={busy === "pick"} onPress={pick} />
          {fileText ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <FieldLabel label="Contraseña de la copia" error={rErr ?? undefined}>
                <Input testID="backup-restore-password" value={rpw} onChangeText={setRpw} secureTextEntry autoCapitalize="none" error={!!rErr} />
              </FieldLabel>
              <Button testID="backup-unlock" title="Abrir copia" icon="lock-open-outline" loading={busy === "restore"} onPress={unlock} />
            </View>
          ) : null}
        </Card>
      </KeyboardAwareScrollView>

      <Sheet visible={!!incoming} onClose={() => setIncoming(null)} title="Confirmar restauración" testID="restore-sheet">
        <T v="body" testID="restore-summary">La copia contiene {incoming?.services.length ?? 0} registros, {incoming?.payments.length ?? 0} pagos y {incoming?.rates.length ?? 0} tipos de cambio.</T>
        <Segmented testID="restore-mode" options={[{ id: "merge", label: "Combinar" }, { id: "replace", label: "Reemplazar" }]} value={mode} onChange={setMode} />
        <T v="caption">
          {mode === "merge" ? "Se agregan los registros nuevos y se omiten los duplicados. Tus datos actuales se conservan." : `Se reemplazan tus ${st.services.length} registros actuales por los de la copia. La conexión con Gmail se mantiene.`}
        </T>
        <Button testID="restore-confirm" kind={mode === "replace" ? "danger" : "primary"} title={mode === "merge" ? "Combinar datos" : "Reemplazar datos"} onPress={applyRestore} />
      </Sheet>
    </View>
  );
}
