// src/components/features/panel-tools2.js
// Segunda tanda de herramientas para las páginas existentes. Se inyecta dentro de las barras
// ya creadas por panel-tools.js (sin añadir filas al grid) y de forma idempotente.
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";
import { openOverlay } from "./features.js";
import { gitRun } from "../../services/shell.service.js";
import { openUrl } from "@tauri-apps/plugin-opener";

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
  injected = addTo('[data-px-bar="tasks"]', `<input class="au-px__input" data-px2-task-filter placeholder="${esc(t("Filtrar tareas…", "Filter tasks…"))}" spellcheck="false" />`) || injected;
  injected = addTo('[data-px-bar="toolchain"]', `<button type="button" class="au-px__chip ${onlyProblems ? "is-on" : ""}" data-px2="doc-problems">${esc(t("Solo problemas", "Only problems"))}</button>`) || injected;
  applyProcessSort();
  applyDoctorFilter();
  injected = addTo('[data-px-bar="explorer"]', b2("exp-tree", "folder-tree", t("Copiar árbol", "Copy tree")) + b2("exp-stats", "activity", t("Por extensión", "By extension"))) || injected;
  injected = addTo('[data-px-bar="git"]', b2("git-copy-branch", "copy", t("Copiar rama", "Copy branch")) + b2("git-copy-commit", "copy", t("Último commit", "Last commit")) + b2("git-remote", "external-link", t("Abrir remoto", "Open remote"))) || injected;
  injected = addTo('[data-px-bar="search"]', ["TODO", "FIXME", "HACK", "console.log"].map((w) => `<button type="button" class="au-px__chip" data-px2="srch-term" data-term="${esc(w)}">${esc(w)}</button>`).join("")) || injected;
  injected = injectSettingsSearch() || injected;
  return injected;
}

export function initMoreTools() {
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
