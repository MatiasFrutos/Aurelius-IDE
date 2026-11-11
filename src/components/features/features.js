// src/components/features/features.js
// Apariencia, modo Zen, Flow timer, Scratchpad e Historial local de archivos.
import { appState, updateSetting } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";
import { refreshIcons } from "../../app/app-icons.js";
import { EditorView } from "@codemirror/view";
import { jumpToBookmark, listBookmarks, toggleBookmarkAtCursor } from "../../editor/extras.js";

/* ====================================================================== */
/* Utilidades                                                              */
/* ====================================================================== */

const root = document.documentElement;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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
    return true;
  } catch {
    return false;
  }
}

/* ====================================================================== */
/* Apariencia                                                              */
/* ====================================================================== */

export const ACCENTS = {
  azure: [77, 141, 255],
  cyan: [56, 189, 248],
  violet: [139, 124, 255],
  emerald: [52, 211, 153],
  lime: [163, 230, 53],
  amber: [251, 191, 36],
  rose: [251, 113, 133]
};

const SURFACES = ["obsidian", "midnight", "graphite"];
const APPEARANCE_KEY = "aurelius.appearance.v2";
const appearance = {
  accent: "azure",
  surface: "obsidian",
  motion: true,
  minimap: true,
  swatches: true,
  rainbow: true,
  wrap: true,
  ...load(APPEARANCE_KEY, {})
};

function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function applyAppearance() {
  const accent = ACCENTS[appearance.accent] ? appearance.accent : "azure";
  root.dataset.accent = accent;
  root.style.setProperty("--au-accent-rgb", ACCENTS[accent].join(", "));
  root.style.setProperty(
    "--au-primary-contrast",
    root.dataset.theme === "light" || luminance(ACCENTS[accent]) < 0.28 ? "#ffffff" : "#04121c"
  );
  root.dataset.surface = SURFACES.includes(appearance.surface) ? appearance.surface : "obsidian";
  root.dataset.motion = appearance.motion ? "on" : "off";
  root.dataset.minimap = appearance.minimap ? "on" : "off";
  root.dataset.swatches = appearance.swatches ? "on" : "off";
  root.dataset.rainbow = appearance.rainbow ? "on" : "off";
  root.dataset.wrap = appearance.wrap ? "on" : "off";
}

export function setAppearance(patch) {
  Object.assign(appearance, patch);
  save(APPEARANCE_KEY, appearance);
  applyAppearance();
}

export function cycleAccent() {
  const keys = Object.keys(ACCENTS);
  const next = keys[(keys.indexOf(appearance.accent) + 1) % keys.length];
  setAppearance({ accent: next });
  toastInfo(next, t("Color de acento", "Accent color"));
}

/* ====================================================================== */
/* Zen                                                                     */
/* ====================================================================== */

export function isZen() {
  return root.dataset.zen === "on";
}

export function toggleZen(force) {
  const next = typeof force === "boolean" ? force : !isZen();

  root.dataset.zen = next ? "on" : "off";
  requestAnimationFrame(() => appState.editorView?.requestMeasure?.());

  if (next) {
    toastInfo(t("Esc para salir del modo Zen.", "Press Esc to leave Zen mode."), "Zen");
  }
}

/* ====================================================================== */
/* Overlay genérico                                                        */
/* ====================================================================== */

let overlayEl = null;
let overlayCleanup = null;

export function closeOverlay() {
  overlayCleanup?.();
  overlayCleanup = null;

  if (overlayEl) {
    const el = overlayEl;
    overlayEl = null;
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 140);
  }
}

export function openOverlay({ title, icon, width = 560, body, onMount }) {
  closeOverlay();

  const el = document.createElement("div");
  el.className = "au-fx-overlay";
  el.innerHTML = `
    <div class="au-fx-card" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}" style="--w:${width}px">
      <header class="au-fx-card__head">
        <i data-lucide="${icon}"></i>
        <strong>${escapeHTML(title)}</strong>
        <button type="button" class="au-fx-icon-btn" data-fx-close aria-label="${t("Cerrar", "Close")}">
          <i data-lucide="x"></i>
        </button>
      </header>
      <div class="au-fx-card__body">${body}</div>
    </div>`;

  el.addEventListener("mousedown", (event) => {
    if (event.target === el) closeOverlay();
  });
  el.querySelector("[data-fx-close]").addEventListener("click", closeOverlay);

  document.body.appendChild(el);
  overlayEl = el;
  refreshIcons();
  overlayCleanup = onMount?.(el) || null;
}

