// src/components/features/labs2.js
// Archivos recientes, snippets, vista previa Markdown y reemplazo en proyecto.
import { snippet } from "@codemirror/autocomplete";
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess, toastWarning } from "../ui/toast.js";
import { confirmModal } from "../ui/modal.js";
import { readFile, writeFile } from "../../services/fs.service.js";
import { openPicker, openOverlay, closeOverlay } from "./features.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento
  }
}

/* ====================================================================== */
/* Archivos recientes (Ctrl+E)                                             */
/* ====================================================================== */

const RECENT_KEY = "aurelius.recent-files.v1";

export function trackRecentFile(path) {
  if (!path) return;

  const all = load(RECENT_KEY, {});
  const project = appState.projectPath || "__none__";
  const list = [path, ...(all[project] || []).filter((item) => item !== path)].slice(0, 30);

  all[project] = list;
  save(RECENT_KEY, all);
}

export function openRecentFiles() {
  const project = appState.projectPath || "__none__";
  const files = (load(RECENT_KEY, {})[project] || []).filter((path) => path !== appState.activeFilePath);

  if (!files.length) {
    toastInfo(t("Todavía no hay archivos recientes.", "No recent files yet."), t("Recientes", "Recent"));
    return;
  }

  const base = appState.projectPath ? `${appState.projectPath}/` : "";

  openPicker({
    title: t("Archivos recientes", "Recent files"),
    icon: "history",
    items: files.map((path) => ({ kind: "file", name: path.replace(base, ""), meta: "", value: path })),
    onPick: (item) => window.dispatchEvent(new CustomEvent("au:open-file", { detail: { path: item.value } }))
  });
}

/* ====================================================================== */
/* Snippets                                                                */
/* ====================================================================== */

const SNIPPET_KEY = "aurelius.snippets.v1";

const DEFAULT_SNIPPETS = [
  { name: "log", body: "console.log(${1:value});" },
  { name: "fn", body: "function ${1:name}(${2:args}) {\n  ${3}\n}" },
  { name: "afn", body: "const ${1:name} = async (${2:args}) => {\n  ${3}\n};" },
  { name: "try", body: "try {\n  ${1}\n} catch (error) {\n  console.error(error);\n}" },
  { name: "for", body: "for (const ${1:item} of ${2:items}) {\n  ${3}\n}" },
  { name: "if", body: "if (${1:condition}) {\n  ${2}\n}" },
  { name: "fetch", body: "const response = await fetch(${1:url});\nif (!response.ok) throw new Error(`HTTP ${response.status}`);\nconst data = await response.json();" },
  { name: "py-main", body: "def main():\n    ${1:pass}\n\n\nif __name__ == \"__main__\":\n    main()" },
  { name: "html5", body: "<!doctype html>\n<html lang=\"es\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n  <title>${1:Título}</title>\n</head>\n<body>\n  ${2}\n</body>\n</html>" },
  { name: "rs-fn", body: "fn ${1:name}(${2}) -> ${3:()} {\n    ${4}\n}" },
  { name: "todo", body: "// TODO(${1:yo}): ${2}" }
];

function getSnippets() {
  return load(SNIPPET_KEY, null) || DEFAULT_SNIPPETS;
}

function insertSnippet(body) {
  const view = appState.editorView;

  if (!view) {
    toastInfo(t("Abrí un archivo primero.", "Open a file first."), "Snippets");
    return;
  }

  const { from, to } = view.state.selection.main;
  snippet(body)({ state: view.state, dispatch: view.dispatch.bind(view) }, null, from, to);
  view.focus();
}

export function openSnippets() {
  const list = getSnippets();

  openPicker({
    title: "Snippets",
    icon: "code",
    items: list.map((item) => ({ kind: "snip", name: item.name, meta: item.body.split("\n")[0].slice(0, 60), value: item.body })),
    onPick: (item) => insertSnippet(item.value),
    footer: `<button type="button" class="au-fx-btn" data-fx-manage-snippets>${t("Gestionar snippets…", "Manage snippets…")}</button>`,
    onFooter: openSnippetManager
  });
}

