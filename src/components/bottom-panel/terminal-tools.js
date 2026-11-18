// src/components/bottom-panel/terminal-tools.js — herramientas de terminal para la paleta de comandos
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";
import { openPicker } from "../features/features.js";
import { createFile, writeFile } from "../../services/fs.service.js";
import { sendPrompt } from "../../ai/ai-chat.js";
import {
  adjustTerminalFont,
  clearActiveTerminal,
  getActiveTerminalText,
  getTerminalHistory,
  hasActiveTerminal,
  openTerminalHere,
  runCommandInTerminal,
  scrollActiveTerminalToBottom,
  sendToActiveTerminal
} from "./bottom-panel.js";

export const shq = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const RUNNERS = {
  js: (f) => `node ${shq(f)}`,
  mjs: (f) => `node ${shq(f)}`,
  cjs: (f) => `node ${shq(f)}`,
  ts: (f) => `npx tsx ${shq(f)}`,
  py: (f) => `python3 ${shq(f)}`,
  sh: (f) => `bash ${shq(f)}`,
  rb: (f) => `ruby ${shq(f)}`,
  php: (f) => `php ${shq(f)}`,
  lua: (f) => `lua ${shq(f)}`,
  go: (f) => `go run ${shq(f)}`,
  rs: () => "cargo run",
  java: (f) => `java ${shq(f)}`
};

export function runnerFor(path) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return RUNNERS[ext] ? RUNNERS[ext](path) : null;
}

const QUICK = [
  ["git status -sb", "Git"], ["git pull --ff-only", "Git"], ["git log --oneline --graph -15", "Git"],
  ["npm install", "Node"], ["npm run dev", "Node"], ["npm test", "Node"], ["npm run build", "Node"],
  ["cargo build", "Rust"], ["cargo test", "Rust"], ["cargo clippy", "Rust"],
  ["docker ps", "Docker"], ["docker compose up -d", "Docker"],
  ["ls -la", "Sistema"], ["df -h", "Sistema"], ["free -h", "Sistema"], ["ss -tulpn", "Sistema"], ["uname -a", "Sistema"]
];

function dispatch(command, title) {
  if (!appState.projectPath && !hasActiveTerminal()) {
    toastInfo(t("Abrí un proyecto primero.", "Open a project first."), t("Terminal", "Terminal"));
    return;
  }

  // Con una terminal conectada se usa esa; si no, se crea una nueva ya con el comando.
  if (!sendToActiveTerminal(command)) runCommandInTerminal(command, { title });
}

function dirOf(path) {
  return path.slice(0, path.lastIndexOf("/")) || "/";
}

async function saveOutput() {
  const text = getActiveTerminalText();

  if (!text.trim()) return toastInfo(t("La terminal está vacía.", "The terminal is empty."), t("Terminal", "Terminal"));
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), t("Terminal", "Terminal"));

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);

  try {
    const created = await createFile(appState.projectPath, `terminal-${stamp}.log`);
    await writeFile(created, text);
    window.dispatchEvent(new CustomEvent("au:refresh-project"));
    toastSuccess(`terminal-${stamp}.log`, t("Salida guardada", "Output saved"));
  } catch (error) {
    toastError(String(error?.message || error), t("No se pudo guardar", "Could not save"));
  }
}