/* ====================================================================== */
/* Panel de apariencia                                                     */
/* ====================================================================== */

export function openAppearancePanel() {
  const toggles = [
    ["motion", t("Animaciones", "Animations")],
    ["minimap", t("Minimapa", "Minimap")],
    ["swatches", t("Muestras de color en código", "Inline color swatches")],
    ["rainbow", t("Paréntesis arcoíris", "Rainbow brackets")],
    ["wrap", t("Ajuste de línea", "Word wrap")]
  ];

  const render = () => `
    <section class="au-fx-section">
      <h4>${t("Tema", "Theme")}</h4>
      <div class="au-fx-seg">
        ${["dark", "light"]
          .map(
            (theme) => `<button type="button" data-theme-set="${theme}" class="${appState.settings.theme === theme ? "is-on" : ""}">
              ${theme === "dark" ? t("Oscuro", "Dark") : t("Claro", "Light")}</button>`
          )
          .join("")}
      </div>
    </section>
    <section class="au-fx-section">
      <h4>${t("Superficie (modo oscuro)", "Surface (dark mode)")}</h4>
      <div class="au-fx-seg">
        ${SURFACES.map(
          (surface) => `<button type="button" data-surface="${surface}" class="${appearance.surface === surface ? "is-on" : ""}">
            ${{ obsidian: "Obsidian", midnight: "Midnight · AMOLED", graphite: "Graphite" }[surface]}</button>`
        ).join("")}
      </div>
    </section>
    <section class="au-fx-section">
      <h4>${t("Color de acento", "Accent color")}</h4>
      <div class="au-fx-swatches">
        ${Object.entries(ACCENTS)
          .map(
            ([name, rgb]) => `<button type="button" data-accent-set="${name}" title="${name}"
              class="${appearance.accent === name ? "is-on" : ""}" style="--c:rgb(${rgb.join(",")})"></button>`
          )
          .join("")}
      </div>
    </section>
    <section class="au-fx-section">
      <h4>${t("Editor y movimiento", "Editor & motion")}</h4>
      ${toggles
        .map(
          ([key, label]) => `<label class="au-fx-switch">
            <span>${label}</span>
            <input type="checkbox" data-toggle="${key}" ${appearance[key] ? "checked" : ""} />
            <i></i>
          </label>`
        )
        .join("")}
    </section>`;

  openOverlay({
    title: t("Apariencia", "Appearance"),
    icon: "palette",
    width: 460,
    body: `<div id="au-fx-appearance">${render()}</div>`,
    onMount: (el) => {
      const host = el.querySelector("#au-fx-appearance");

      host.addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        if (!button) return;

        if (button.dataset.accentSet) setAppearance({ accent: button.dataset.accentSet });
        if (button.dataset.surface) setAppearance({ surface: button.dataset.surface });

        if (button.dataset.themeSet) {
          updateSetting("theme", button.dataset.themeSet);
          applyAppearance();

          try {
            const { persistSettings } = await import("../../app/app-settings.js");
            await persistSettings();
          } catch (error) {
            console.error(error);
          }
        }

        host.innerHTML = render();
      });

      host.addEventListener("change", (event) => {
        const input = event.target.closest("[data-toggle]");
        if (input) setAppearance({ [input.dataset.toggle]: input.checked });
      });
    }
  });
}

/* ====================================================================== */
/* Flow timer                                                              */
/* ====================================================================== */

const FLOW_KEY = "aurelius.flow.v1";
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const flow = {
  mode: "focus", // focus | break
  running: false,
  remaining: FOCUS_SECONDS,
  endsAt: 0,
  ...load(FLOW_KEY, {})
};

const today = () => new Date().toISOString().slice(0, 10);
const flowStats = load("aurelius.flow.stats.v1", { day: today(), sessions: 0 });

if (flowStats.day !== today()) {
  flowStats.day = today();
  flowStats.sessions = 0;
}

flow.running = false;

function saveFlow() {
  save(FLOW_KEY, { mode: flow.mode, remaining: flow.remaining });
  save("aurelius.flow.stats.v1", flowStats);
}

