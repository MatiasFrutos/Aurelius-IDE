// src/components/features/backup.js — copia de seguridad de la configuración local (perfil, IA, voz, apariencia, favoritos…)
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";

const PREFIXES = ["aurelius"];
const EXCLUDED = ["aurelius.ai.chats"]; // las conversaciones pueden ser privadas y pesadas: no se incluyen
const MAX_VALUE = 2 * 1024 * 1024;

const allowed = (key) => PREFIXES.some((p) => key.startsWith(p)) && !EXCLUDED.some((x) => key.startsWith(x));

export function collectBackup() {
  const data = {};

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      const value = key && allowed(key) ? localStorage.getItem(key) : null;

      if (value !== null && value.length <= MAX_VALUE) data[key] = value;
    }
  } catch {
    // sin almacenamiento
  }

  return { aurelius: "backup", version: 1, exportedAt: new Date().toISOString(), data };
}

export function applyBackup(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(t("El archivo no es un JSON válido.", "The file is not valid JSON."));
  }

  if (parsed?.aurelius !== "backup" || typeof parsed.data !== "object" || !parsed.data) {
    throw new Error(t("No parece una copia de seguridad de Aurelius.", "This doesn't look like an Aurelius backup."));
  }

  let count = 0;

  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value === "string" && value.length <= MAX_VALUE && allowed(key)) {
      localStorage.setItem(key, value);
      count += 1;
    }
  }

  return count;
}

export async function exportBackup() {
  const json = JSON.stringify(collectBackup(), null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([json], { type: "application/json" })), download: `aurelius-backup-${stamp}.json` });

  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);

  // Por si el WebView no permite descargar: también queda en el portapapeles.
  try {
    await navigator.clipboard.writeText(json);
    toastSuccess(t("Copia guardada y copiada al portapapeles.", "Backup saved and copied to the clipboard."), t("Copia de seguridad", "Backup"));
  } catch {
    toastSuccess(`aurelius-backup-${stamp}.json`, t("Copia de seguridad", "Backup"));
  }
}

export function importBackupFromFile() {
  const input = Object.assign(document.createElement("input"), { type: "file", accept: "application/json" });

  input.addEventListener("change", async () => {
    const file = input.files?.[0];

    if (!file) return;

    try {
      const count = applyBackup(await file.text());

      toastInfo(`${count} ${t("ajustes restaurados. Recargando…", "settings restored. Reloading…")}`, t("Copia de seguridad", "Backup"));
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      toastError(String(error?.message || error), t("Copia de seguridad", "Backup"));
    }
  });

  input.click();
}

export function createBackupCommands() {
  const group = t("Ajustes", "Settings");

  return [
    { id: "backup-export", title: t("Copia de seguridad: exportar configuración", "Backup: export configuration"), description: t("Perfil, IA (perfiles, skills, prompts), voz, apariencia y favoritos en un JSON.", "Profile, AI (profiles, skills, prompts), voice, appearance and favorites in one JSON."), group, icon: "save", keywords: ["backup", "copia", "exportar", "respaldo"], run: exportBackup },
    { id: "backup-import", title: t("Copia de seguridad: importar configuración", "Backup: import configuration"), description: t("Restaura una copia exportada antes (recarga la app).", "Restores a previously exported backup (reloads the app)."), group, icon: "file-plus-2", keywords: ["backup", "copia", "importar", "restaurar"], run: importBackupFromFile }
  ];
}