export function createTerminalCommands() {
  const group = "Terminal";
  const mk = (id, es, en, icon, run, keywords = []) => ({ id: `term-${id}`, title: t(es, en), description: t(es, en), group, icon, keywords: ["terminal", "consola", ...keywords], run });

  return [
    mk("run-file", "Terminal: ejecutar el archivo activo", "Terminal: run the active file", "terminal", () => {
      const path = appState.activeFilePath;
      if (!path) return toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Terminal", "Terminal"));
      const command = runnerFor(path);
      if (!command) return toastInfo(t("No sé ejecutar este tipo de archivo.", "I don't know how to run this file type."), t("Terminal", "Terminal"));
      const tab = appState.openTabs.find((x) => x.path === path);
      if (tab?.isDirty) toastInfo(t("Hay cambios sin guardar: se ejecuta la versión guardada.", "There are unsaved changes: the saved version runs."), t("Terminal", "Terminal"));
      dispatch(command, `▶ ${path.split("/").pop()}`);
    }, ["ejecutar", "run", "archivo"]),

    mk("run-selection", "Terminal: ejecutar la selección o línea actual", "Terminal: run selection or current line", "terminal", () => {
      const view = appState.editorView;
      if (!view) return toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Terminal", "Terminal"));
      const range = view.state.selection.main;
      const text = (range.empty ? view.state.doc.lineAt(range.head).text : view.state.sliceDoc(range.from, range.to)).trim();
      if (!text) return toastInfo(t("No hay nada que ejecutar.", "Nothing to run."), t("Terminal", "Terminal"));
      if (!sendToActiveTerminal(text, { paste: text.includes("\n") })) runCommandInTerminal(text, { title: "▶ selección" });
    }, ["selection", "seleccion", "linea"]),

    mk("cd-file", "Terminal: ir a la carpeta del archivo activo", "Terminal: cd to the active file's folder", "folder-open", () => {
      const path = appState.activeFilePath;
      if (!path) return toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Terminal", "Terminal"));
      if (!sendToActiveTerminal(`cd ${shq(dirOf(path))}`)) openTerminalHere(dirOf(path));
    }, ["cd", "carpeta"]),

    mk("here", "Terminal: nueva terminal en la carpeta del archivo", "Terminal: new terminal in the file's folder", "terminal", () => {
      const path = appState.activeFilePath;
      if (!path) return toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Terminal", "Terminal"));
      openTerminalHere(dirOf(path));
    }, ["nueva", "new"]),

    mk("history", "Terminal: historial de comandos", "Terminal: command history", "history", () => {
      const list = getTerminalHistory();
      if (!list.length) return toastInfo(t("Todavía no hay comandos en el historial.", "No commands in the history yet."), t("Terminal", "Terminal"));
      openPicker({
        title: t("Historial de la terminal", "Terminal history"),
        icon: "history",
        items: list.map((c) => ({ kind: "$", name: c, meta: "", value: c })),
        onPick: (item) => dispatch(item.value, item.value.slice(0, 22))
      });
    }, ["history", "historial", "comandos"]),

    mk("quick", "Terminal: comandos rápidos", "Terminal: quick commands", "zap", () => {
      openPicker({
        title: t("Comandos rápidos", "Quick commands"),
        icon: "zap",
        items: QUICK.map(([c, k]) => ({ kind: k, name: c, meta: "", value: c })),
        onPick: (item) => dispatch(item.value, item.value.slice(0, 22))
      });
    }, ["rapidos", "quick", "git", "npm", "docker"]),

    mk("copy-output", "Terminal: copiar toda la salida", "Terminal: copy all output", "copy", async () => {
      const text = getActiveTerminalText();
      if (!text.trim()) return toastInfo(t("La terminal está vacía.", "The terminal is empty."), t("Terminal", "Terminal"));
      await navigator.clipboard.writeText(text);
      toastSuccess(`${text.split("\n").length} ${t("líneas", "lines")}`, t("Salida copiada", "Output copied"));
    }, ["copiar", "copy", "salida"]),

    mk("ask-ai", "Terminal: explicar el error con la IA", "Terminal: explain the error with AI", "sparkles", () => {
      const tail = getActiveTerminalText().split("\n").slice(-60).join("\n").trim();
      if (!tail) return toastInfo(t("La terminal está vacía.", "The terminal is empty."), t("Terminal", "Terminal"));
      toastInfo(t("Enviado al asistente de IA (panel derecho).", "Sent to the AI assistant (right panel)."), t("Terminal", "Terminal"));
      sendPrompt(`Esta es la salida reciente de mi terminal. Explicá qué pasó, la causa más probable del error y cómo arreglarlo, con comandos concretos:\n\n\`\`\`\n${tail}\n\`\`\``);
    }, ["ia", "ai", "error", "explicar"]),
    mk("save-output", "Terminal: guardar la salida en un archivo", "Terminal: save output to a file", "save", saveOutput, ["guardar", "log"]),
    mk("clear", "Terminal: limpiar", "Terminal: clear", "trash-2", clearActiveTerminal, ["clear", "limpiar"]),
    mk("interrupt", "Terminal: interrumpir proceso (Ctrl+C)", "Terminal: interrupt process (Ctrl+C)", "x", () => {
      if (!sendToActiveTerminal("\x03", { enter: false })) toastInfo(t("No hay una terminal conectada.", "No connected terminal."), t("Terminal", "Terminal"));
    }, ["ctrl+c", "kill", "detener"]),
    mk("bottom", "Terminal: ir al final", "Terminal: scroll to bottom", "chevron-down", scrollActiveTerminalToBottom, ["final", "bottom"]),
    mk("font-up", "Terminal: aumentar fuente", "Terminal: increase font", "text-cursor-input", () => adjustTerminalFont(1), ["fuente", "font", "zoom"]),
    mk("font-down", "Terminal: reducir fuente", "Terminal: decrease font", "text-cursor-input", () => adjustTerminalFont(-1), ["fuente", "font", "zoom"]),
    mk("font-reset", "Terminal: restablecer fuente", "Terminal: reset font", "text-cursor-input", () => adjustTerminalFont(0), ["fuente", "font"])
  ];
}