function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function getFlowLabel() {
  if (!flow.running && flow.remaining === FOCUS_SECONDS && flow.mode === "focus") {
    return flowStats.sessions ? `Flow · ${flowStats.sessions}` : "Flow";
  }

  return `${flow.mode === "focus" ? "Focus" : t("Pausa", "Break")} ${fmt(flow.remaining)}`;
}

export function getFlowClass() {
  return flow.running ? `is-running is-${flow.mode}` : "";
}

function paintFlow() {
  const el = document.getElementById("status-flow");
  if (!el) return;

  el.classList.toggle("is-running", flow.running);
  el.classList.toggle("is-break", flow.running && flow.mode === "break");

  const label = el.querySelector("span");
  if (label) label.textContent = getFlowLabel();
}

let flowTimer = null;

function tickFlow() {
  flow.remaining = Math.max(0, Math.round((flow.endsAt - Date.now()) / 1000));

  if (flow.remaining <= 0) {
    if (flow.mode === "focus") {
      flowStats.sessions += 1;
      toastSuccess(
        t("Sesión completada. ¡Tomá 5 minutos!", "Session done. Take 5 minutes!"),
        t("Flow", "Flow")
      );
      flow.mode = "break";
      flow.remaining = BREAK_SECONDS;
    } else {
      toastInfo(t("Pausa terminada. A enfocarse.", "Break over. Back to focus."), "Flow");
      flow.mode = "focus";
      flow.remaining = FOCUS_SECONDS;
    }

    flow.endsAt = Date.now() + flow.remaining * 1000;
    saveFlow();
  }

  paintFlow();
}

export function toggleFlow() {
  if (flow.running) {
    flow.running = false;
    clearInterval(flowTimer);
    saveFlow();
  } else {
    flow.running = true;
    flow.endsAt = Date.now() + flow.remaining * 1000;
    flowTimer = setInterval(tickFlow, 500);
  }

  paintFlow();
}

export function resetFlow() {
  flow.running = false;
  clearInterval(flowTimer);
  flow.mode = "focus";
  flow.remaining = FOCUS_SECONDS;
  saveFlow();
  paintFlow();
  toastInfo(t("Temporizador reiniciado.", "Timer reset."), "Flow");
}

/* ====================================================================== */
/* Scratchpad                                                              */
/* ====================================================================== */

const SCRATCH_KEY = "aurelius.scratchpad.v1";

export function toggleScratchpad() {
  const existing = document.getElementById("au-scratchpad");

  if (existing) {
    existing.classList.add("is-leaving");
    setTimeout(() => existing.remove(), 140);
    return;
  }

  const el = document.createElement("aside");
  el.id = "au-scratchpad";
  el.className = "au-scratch";
  el.innerHTML = `
    <header>
      <i data-lucide="notebook-pen"></i>
      <strong>Scratchpad</strong>
      <span class="au-scratch__hint">${t("se guarda solo", "autosaves")}</span>
      <button type="button" class="au-fx-icon-btn" data-act="insert" title="${t("Insertar en el editor", "Insert in editor")}"><i data-lucide="arrow-right"></i></button>
      <button type="button" class="au-fx-icon-btn" data-act="copy" title="${t("Copiar", "Copy")}"><i data-lucide="copy"></i></button>
      <button type="button" class="au-fx-icon-btn" data-act="close" title="${t("Cerrar", "Close")}"><i data-lucide="x"></i></button>
    </header>
    <textarea spellcheck="false" placeholder="${t("Notas, snippets, ideas…", "Notes, snippets, ideas…")}"></textarea>`;

  const area = el.querySelector("textarea");
  area.value = load(SCRATCH_KEY, "") || "";

  let timer = null;
  area.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => save(SCRATCH_KEY, area.value), 250);
  });

  el.addEventListener("click", async (event) => {
    const act = event.target.closest("[data-act]")?.dataset.act;
    if (!act) return;

    if (act === "close") toggleScratchpad();

    if (act === "copy") {
      try {
        await navigator.clipboard.writeText(area.value);
        toastSuccess(t("Copiado.", "Copied."), "Scratchpad");
      } catch (error) {
        toastError(String(error), "Scratchpad");
      }
    }

    if (act === "insert") {
      const view = appState.editorView;
      if (!view) {
        toastInfo(t("Abrí un archivo primero.", "Open a file first."), "Scratchpad");
        return;
      }
      view.dispatch(view.state.replaceSelection(area.value));
      view.focus();
    }
  });

  document.body.appendChild(el);
  refreshIcons();
  area.focus();
}