export function openSnippetManager() {
  const list = getSnippets().map((item) => ({ ...item }));

  openOverlay({
    title: t("Gestionar snippets", "Manage snippets"),
    icon: "code",
    width: 720,
    body: `<p class="au-fx-muted">${t("Usá ${1:nombre} para campos editables (Tab para saltar) y ${} para el cursor final.", "Use ${1:name} for editable fields (Tab to jump) and ${} for the final cursor.")}</p>
      <div class="au-snip" id="au-snip-list"></div>
      <div class="au-snip__actions"><button type="button" class="au-px__btn" data-snip-add>+ ${t("Nuevo", "New")}</button>
      <button type="button" class="au-px__btn" data-snip-reset>${t("Restaurar por defecto", "Reset defaults")}</button>
      <button type="button" class="au-fx-btn" data-snip-save>${t("Guardar", "Save")}</button></div>`,
    onMount: (el) => {
      const host = el.querySelector("#au-snip-list");

      const paint = () => {
        host.innerHTML = list
          .map(
            (item, i) => `<div class="au-snip__row" data-i="${i}">
            <input data-f="name" value="${esc(item.name)}" placeholder="${t("nombre", "name")}" spellcheck="false" />
            <textarea data-f="body" rows="3" spellcheck="false">${esc(item.body)}</textarea>
            <button type="button" class="au-fx-icon-btn" data-snip-del="${i}" aria-label="${t("Eliminar", "Delete")}">✕</button></div>`
          )
          .join("");
      };

      const collect = () =>
        host.querySelectorAll(".au-snip__row").forEach((row) => {
          const item = list[Number(row.dataset.i)];
          item.name = row.querySelector('[data-f="name"]').value;
          item.body = row.querySelector('[data-f="body"]').value;
        });

      el.addEventListener("click", (event) => {
        if (event.target.closest("[data-snip-add]")) {
          collect();
          list.push({ name: "nuevo", body: "${1}" });
          paint();
        }

        const del = event.target.closest("[data-snip-del]");
        if (del) {
          collect();
          list.splice(Number(del.dataset.snipDel), 1);
          paint();
        }

        if (event.target.closest("[data-snip-reset]")) {
          list.splice(0, list.length, ...DEFAULT_SNIPPETS.map((item) => ({ ...item })));
          paint();
        }

        if (event.target.closest("[data-snip-save]")) {
          collect();
          save(SNIPPET_KEY, list.filter((item) => item.name.trim() && item.body));
          toastSuccess(t("Snippets guardados.", "Snippets saved."), "Snippets");
          closeOverlay();
        }
      });

      paint();
    }
  });
}

/* ====================================================================== */
/* Vista previa de Markdown                                                */
/* ====================================================================== */

