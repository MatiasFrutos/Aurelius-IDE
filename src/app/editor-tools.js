// src/app/editor-tools.js — herramientas de texto sobre la selección (o el documento completo)
import { appState } from "./state.js";
import { toastError, toastInfo, toastSuccess } from "../components/ui/toast.js";
import { t } from "./i18n.js";

function getView() {
  return appState.editorView || null;
}

function words(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9áéíóúñüÁÉÍÓÚÑÜ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const transforms = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  camel: (s) => words(s).map((w, i) => (i ? cap(w) : w.toLowerCase())).join(""),
  pascal: (s) => words(s).map(cap).join(""),
  snake: (s) => words(s).map((w) => w.toLowerCase()).join("_"),
  kebab: (s) => words(s).map((w) => w.toLowerCase()).join("-"),
  sortAsc: (s) => s.split("\n").sort((a, b) => a.localeCompare(b)).join("\n"),
  sortDesc: (s) => s.split("\n").sort((a, b) => b.localeCompare(a)).join("\n"),
  unique: (s) => [...new Set(s.split("\n"))].join("\n"),
  reverse: (s) => s.split("\n").reverse().join("\n"),
  trim: (s) => s.split("\n").map((l) => l.replace(/[ \t]+$/g, "")).join("\n"),
  jsonFormat: (s) => JSON.stringify(JSON.parse(s), null, 2),
  jsonMinify: (s) => JSON.stringify(JSON.parse(s)),
  b64enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))),
  b64dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0))),
  urlEnc: (s) => encodeURIComponent(s),
  urlDec: (s) => decodeURIComponent(s)
};

function applyTransform(name) {
  const view = getView();

  if (!view) {
    toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Sin editor", "No editor"));
    return;
  }

  const { state } = view;
  const hasSelection = state.selection.ranges.some((range) => !range.empty);

  try {
    const changes = hasSelection
      ? state.selection.ranges
          .filter((range) => !range.empty)
          .map((range) => ({
            from: range.from,
            to: range.to,
            insert: transforms[name](state.sliceDoc(range.from, range.to))
          }))
      : [{ from: 0, to: state.doc.length, insert: transforms[name](state.doc.toString()) }];

    view.dispatch({ changes, userEvent: "input.transform" });
    view.focus();
  } catch (error) {
    toastError(String(error?.message || error), t("No se pudo transformar", "Could not transform"));
  }
}

function insertText(text) {
  const view = getView();
  if (!view) return;

  view.dispatch(view.state.replaceSelection(text));
  view.focus();
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export function createEditorToolCommands() {
  const group = t("Herramientas de texto", "Text tools");

  const mk = (id, es, en, icon, run, keywords = []) => ({
    id: `tool-${id}`,
    title: t(es, en),
    description: t(
      "Actúa sobre la selección o el documento completo.",
      "Acts on the selection or the whole document."
    ),
    group,
    icon,
    keywords: ["tool", "texto", "text", ...keywords],
    run
  });

  return [
    mk("json-format", "JSON: formatear", "JSON: format", "braces", () => applyTransform("jsonFormat"), ["json", "pretty"]),
    mk("json-min", "JSON: minificar", "JSON: minify", "braces", () => applyTransform("jsonMinify"), ["json", "minify"]),
    mk("upper", "MAYÚSCULAS", "UPPERCASE", "wand-2", () => applyTransform("upper")),
    mk("lower", "minúsculas", "lowercase", "wand-2", () => applyTransform("lower")),
    mk("camel", "camelCase", "camelCase", "wand-2", () => applyTransform("camel"), ["case"]),
    mk("pascal", "PascalCase", "PascalCase", "wand-2", () => applyTransform("pascal"), ["case"]),
    mk("snake", "snake_case", "snake_case", "wand-2", () => applyTransform("snake"), ["case"]),
    mk("kebab", "kebab-case", "kebab-case", "wand-2", () => applyTransform("kebab"), ["case"]),
    mk("sort-asc", "Ordenar líneas A→Z", "Sort lines A→Z", "wand-2", () => applyTransform("sortAsc"), ["sort", "ordenar"]),
    mk("sort-desc", "Ordenar líneas Z→A", "Sort lines Z→A", "wand-2", () => applyTransform("sortDesc"), ["sort", "ordenar"]),
    mk("unique", "Quitar líneas duplicadas", "Remove duplicate lines", "wand-2", () => applyTransform("unique"), ["dedupe", "duplicadas"]),
    mk("reverse", "Invertir orden de líneas", "Reverse line order", "wand-2", () => applyTransform("reverse")),
    mk("trim", "Quitar espacios finales", "Trim trailing whitespace", "wand-2", () => applyTransform("trim"), ["whitespace"]),
    mk("b64e", "Base64: codificar", "Base64: encode", "hash", () => applyTransform("b64enc")),
    mk("b64d", "Base64: decodificar", "Base64: decode", "hash", () => applyTransform("b64dec")),
    mk("urle", "URL: codificar", "URL: encode", "hash", () => applyTransform("urlEnc")),
    mk("urld", "URL: decodificar", "URL: decode", "hash", () => applyTransform("urlDec")),
    mk("uuid", "Insertar UUID", "Insert UUID", "hash", () => insertText(uuid()), ["uuid", "guid"]),
    mk("iso-date", "Insertar fecha ISO", "Insert ISO date", "clock-3", () => insertText(new Date().toISOString()), ["date", "fecha"]),
    mk("timestamp", "Insertar timestamp Unix", "Insert Unix timestamp", "clock-3", () => insertText(String(Math.floor(Date.now() / 1000))), ["epoch"]),
    mk("copy-path", "Copiar ruta del archivo", "Copy file path", "copy", async () => {
      if (!appState.activeFilePath) return;
      try {
        await navigator.clipboard.writeText(appState.activeFilePath);
        toastSuccess(appState.activeFilePath, t("Ruta copiada", "Path copied"));
      } catch (error) {
        toastError(String(error), t("No se pudo copiar", "Could not copy"));
      }
    }, ["path", "ruta"])
  ];
}