/* ====================================================================== */
/* Historial local                                                         */
/* ====================================================================== */

const HISTORY_PREFIX = "aurelius.history.v1:";
const HISTORY_MAX_VERSIONS = 20;
const HISTORY_MAX_CHARS = 600_000;

function historyKey(path) {
  return HISTORY_PREFIX + String(path || "");
}

export function recordSnapshot(path, content) {
  if (!path || typeof content !== "string" || content.length > 400_000) return;

  const list = load(historyKey(path), []);
  if (list[0]?.content === content) return;

  list.unshift({ at: Date.now(), content });
  list.length = Math.min(list.length, HISTORY_MAX_VERSIONS);

  let total = list.reduce((sum, item) => sum + item.content.length, 0);
  while (total > HISTORY_MAX_CHARS && list.length > 1) {
    total -= list.pop().content.length;
  }

  save(historyKey(path), list);
}

function lineDiff(a, b) {
  const A = a.split("\n");
  const B = b.split("\n");

  if (A.length > 1200 || B.length > 1200) {
    return null;
  }

  const rows = A.length + 1;
  const cols = B.length + 1;
  const dp = new Uint16Array(rows * cols);

  for (let i = A.length - 1; i >= 0; i -= 1) {
    for (let j = B.length - 1; j >= 0; j -= 1) {
      dp[i * cols + j] =
        A[i] === B[j] ? dp[(i + 1) * cols + j + 1] + 1 : Math.max(dp[(i + 1) * cols + j], dp[i * cols + j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;

  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      out.push([" ", A[i]]);
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
      out.push(["-", A[i]]);
      i += 1;
    } else {
      out.push(["+", B[j]]);
      j += 1;
    }
  }

  while (i < A.length) out.push(["-", A[i++]]);
  while (j < B.length) out.push(["+", B[j++]]);

  return out;
}

export function renderDiff(snapshot, current) {
  const diff = lineDiff(snapshot, current);

  if (!diff) {
    return `<p class="au-fx-muted">${t("Archivo demasiado grande para mostrar diferencias.", "File too large to diff.")}</p>`;
  }

  if (!diff.some(([kind]) => kind !== " ")) {
    return `<p class="au-fx-muted">${t("Idéntica al contenido actual.", "Identical to the current content.")}</p>`;
  }

  // Solo cambios con 2 líneas de contexto
  const keep = new Set();
  diff.forEach(([kind], index) => {
    if (kind !== " ") for (let k = index - 2; k <= index + 2; k += 1) keep.add(k);
  });

  const lines = [];
  let last = -1;

  diff.forEach(([kind, text], index) => {
    if (!keep.has(index)) return;
    if (last !== -1 && index - last > 1) lines.push(`<div class="au-diff__gap">⋯</div>`);
    last = index;
    lines.push(
      `<div class="au-diff__line is-${kind === "+" ? "add" : kind === "-" ? "del" : "ctx"}"><b>${kind}</b><code>${escapeHTML(text) || " "}</code></div>`
    );
  });

  return `<div class="au-diff">${lines.join("")}</div>`;
}

export function openLocalHistory() {
  const path = appState.activeFilePath;

  if (!path) {
    toastInfo(t("Abrí un archivo para ver su historial.", "Open a file to see its history."), t("Historial local", "Local history"));
    return;
  }

  const list = load(historyKey(path), []);

  if (!list.length) {
    toastInfo(
      t("Todavía no hay versiones. Se guarda una en cada Ctrl+S.", "No versions yet. One is stored on every Ctrl+S."),
      t("Historial local", "Local history")
    );
    return;
  }

  const current = appState.editorView?.state.doc.toString() ?? appState.activeFileContent ?? "";

  openOverlay({
    title: `${t("Historial local", "Local history")} · ${appState.activeFileName || ""}`,
    icon: "history",
    width: 880,
    body: `
      <div class="au-hist">
        <ul class="au-hist__list">
          ${list
            .map(
              (item, index) => `<li><button type="button" data-i="${index}" class="${index === 0 ? "is-on" : ""}">
                <strong>${new Date(item.at).toLocaleTimeString()}</strong>
                <span>${new Date(item.at).toLocaleDateString()} · ${item.content.split("\n").length} ${t("líneas", "lines")}</span>
              </button></li>`
            )
            .join("")}
        </ul>
        <div class="au-hist__main">
          <div class="au-hist__view" id="au-hist-view"></div>
          <footer><button type="button" class="au-fx-btn" id="au-hist-restore">${t("Restaurar esta versión", "Restore this version")}</button></footer>
        </div>
      </div>`,
    onMount: (el) => {
      let selected = 0;
      const view = el.querySelector("#au-hist-view");
      const show = (index) => {
        selected = index;
        el.querySelectorAll(".au-hist__list button").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.i) === index));
        view.innerHTML = renderDiff(list[index].content, current);
      };

      el.querySelector(".au-hist__list").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-i]");
        if (button) show(Number(button.dataset.i));
      });

      el.querySelector("#au-hist-restore").addEventListener("click", () => {
        const editor = appState.editorView;
        if (!editor) return;

        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: list[selected].content } });
        closeOverlay();
        toastSuccess(t("Versión restaurada (sin guardar).", "Version restored (unsaved)."), t("Historial local", "Local history"));
      });

      show(0);
    }
  });
}