export function renderMarkdown(source) {
  const safeUrl = (url) => (/^(https?:|mailto:|#|\/|\.)/i.test(url.trim()) ? url.trim() : "#");

  const inline = (text) =>
    esc(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => `<img alt="${alt}" src="${esc(safeUrl(url))}" />`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a href="${esc(safeUrl(url))}" rel="noreferrer noopener" target="_blank">${label}</a>`);

  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i += 1;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      i += 1;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push("<hr />");
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const text = lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, "");
        const task = text.match(/^\[( |x)\]\s+(.*)$/i);
        items.push(task ? `<li class="task"><input type="checkbox" disabled ${task[1] !== " " ? "checked" : ""} /> ${inline(task[2])}</li>` : `<li>${inline(text)}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    if (/^\|.*\|\s*$/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+\.)\s)/.test(lines[i])) paragraph.push(lines[i++]);
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return out.join("\n");
}

export function openMarkdownPreview() {
  const view = appState.editorView;

  if (!view) {
    toastInfo(t("Abrí un archivo Markdown primero.", "Open a Markdown file first."), "Markdown");
    return;
  }

  openOverlay({
    title: `${t("Vista previa", "Preview")} · ${appState.activeFileName || ""}`,
    icon: "eye",
    width: 860,
    body: `<article class="au-md">${renderMarkdown(view.state.doc.toString())}</article>`
  });
}

/* ====================================================================== */
/* Reemplazar en proyecto                                                  */
/* ====================================================================== */

export function buildSearchRegex(query, { cs = false, word = false, rx = false } = {}) {
  const source = rx ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(word ? `\\b(?:${source})\\b` : source, cs ? "g" : "gi");
}

export async function replaceInProject({ query, replacement, filters, files }) {
  if (!query || query.length < 2) {
    toastWarning(t("Escribí al menos 2 caracteres para buscar.", "Type at least 2 characters to search."), t("Reemplazar", "Replace"));
    return null;
  }

  let regex;

  try {
    regex = buildSearchRegex(query, filters);
  } catch (error) {
    toastError(String(error.message || error), t("Expresión regular inválida", "Invalid regular expression"));
    return null;
  }

  const unique = [...new Set(files)];

  if (!unique.length) {
    toastInfo(t("No hay resultados para reemplazar.", "No results to replace."), t("Reemplazar", "Replace"));
    return null;
  }

  const confirmed = await confirmModal({
    title: t("Reemplazar en el proyecto", "Replace in project"),
    message: t(
      `Se reemplazará "${query}" por "${replacement}" en ${unique.length} archivo(s). Esta acción modifica archivos en disco.`,
      `"${query}" will be replaced by "${replacement}" in ${unique.length} file(s). This modifies files on disk.`
    ),
    confirmText: t("Reemplazar", "Replace"),
    cancelText: t("Cancelar", "Cancel"),
    danger: true
  });

  if (!confirmed) return null;

  let changedFiles = 0;
  let changedMatches = 0;
  const skipped = [];

  for (const path of unique) {
    const tab = appState.openTabs.find((item) => item.path === path);

    if (tab?.isDirty) {
      skipped.push(path);
      continue;
    }

    try {
      const original = await readFile(path);
      const count = (original.match(regex) || []).length;
      const next = original.replace(regex, filters.rx ? replacement : () => replacement);

      if (!count || next === original) continue;

      await writeFile(path, next);
      changedFiles += 1;
      changedMatches += count;

      if (tab) {
        tab.content = next;
        tab.savedContent = next;

        if (appState.activeFilePath === path) {
          appState.activeFileContent = next;
          const view = appState.editorView;
          view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
          appState.isDirty = false;
          tab.isDirty = false;
        }
      }
    } catch (error) {
      skipped.push(`${path} (${String(error?.message || error)})`);
    }
  }

  const summary = `${changedMatches} ${t("reemplazos en", "replacements in")} ${changedFiles} ${t("archivo(s)", "file(s)")}`;

  if (skipped.length) {
    toastWarning(`${summary}. ${t("Omitidos", "Skipped")}: ${skipped.length} (${t("cambios sin guardar o error", "unsaved changes or error")}).`, t("Reemplazar", "Replace"));
  } else {
    toastSuccess(summary, t("Reemplazar", "Replace"));
  }

  return { changedFiles, changedMatches, skipped };
}

/* ====================================================================== */
/* Arranque y comandos                                                     */
/* ====================================================================== */

let started = false;

export function initLabs2() {
  if (started) return;
  started = true;

  window.addEventListener("au:file-active", (event) => trackRecentFile(event.detail?.path));

  document.addEventListener(
    "keydown",
    (event) => {
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (ctrl && !event.shiftKey && !event.altKey && key === "e") {
        event.preventDefault();
        event.stopPropagation();
        openRecentFiles();
        return;
      }

      if (event.altKey && !ctrl && !event.shiftKey && (key === "s" || key === "m")) {
        event.preventDefault();
        event.stopPropagation();
        if (key === "s") openSnippets();
        else openMarkdownPreview();
      }
    },
    true
  );
}

export function createLabs2Commands() {
  const group = "Aurelius Labs";

  return [
    {
      id: "lab-recent",
      title: t("Archivos recientes…", "Recent files…"),
      description: t("Salta rápido a los últimos archivos abiertos de este proyecto.", "Jump to the last files opened in this project."),
      group,
      icon: "history",
      shortcut: "Ctrl+E",
      keywords: ["recent", "recientes", "ultimos", "files"],
      run: openRecentFiles
    },
    {
      id: "lab-snippets",
      title: t("Insertar snippet…", "Insert snippet…"),
      description: t("Plantillas con campos editables (Tab para saltar).", "Templates with editable fields (Tab to jump)."),
      group,
      icon: "code",
      shortcut: "Alt+S",
      keywords: ["snippet", "plantilla", "template"],
      run: openSnippets
    },
    {
      id: "lab-snippets-manage",
      title: t("Gestionar snippets", "Manage snippets"),
      description: t("Crear, editar o eliminar tus snippets.", "Create, edit or delete your snippets."),
      group,
      icon: "code",
      keywords: ["snippet", "gestionar", "manage"],
      run: openSnippetManager
    },
    {
      id: "lab-markdown",
      title: t("Vista previa Markdown", "Markdown preview"),
      description: t("Renderiza el documento actual como Markdown.", "Render the current document as Markdown."),
      group,
      icon: "eye",
      shortcut: "Alt+M",
      keywords: ["markdown", "preview", "vista", "md"],
      run: openMarkdownPreview
    }
  ];
}
