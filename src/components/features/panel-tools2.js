// src/components/features/panel-tools2.js
// Segunda tanda de herramientas para las páginas existentes. Se inyecta dentro de las barras
// ya creadas por panel-tools.js (sin añadir filas al grid) y de forma idempotente.
import { appState, closeTab } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";
import { openOverlay } from "./features.js";
import { initProfile, openProfile } from "./profile.js";
import { openVoiceSettings } from "../voice/voice.js";
import { getDensity, toggleDensity } from "../../app/zoom.js";
import { exportBackup, importBackupFromFile } from "./backup.js";
import { gitRun } from "../../services/shell.service.js";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const b2 = (action, icon, label) =>
  `<button type="button" class="au-px__btn" data-px2="${action}" title="${esc(label)}"><i data-lucide="${icon}"></i><span>${esc(label)}</span></button>`;

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toastSuccess(t("Copiado al portapapeles.", "Copied to clipboard."), label);
  } catch (error) {
    toastError(String(error), label);
  }
}

function walk(nodes, fn, depth = 0) {
  for (const n of nodes || []) {
    fn(n, depth);
    if (n.is_dir || n.isDir) walk(n.children, fn, depth + 1);
  }
}

export function treeAsText(nodes = appState.fileTree) {
  const lines = [appState.projectName || "proyecto"];
  const render = (list, prefix) => {
    const sorted = [...(list || [])].sort((a, b) => Number(Boolean(b.is_dir)) - Number(Boolean(a.is_dir)) || a.name.localeCompare(b.name));
    sorted.forEach((n, i) => {
      const last = i === sorted.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${n.name}${n.is_dir ? "/" : ""}`);
      if (n.is_dir) render(n.children, prefix + (last ? "    " : "│   "));
    });
  };
  render(nodes, "");
  return lines.join("\n");
}

export function extensionStats(nodes = appState.fileTree) {
  const by = new Map();
  let files = 0;
  let dirs = 0;
  walk(nodes, (n) => {
    if (n.is_dir || n.isDir) return void (dirs += 1);
    files += 1;
    const ext = n.name.includes(".") ? n.name.split(".").pop().toLowerCase() : "(sin ext)";
    by.set(ext, (by.get(ext) || 0) + 1);
  });
  return { files, dirs, rows: [...by.entries()].sort((a, b) => b[1] - a[1]) };
}

function showExtensionStats() {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Explorer");
  const { files, dirs, rows } = extensionStats();
  const max = Math.max(1, ...rows.map((r) => r[1]));
  openOverlay({
    title: t("Archivos por extensión", "Files by extension"),
    icon: "files",
    width: 520,
    body: `<p style="margin:0 0 10px;color:var(--au-muted)">${files} ${t("archivos", "files")} · ${dirs} ${t("carpetas", "folders")}</p>
      <div class="au-tb__hashes">${rows.slice(0, 20).map(([e, n]) => `<div class="au-tb__bar"><b>.${esc(e)}</b><span style="--w:${(n / max) * 100}%"></span><code>${n}</code></div>`).join("")}</div>`
  });
}

async function openRemote() {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Git");
  try {
    const res = await gitRun(appState.projectPath, ["remote", "get-url", "origin"]);
    const raw = (res.stdout || "").trim();
    if (!res.ok || !raw) return toastInfo(t("Este repositorio no tiene remoto «origin».", "This repository has no «origin» remote."), "Git");
    const url = raw.replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "");
    if (!/^https:\/\//.test(url)) return toastInfo(raw, t("Remoto no web", "Non-web remote"));
    await openUrl(url);
  } catch (error) {
    toastError(String(error), "Git");
  }
}

async function copyBranch() {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Git");
  const res = await gitRun(appState.projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (res.ok) copy(res.stdout.trim(), "Git");
  else toastError(res.stderr || "git", "Git");
}

async function copyLastCommit() {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Git");
  const res = await gitRun(appState.projectPath, ["log", "-1", "--pretty=%h %s"]);
  if (res.ok && res.stdout.trim()) copy(res.stdout.trim(), "Git");
  else toastInfo(t("Sin commits todavía.", "No commits yet."), "Git");
}

function searchFor(term) {
  const input = document.getElementById("project-search-input");
  const form = document.getElementById("search-project-form");
  if (!input || !form) return;
  input.value = term;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.requestSubmit?.();
}

/* ---------------------------------------------------------------- */
/* Más herramientas por página                                       */
/* ---------------------------------------------------------------- */

async function revealProject() {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Explorer");
  try {
    await revealItemInDir(appState.activeFilePath || appState.projectPath);
  } catch (error) {
    toastError(String(error), "Explorer");
  }
}

function copyRelativePath() {
  if (!appState.activeFilePath) return toastInfo(t("No hay archivo activo.", "No active file."), "Explorer");
  copy(relPath(appState.activeFilePath), "Explorer");
}

function copySearchPaths() {
  const paths = [...new Set([...document.querySelectorAll(".au-search__result")].filter((r) => r.style.display !== "none").map((r) => relPath(decodeURIComponent(r.dataset.searchFilePath || ""))).filter(Boolean))];
  if (!paths.length) return toastInfo(t("No hay resultados.", "No results."), t("Búsqueda", "Search"));
  copy(paths.join("\n"), `${paths.length} ${t("archivos", "files")}`);
}

async function showAuthors() {
  if (!appState.projectPath) return toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Git");
  const res = await gitRun(appState.projectPath, ["log", "--pretty=%an", "-n", "2000"]);
  if (!res.ok) return toastInfo((res.stderr || "").split("\n")[0] || "git log", "Git");
  const counts = new Map();
  res.stdout.split("\n").filter(Boolean).forEach((a) => counts.set(a, (counts.get(a) || 0) + 1));
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  openOverlay({
    title: t("Autores (últimos 2000 commits)", "Authors (last 2000 commits)"),
    icon: "users",
    width: 520,
    body: rows.length ? `<div class="au-tb__hashes">${rows.map(([a, n]) => `<div class="au-tb__bar"><b title="${esc(a)}">${esc(a)}</b><span style="--w:${(n / max) * 100}%"></span><code>${n}</code></div>`).join("")}</div>` : `<p style="color:var(--au-muted)">${t("Sin commits.", "No commits.")}</p>`
  });
}

let monitorAlerts = (() => { try { return localStorage.getItem("aurelius.px.mon-alerts") === "1"; } catch { return false; } })();
let lastAlertAt = 0;

function checkMonitorAlerts() {
  if (!monitorAlerts) return;
  const sys = appState.monitor?.system;
  const total = Number(sys?.totalMemoryBytes) || 0;
  if (!total || Date.now() - lastAlertAt < 60000) return;
  const usedPct = ((Number(sys.usedMemoryBytes) || 0) / total) * 100;
  if (usedPct >= 90) {
    lastAlertAt = Date.now();
    toastError(`${usedPct.toFixed(0)}% ${t("de la RAM en uso", "of RAM in use")}`, t("Alerta del Monitor", "Monitor alert"));
  }
}

function copyDoctorJson() {
  const items = [...document.querySelectorAll(".au-toolchain-item")].map((el) => ({
    name: el.querySelector("strong")?.textContent.trim() || "",
    ok: el.classList.contains("is-ok"),
    status: el.querySelector("header span")?.textContent.trim() || ""
  }));
  if (!items.length) return toastInfo(t("Aún no hay datos.", "No data yet."), "Doctor");
  copy(JSON.stringify(items, null, 2), "Doctor");
}

function copyTasksMarkdown() {
  const items = [...document.querySelectorAll(".au-task-item")].filter((el) => el.style.display !== "none").map((el) => {
    const title = el.querySelector("strong")?.textContent.trim() || "";
    const cmd = el.querySelector("code")?.textContent.trim() || el.querySelector("small, p")?.textContent.trim() || "";
    return `- **${title}**${cmd ? ` — \`${cmd}\`` : ""}`;
  });
  if (!items.length) return toastInfo(t("No hay tareas.", "No tasks."), "Tasks");
  copy(items.join("\n"), "Tasks");
}

/* ---------------------------------------------------------------- */
/* Estilo visual: futurista / clásico                                */
/* ---------------------------------------------------------------- */

export function toggleVisualStyle() {
  const next = document.documentElement.dataset.style === "future" ? "classic" : "future";

  document.documentElement.dataset.style = next;

  try {
    localStorage.setItem("aurelius.style.v1", next);
  } catch {
    // sin almacenamiento
  }

  document.querySelectorAll('[data-px2="set-style"]').forEach((el) => el.classList.toggle("is-on", next === "future"));
  toastInfo(next === "future" ? t("Estilo futurista activado.", "Futuristic style on.") : t("Estilo clásico activado.", "Classic style on."), t("Apariencia", "Appearance"));
}

/* ---------------------------------------------------------------- */
/* Modo rápido                                                       */
/* ---------------------------------------------------------------- */

const FAST_KEY = "aurelius.perf.fast";

export function isFastMode() {
  try {
    return localStorage.getItem(FAST_KEY) === "1";
  } catch {
    return false;
  }
}

function applyFastMode() {
  if (isFastMode()) document.documentElement.dataset.perf = "fast";
  else delete document.documentElement.dataset.perf;
}

export function toggleFastMode() {
  const next = !isFastMode();
  try {
    localStorage.setItem(FAST_KEY, next ? "1" : "0");
  } catch {
    // sin almacenamiento
  }
  applyFastMode();
  document.querySelectorAll('[data-px2="set-fast"]').forEach((el) => el.classList.toggle("is-on", next));
  toastInfo(
    next ? t("Modo rápido activado: sin animaciones, transiciones ni fondo animado.", "Fast mode on: no animations, transitions or animated background.") : t("Modo rápido desactivado.", "Fast mode off."),
    t("Rendimiento", "Performance")
  );
}

/* ---------------------------------------------------------------- */
/* Explorer: ocultar archivos ocultos                                */
/* ---------------------------------------------------------------- */

const DOT_KEY = "aurelius.px.hide-dots";
let hideDots = (() => { try { return localStorage.getItem(DOT_KEY) === "1"; } catch { return false; } })();

export function applyDotfiles() {
  const tree = document.getElementById("explorer-tree");
  if (!tree) return;
  tree.classList.toggle("au-px2-hide-dots", hideDots);
  if (!hideDots) return;
  tree.querySelectorAll("[data-tree-item]:not([data-dot-checked])").forEach((item) => {
    item.dataset.dotChecked = "1";
    const name = item.querySelector(":scope > .au-tree__row-wrap .au-tree__name")?.textContent || "";
    if (name.startsWith(".")) item.dataset.dot = "1";
  });
}

/* ---------------------------------------------------------------- */
/* Comandos (paleta)                                                 */
/* ---------------------------------------------------------------- */

function relPath(abs) {
  const base = (appState.projectPath || "").replace(/\/+$/, "");
  return abs && abs.startsWith(`${base}/`) ? abs.slice(base.length + 1) : abs;
}

async function blameCurrentLine() {
  const view = appState.editorView;
  if (!view || !appState.activeFilePath || !appState.projectPath) return toastInfo(t("Abrí un archivo de un proyecto Git.", "Open a file from a Git project."), "Git blame");
  const line = view.state.doc.lineAt(view.state.selection.main.head).number;
  const res = await gitRun(appState.projectPath, ["blame", "-L", `${line},${line}`, "--date=short", "--", relPath(appState.activeFilePath)]);
  if (!res.ok) return toastInfo((res.stderr || "").split("\n")[0] || t("No se pudo obtener el blame.", "Could not get blame."), "Git blame");
  toastInfo(res.stdout.trim().replace(/\s+/g, " ").slice(0, 160), `Git blame · L${line}`);
}

async function fileHistory() {
  if (!appState.activeFilePath || !appState.projectPath) return toastInfo(t("Abrí un archivo de un proyecto Git.", "Open a file from a Git project."), "Git");
  const rel = relPath(appState.activeFilePath);
  const res = await gitRun(appState.projectPath, ["log", "--pretty=%h\t%an\t%ad\t%s", "--date=short", "-n", "40", "--", rel]);
  if (!res.ok) return toastInfo((res.stderr || "").split("\n")[0] || "git log", "Git");
  const rows = res.stdout.trim().split("\n").filter(Boolean).map((l) => l.split("\t"));
  openOverlay({
    title: `${t("Historial de", "History of")} ${rel}`,
    icon: "history",
    width: 720,
    body: rows.length
      ? `<div class="au-tb__hashes">${rows.map(([h, a, d, m]) => `<button type="button" class="au-tb__hash" data-tb-copy="${esc(h)}" style="text-align:left;cursor:pointer"><b>${esc(h)} · ${esc(d)}</b><code>${esc(a)} — ${esc(m)}</code></button>`).join("")}</div>`
      : `<p style="color:var(--au-muted)">${t("Este archivo no tiene commits.", "This file has no commits.")}</p>`
  });
}

function goTab(step) {
  const tabs = appState.openTabs;
  if (tabs.length < 2) return;
  const i = tabs.findIndex((x) => x.path === appState.activeFilePath);
  const next = tabs[(i + step + tabs.length) % tabs.length];
  window.dispatchEvent(new CustomEvent("au:open-file", { detail: { path: next.path } }));
}

function closeRight() {
  const i = appState.openTabs.findIndex((x) => x.path === appState.activeFilePath);
  const targets = appState.openTabs.slice(i + 1).filter((x) => !x.isDirty).map((x) => x.path);
  if (!targets.length) return toastInfo(t("No hay pestañas a la derecha.", "No tabs to the right."), t("Pestañas", "Tabs"));
  targets.forEach((p) => closeTab(p));
  window.dispatchEvent(new CustomEvent("au:rerender"));
}

export function createMoreCommands() {
  const mk = (id, es, en, icon, run, group, keywords = []) => ({ id, title: t(es, en), description: t(es, en), group, icon, keywords, run });
  const tabs = t("Pestañas", "Tabs");

  return [
    mk("copy-relpath", "Copiar ruta relativa del archivo", "Copy relative file path", "copy", copyRelativePath, t("Editor", "Editor"), ["path", "ruta", "relativa"]),
    mk("density-toggle", "Apariencia: densidad compacta / cómoda", "Appearance: compact / comfortable density", "ruler", () => toastInfo(toggleDensity() === "compact" ? t("Densidad compacta (90 %).", "Compact density (90%).") : t("Densidad cómoda (100 %).", "Comfortable density (100%)."), t("Apariencia", "Appearance")), t("Apariencia", "Appearance"), ["densidad", "density", "compacto", "compact", "tamano", "size", "zoom", "escala"]),
    mk("style-toggle", "Apariencia: alternar estilo futurista / clásico", "Appearance: toggle futuristic / classic style", "sparkles", toggleVisualStyle, t("Apariencia", "Appearance"), ["estilo", "style", "futurista", "futuristic", "clasico", "classic", "hud"]),
    mk("perf-fast", "Rendimiento: alternar modo rápido", "Performance: toggle fast mode", "zap", toggleFastMode, t("Rendimiento", "Performance"), ["fast", "rapido", "animaciones", "performance"]),
    mk("git-blame-line", "Git: blame de la línea actual", "Git: blame current line", "git-branch", blameCurrentLine, "Git", ["blame", "autor", "linea"]),
    mk("git-file-history", "Git: historial del archivo activo", "Git: active file history", "history", fileHistory, "Git", ["log", "history", "historial"]),
    mk("tab-next", "Pestaña siguiente", "Next tab", "arrow-right", () => goTab(1), tabs, ["next", "siguiente"]),
    mk("tab-prev", "Pestaña anterior", "Previous tab", "arrow-right", () => goTab(-1), tabs, ["prev", "anterior"]),
    mk("tab-close-right", "Cerrar pestañas a la derecha", "Close tabs to the right", "x", closeRight, tabs, ["close", "derecha"]),
    mk("tab-close-all", "Cerrar todas las pestañas guardadas", "Close all saved tabs", "x", () => { appState.openTabs.filter((x) => !x.isDirty).map((x) => x.path).forEach((p) => closeTab(p)); window.dispatchEvent(new CustomEvent("au:rerender")); }, tabs, ["close", "todas"])
  ];
}

/* ---------------------------------------------------------------- */
/* Inyectores                                                        */
/* ---------------------------------------------------------------- */

function addTo(selector, html) {
  const el = document.querySelector(selector);
  if (!el || el.dataset.px2Done) return false;
  el.dataset.px2Done = "1";
  el.insertAdjacentHTML("beforeend", html);
  return true;
}

function injectSettingsSearch() {
  const content = document.querySelector(".au-settings__content");
  if (!content || document.querySelector("[data-px2-settings-search]")) return false;
  content.insertAdjacentHTML(
    "afterbegin",
    `<div class="au-px2__search"><i data-lucide="search"></i><input type="search" data-px2-settings-search placeholder="${esc(t("Buscar en ajustes… (tema, fuente, IA, terminal)", "Search settings… (theme, font, AI, terminal)"))}" spellcheck="false" /></div>`
  );
  return true;
}

export function filterSettings(query) {
  const q = query.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll(".au-settings__section").forEach((section) => {
    const match = !q || section.textContent.toLowerCase().includes(q);
    section.style.display = match ? "" : "none";
    if (match) shown += 1;
  });
  document.querySelectorAll(".au-settings__nav-item").forEach((item) => {
    const target = document.querySelector(item.getAttribute("href") || "#__none__");
    if (target) item.style.display = target.style.display === "none" ? "none" : "";
  });
  return shown;
}

/* Monitor: tabla de procesos ordenable */
const procSort = { col: -1, dir: -1 };

function cellValue(row, col) {
  const text = row.children[col]?.textContent.trim() || "";
  const num = parseFloat(text.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (col === 0) return text.toLowerCase();
  const mult = /GB/i.test(text) ? 1024 : /KB/i.test(text) ? 1 / 1024 : 1;
  return Number.isFinite(num) ? num * (col === 3 ? mult : 1) : 0;
}

export function applyProcessSort() {
  const table = document.querySelector(".au-px__table");
  if (!table) return false;
  const heads = [...table.querySelectorAll("thead th")];
  heads.forEach((th, i) => {
    th.dataset.px2Sort = String(i);
    th.dataset.dir = i === procSort.col ? (procSort.dir > 0 ? "asc" : "desc") : "";
  });
  if (procSort.col < 0) return false;
  const body = table.querySelector("tbody");
  const rows = [...body.querySelectorAll("tr")];
  const sorted = [...rows].sort((a, b) => {
    const x = cellValue(a, procSort.col);
    const y = cellValue(b, procSort.col);
    return (x > y ? 1 : x < y ? -1 : 0) * procSort.dir;
  });
  if (sorted.every((row, i) => row === rows[i])) return false;
  sorted.forEach((row) => body.appendChild(row));
  return false;
}

export function filterTasks(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll(".au-task-item").forEach((item) => {
    item.style.display = !q || item.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

let onlyProblems = false;

export function applyDoctorFilter() {
  document.querySelectorAll(".au-toolchain-item").forEach((item) => {
    item.style.display = onlyProblems && item.classList.contains("is-ok") ? "none" : "";
  });
}

export function injectMore() {
  let injected = false;
  injected = addTo('[data-px-bar="settings"]', `<div class="au-px__row">${b2("set-profile", "user", t("Mi perfil y foto", "My profile & photo"))}${b2("set-style", "sparkles", t("Estilo futurista", "Futuristic style")).replace('class="au-px__btn"', `class="au-px__btn ${document.documentElement.dataset.style === "future" ? "is-on" : ""}"`)}${b2("set-density", "ruler", t("Densidad: compacta / cómoda", "Density: compact / comfortable")).replace('class="au-px__btn"', `class="au-px__btn ${getDensity() === "compact" ? "is-on" : ""}"`)}${b2("set-voice", "mic", t("Voz", "Voice"))}${b2("set-backup", "save", t("Copia de seguridad", "Backup"))}${b2("set-restore", "file-plus-2", t("Restaurar copia", "Restore backup"))}${b2("set-lang", "languages", t("Cambiar idioma (English / Español)", "Change language (English / Español)"))}${b2("set-fast", "zap", t("Modo rápido (sin animaciones)", "Fast mode (no animations)")).replace('class="au-px__btn"', `class="au-px__btn ${isFastMode() ? "is-on" : ""}"`)}</div>`) || injected;
  injected = addTo('[data-px-bar="monitor"]', b2("mon-copy", "copy", t("Copiar procesos", "Copy processes")) + `<button type="button" class="au-px__btn ${monitorAlerts ? "is-on" : ""}" data-px2="mon-alerts" title="${esc(t("Avisar si la RAM supera el 90%", "Warn when RAM exceeds 90%"))}"><i data-lucide="activity"></i><span>${esc(t("Alertas", "Alerts"))}</span></button>`) || injected;
  applyDotfiles();
  injected = addTo('[data-px-bar="tasks"]', `<input class="au-px__input" data-px2-task-filter placeholder="${esc(t("Filtrar tareas…", "Filter tasks…"))}" spellcheck="false" />` + b2("task-md", "copy", t("Copiar como Markdown", "Copy as Markdown"))) || injected;
  injected = addTo('[data-px-bar="toolchain"]', `<button type="button" class="au-px__chip ${onlyProblems ? "is-on" : ""}" data-px2="doc-problems">${esc(t("Solo problemas", "Only problems"))}</button>` + b2("doc-json", "copy", t("Copiar JSON", "Copy JSON"))) || injected;
  applyProcessSort();
  applyDoctorFilter();
  injected = addTo('[data-px-bar="explorer"]', b2("exp-tree", "folder-tree", t("Copiar árbol", "Copy tree")) + b2("exp-stats", "activity", t("Por extensión", "By extension")) + b2("exp-dots", "eye", t("Ocultar .archivos", "Hide dotfiles")) + b2("exp-reveal-fm", "external-link", t("Mostrar en el gestor", "Show in file manager")) + b2("exp-relpath", "copy", t("Ruta relativa", "Relative path"))) || injected;
  injected = addTo('[data-px-bar="git"]', b2("git-copy-branch", "copy", t("Copiar rama", "Copy branch")) + b2("git-copy-commit", "copy", t("Último commit", "Last commit")) + b2("git-remote", "external-link", t("Abrir remoto", "Open remote")) + b2("git-authors", "users", t("Autores", "Authors"))) || injected;
  injected = addTo('[data-px-bar="search"]', ["TODO", "FIXME", "HACK", "console.log"].map((w) => `<button type="button" class="au-px__chip" data-px2="srch-term" data-term="${esc(w)}">${esc(w)}</button>`).join("") + b2("srch-paths", "copy", t("Copiar rutas", "Copy paths"))) || injected;
  injected = injectSettingsSearch() || injected;
  return injected;
}

export function initMoreTools() {
  applyFastMode();
  initProfile();
  window.addEventListener("au:monitor-refresh", () => setTimeout(checkMonitorAlerts, 800));
  document.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-px2-sort]");
    if (th) {
      const col = Number(th.dataset.px2Sort);
      procSort.dir = procSort.col === col ? -procSort.dir : col === 0 ? 1 : -1;
      procSort.col = col;
      applyProcessSort();
      return;
    }
    const el = event.target.closest("[data-px2]");
    if (!el) return;
    switch (el.dataset.px2) {
      case "exp-tree":
        return appState.projectPath ? copy(treeAsText(), "Explorer") : toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Explorer");
      case "exp-stats":
        return showExtensionStats();
      case "git-copy-branch":
        return copyBranch();
      case "git-copy-commit":
        return copyLastCommit();
      case "git-remote":
        return openRemote();
      case "exp-reveal-fm":
        return revealProject();
      case "exp-relpath":
        return copyRelativePath();
      case "srch-paths":
        return copySearchPaths();
      case "git-authors":
        return showAuthors();
      case "mon-alerts":
        monitorAlerts = !monitorAlerts;
        try { localStorage.setItem("aurelius.px.mon-alerts", monitorAlerts ? "1" : "0"); } catch { /* sin almacenamiento */ }
        el.classList.toggle("is-on", monitorAlerts);
        return toastInfo(monitorAlerts ? t("Te aviso si la RAM supera el 90%.", "I'll warn you if RAM exceeds 90%.") : t("Alertas desactivadas.", "Alerts off."), "Monitor");
      case "doc-json":
        return copyDoctorJson();
      case "task-md":
        return copyTasksMarkdown();
      case "set-backup":
        return exportBackup();
      case "set-restore":
        return importBackupFromFile();
      case "set-density":
        return toastInfo(toggleDensity() === "compact" ? t("Densidad compacta (90 %).", "Compact density (90%).") : t("Densidad cómoda (100 %).", "Comfortable density (100%)."), t("Apariencia", "Appearance"));
      case "set-style":
        return toggleVisualStyle();
      case "set-voice":
        return openVoiceSettings();
      case "set-lang":
        return window.dispatchEvent(new CustomEvent("au:toggle-language"));
      case "set-profile":
        return openProfile();
      case "set-fast":
        return toggleFastMode();
      case "mon-copy": {
        const rows = [...document.querySelectorAll(".au-px__table tbody tr")].map((r) => [...r.children].map((c) => c.textContent.trim()).join("\t"));
        return rows.length ? copy(`${t("Proceso", "Process")}\tPID\tCPU\tRAM\n${rows.join("\n")}`, "Monitor") : toastInfo(t("Aún no hay datos.", "No data yet."), "Monitor");
      }
      case "exp-dots":
        hideDots = !hideDots;
        try { localStorage.setItem(DOT_KEY, hideDots ? "1" : "0"); } catch { /* sin almacenamiento */ }
        el.classList.toggle("is-on", hideDots);
        document.querySelectorAll("#explorer-tree [data-dot-checked]").forEach((n) => n.removeAttribute("data-dot-checked"));
        return applyDotfiles();
      case "doc-problems":
        onlyProblems = !onlyProblems;
        el.classList.toggle("is-on", onlyProblems);
        return applyDoctorFilter();
      case "srch-term":
        return searchFor(el.dataset.term);
      default:
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches?.("[data-px2-task-filter]")) filterTasks(event.target.value);
    if (event.target.matches?.("[data-px2-settings-search]")) filterSettings(event.target.value);
  });
}