/* ====================================================================== */
/* Diff de cambios sin guardar                                             */
/* ====================================================================== */

export function openUnsavedDiff() {
  const tab = appState.openTabs.find((item) => item.path === appState.activeFilePath);
  const view = appState.editorView;

  if (!tab || !view) {
    toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Cambios sin guardar", "Unsaved changes"));
    return;
  }

  const current = view.state.doc.toString();

  openOverlay({
    title: `${t("Cambios sin guardar", "Unsaved changes")} · ${appState.activeFileName || ""}`,
    icon: "git-compare",
    width: 820,
    body: `<div class="au-hist__view" style="max-height:62vh">${renderDiff(tab.savedContent ?? "", current)}</div>`
  });
}

/* ====================================================================== */
/* Ir a símbolo (Ctrl+Shift+O)                                             */
/* ====================================================================== */

const SYMBOL_PATTERNS = {
  js: [
    ["fn", /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([\w$]+)/],
    ["fn", /^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/],
    ["class", /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/],
    ["type", /^\s*(?:export\s+)?(?:interface|type|enum)\s+([\w$]+)/]
  ],
  py: [
    ["fn", /^\s*(?:async\s+)?def\s+(\w+)/],
    ["class", /^\s*class\s+(\w+)/]
  ],
  rs: [
    ["fn", /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/],
    ["type", /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|mod|type)\s+(\w+)/],
    ["class", /^\s*impl(?:<[^>]*>)?\s+([\w:<>, ]+?)\s*(?:for\s+[\w:<>, ]+)?\s*\{/]
  ],
  go: [
    ["fn", /^func\s+(?:\([^)]*\)\s*)?(\w+)/],
    ["type", /^type\s+(\w+)\s+(?:struct|interface)/]
  ],
  md: [["head", /^(#{1,6})\s+(.+)$/]],
  c: [
    ["fn", /^[\w:<>*&\s]+?\s+\*?([\w:~]+)\s*\([^;{)]*\)\s*(?:const\s*)?\{?\s*$/],
    ["class", /^\s*(?:public\s+|private\s+|abstract\s+|final\s+|static\s+)*(?:class|struct|interface|enum)\s+(\w+)/]
  ],
  css: [["type", /^\s*((?:[.#]?[\w-]+|@media[^{]*)[^{;]*)\{/]]
};

function symbolKey(path = "") {
  const ext = String(path).split(".").pop().toLowerCase();

  if (["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "vue", "svelte"].includes(ext)) return "js";
  if (ext === "py") return "py";
  if (ext === "rs") return "rs";
  if (ext === "go") return "go";
  if (["md", "markdown"].includes(ext)) return "md";
  if (["java", "c", "h", "cpp", "hpp", "cc", "cs", "kt", "php", "swift"].includes(ext)) return "c";
  if (["css", "scss", "less"].includes(ext)) return "css";
  return "";
}

const C_KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "else", "do", "sizeof"]);

export function collectSymbols(path, text) {
  const patterns = SYMBOL_PATTERNS[symbolKey(path)] || [];
  const out = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (line.length > 400) return;

    for (const [kind, regex] of patterns) {
      const match = line.match(regex);

      if (!match) continue;

      const name = kind === "head" ? `${match[1]} ${match[2]}` : match[1];

      if (symbolKey(path) === "c" && kind === "fn" && C_KEYWORDS.has(name)) continue;

      out.push({ kind, name: name.trim(), line: index + 1 });
      break;
    }

    const tag = line.match(/(?:\/\/|#|\/\*|<!--|--)\s*(TODO|FIXME|HACK|BUG|XXX)\b[:\s]*(.*)$/);

    if (tag) out.push({ kind: "todo", name: `${tag[1]} ${tag[2]}`.trim().slice(0, 90), line: index + 1 });
  });

  return out;
}

function jumpToLine(lineNumber) {
  const view = appState.editorView;
  if (!view) return;

  const line = view.state.doc.line(Math.min(Math.max(1, lineNumber), view.state.doc.lines));

  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: "center" })
  });
  view.focus();
}

export function openSymbolPicker(mode = "symbols") {
  const view = appState.editorView;

  if (!view) {
    toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Ir a símbolo", "Go to symbol"));
    return;
  }

  const symbols =
    mode === "bookmarks"
      ? listBookmarks(view).map((item) => ({ kind: "mark", name: item.text || t("(línea vacía)", "(empty line)"), line: item.line }))
      : collectSymbols(appState.activeFilePath, view.state.doc.toString());

  if (!symbols.length) {
    toastInfo(
      mode === "bookmarks"
        ? t("No hay marcadores. Alt+B marca la línea actual.", "No bookmarks. Alt+B marks the current line.")
        : t("No se encontraron símbolos en este archivo.", "No symbols found in this file."),
      mode === "bookmarks" ? t("Marcadores", "Bookmarks") : t("Ir a símbolo", "Go to symbol")
    );
    return;
  }

  openOverlay({
    title: mode === "bookmarks" ? t("Marcadores", "Bookmarks") : t("Ir a símbolo", "Go to symbol"),
    icon: mode === "bookmarks" ? "hash" : "braces",
    width: 600,
    body: `<input class="au-sym__input" placeholder="${t("Filtrar…", "Filter…")}" /><ul class="au-sym__list"></ul>`,
    onMount: (el) => {
      const input = el.querySelector("input");
      const list = el.querySelector("ul");
      let filtered = symbols;
      let active = 0;

      const paint = () => {
        list.innerHTML = filtered
          .map(
            (item, index) => `<li><button type="button" data-i="${index}" class="${index === active ? "is-on" : ""}">
              <span class="au-sym__kind">${escapeHTML(item.kind)}</span>
              <span class="au-sym__name">${escapeHTML(item.name)}</span>
              <span class="au-sym__line">:${item.line}</span></button></li>`
          )
          .join("");

        list.querySelector(".is-on")?.scrollIntoView({ block: "nearest" });
      };

      const go = (index) => {
        const item = filtered[index];
        if (!item) return;
        closeOverlay();
        jumpToLine(item.line);
      };

      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        filtered = symbols.filter((item) => !q || `${item.kind} ${item.name}`.toLowerCase().includes(q));
        active = 0;
        paint();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          active = Math.min(filtered.length - 1, active + 1);
          paint();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          active = Math.max(0, active - 1);
          paint();
        } else if (event.key === "Enter") {
          event.preventDefault();
          go(active);
        }
      });

      list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-i]");
        if (button) go(Number(button.dataset.i));
      });

      paint();
      input.focus();
      setTimeout(() => input.focus(), 30);
    }
  });
}

/* Selector genérico (lista filtrable con teclado) */
export function openPicker({ title, icon = "search", items, onPick, footer = "", onFooter }) {
  openOverlay({
    title,
    icon,
    width: 600,
    body: `<input class="au-sym__input" placeholder="${t("Filtrar…", "Filter…")}" /><ul class="au-sym__list"></ul>${footer ? `<div class="au-sym__footer">${footer}</div>` : ""}`,
    onMount: (el) => {
      const input = el.querySelector("input");
      const list = el.querySelector("ul");
      let filtered = items;
      let active = 0;

      const paint = () => {
        list.innerHTML = filtered
          .map(
            (item, index) => `<li><button type="button" data-i="${index}" class="${index === active ? "is-on" : ""}">
              <span class="au-sym__kind">${escapeHTML(item.kind || "")}</span>
              <span class="au-sym__name">${escapeHTML(item.name)}</span>
              <span class="au-sym__line">${escapeHTML(item.meta || "")}</span></button></li>`
          )
          .join("");
        list.querySelector(".is-on")?.scrollIntoView({ block: "nearest" });
      };

      const pick = (index) => {
        const item = filtered[index];
        if (!item) return;
        closeOverlay();
        onPick?.(item);
      };

      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        filtered = items.filter((item) => !q || `${item.name} ${item.meta || ""}`.toLowerCase().includes(q));
        active = 0;
        paint();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); active = Math.min(filtered.length - 1, active + 1); paint(); }
        else if (event.key === "ArrowUp") { event.preventDefault(); active = Math.max(0, active - 1); paint(); }
        else if (event.key === "Enter") { event.preventDefault(); pick(active); }
      });

      list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-i]");
        if (button) pick(Number(button.dataset.i));
      });

      el.querySelector("[data-fx-manage-snippets]")?.addEventListener("click", () => {
        closeOverlay();
        onFooter?.();
      });

      paint();
      input.focus();
      setTimeout(() => input.focus(), 30);
    }
  });
}

export function toggleBookmark() {
  if (!toggleBookmarkAtCursor(appState.editorView)) {
    toastInfo(t("Abrí un archivo primero.", "Open a file first."), t("Marcadores", "Bookmarks"));
  }
}

export function nextBookmark(direction = 1) {
  if (!jumpToBookmark(appState.editorView, direction)) {
    toastInfo(t("No hay marcadores en este archivo.", "No bookmarks in this file."), t("Marcadores", "Bookmarks"));
  }
}

export function toggleWrap() {
  setAppearance({ wrap: !appearance.wrap });
  toastInfo(appearance.wrap ? t("Activado", "On") : t("Desactivado", "Off"), t("Ajuste de línea", "Word wrap"));
}

/* ====================================================================== */
/* Arranque                                                                */
/* ====================================================================== */

let started = false;

export function initFeatures() {
  if (started) return;
  started = true;

  applyAppearance();
  new MutationObserver(() => applyAppearance()).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("beforeunload", saveFlow);

  document.addEventListener("click", (event) => {
    const flowEl = event.target.closest("#status-flow");
    if (flowEl) toggleFlow();
  });

  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest("#status-flow")) {
      event.preventDefault();
      resetFlow();
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        if (overlayEl) {
          event.preventDefault();
          closeOverlay();
          return;
        }

        if (isZen()) {
          event.preventDefault();
          toggleZen(false);
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        event.stopPropagation();
        openSymbolPicker();
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const key = event.key.toLowerCase();
      const map = {
        z: () => toggleZen(),
        a: openAppearancePanel,
        j: toggleScratchpad,
        h: openLocalHistory,
        t: toggleFlow,
        b: toggleBookmark,
        ".": () => nextBookmark(1),
        ",": () => nextBookmark(-1),
        w: toggleWrap,
        d: openUnsavedDiff
      };

      if (map[key]) {
        event.preventDefault();
        event.stopPropagation();
        map[key]();
      }
    },
    true
  );
}

export function createFeatureCommands() {
  const group = t("Aurelius Labs", "Aurelius Labs");

  return [
    {
      id: "fx-zen",
      title: t("Modo Zen", "Zen mode"),
      description: t("Oculta todo excepto el editor. Esc para salir.", "Hide everything but the editor. Esc to exit."),
      group,
      icon: "maximize-2",
      shortcut: "Alt+Z",
      keywords: ["zen", "focus", "foco", "fullscreen"],
      run: () => toggleZen()
    },
    {
      id: "fx-appearance",
      title: t("Apariencia…", "Appearance…"),
      description: t("Tema, superficie, color de acento y animaciones.", "Theme, surface, accent color and animations."),
      group,
      icon: "palette",
      shortcut: "Alt+A",
      keywords: ["theme", "tema", "accent", "acento", "color", "amoled", "apariencia"],
      run: openAppearancePanel
    },
    {
      id: "fx-accent",
      title: t("Siguiente color de acento", "Next accent color"),
      description: t("Rota entre los colores de acento.", "Cycle through accent colors."),
      group,
      icon: "palette",
      keywords: ["accent", "acento", "color"],
      run: cycleAccent
    },
    {
      id: "fx-history",
      title: t("Historial local del archivo", "File local history"),
      description: t(
        "Compará y restaurá versiones guardadas de este archivo.",
        "Compare and restore saved versions of this file."
      ),
      group,
      icon: "history",
      shortcut: "Alt+H",
      keywords: ["history", "historial", "versions", "restore", "undo", "diff"],
      run: openLocalHistory
    },
    {
      id: "fx-scratchpad",
      title: "Scratchpad",
      description: t("Bloc de notas flotante que se guarda solo.", "Floating notepad that autosaves."),
      group,
      icon: "notebook-pen",
      shortcut: "Alt+J",
      keywords: ["notes", "notas", "scratch", "pad"],
      run: toggleScratchpad
    },
    {
      id: "fx-symbols",
      title: t("Ir a símbolo…", "Go to symbol…"),
      description: t("Funciones, clases, títulos y TODOs del archivo.", "Functions, classes, headings and TODOs in this file."),
      group,
      icon: "braces",
      shortcut: "Ctrl+Shift+O",
      keywords: ["symbol", "simbolo", "outline", "function", "funcion", "goto", "todo"],
      run: () => openSymbolPicker()
    },
    {
      id: "fx-bookmark",
      title: t("Marcador: alternar en la línea actual", "Bookmark: toggle on current line"),
      description: t("También con clic en el margen izquierdo.", "Also by clicking the left gutter."),
      group,
      icon: "hash",
      shortcut: "Alt+B",
      keywords: ["bookmark", "marcador", "marca"],
      run: toggleBookmark
    },
    {
      id: "fx-bookmark-next",
      title: t("Marcador: siguiente", "Bookmark: next"),
      description: t("Salta al siguiente marcador (Alt+, para el anterior).", "Jump to next bookmark (Alt+, for previous)."),
      group,
      icon: "hash",
      shortcut: "Alt+.",
      keywords: ["bookmark", "marcador", "next"],
      run: () => nextBookmark(1)
    },
    {
      id: "fx-bookmark-list",
      title: t("Marcadores: ver todos", "Bookmarks: list all"),
      description: t("Lista de marcadores del archivo activo.", "List bookmarks of the active file."),
      group,
      icon: "hash",
      keywords: ["bookmark", "marcador", "lista"],
      run: () => openSymbolPicker("bookmarks")
    },
    {
      id: "fx-wrap",
      title: t("Alternar ajuste de línea", "Toggle word wrap"),
      description: t("Activa o desactiva el salto de línea automático.", "Turn automatic line wrapping on or off."),
      group,
      icon: "text-cursor-input",
      shortcut: "Alt+W",
      keywords: ["wrap", "ajuste", "linea", "word"],
      run: toggleWrap
    },
    {
      id: "fx-unsaved-diff",
      title: t("Ver cambios sin guardar", "Show unsaved changes"),
      description: t("Diff entre el editor y la última versión guardada.", "Diff between the editor and the last saved version."),
      group,
      icon: "git-compare",
      shortcut: "Alt+D",
      keywords: ["diff", "cambios", "changes", "unsaved", "compare"],
      run: openUnsavedDiff
    },
    {
      id: "fx-flow",
      title: t("Flow timer: iniciar / pausar", "Flow timer: start / pause"),
      description: t(
        "Pomodoro integrado (25/5) en la barra de estado. Clic derecho para reiniciar.",
        "Built-in Pomodoro (25/5) in the status bar. Right-click to reset."
      ),
      group,
      icon: "timer",
      shortcut: "Alt+T",
      keywords: ["pomodoro", "timer", "focus", "flow"],
      run: toggleFlow
    },
    {
      id: "fx-flow-reset",
      title: t("Flow timer: reiniciar", "Flow timer: reset"),
      description: t("Vuelve a 25:00.", "Back to 25:00."),
      group,
      icon: "timer",
      keywords: ["pomodoro", "timer", "reset"],
      run: resetFlow
    }
  ];
}
