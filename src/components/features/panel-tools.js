// src/components/features/panel-tools.js
// Herramientas extra para los paneles existentes (Explorer, Búsqueda, Git, Monitor,
// Tasks, Doctor, Ajustes, IA). Se inyectan de forma idempotente tras cada render.
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastError, toastInfo, toastSuccess } from "../ui/toast.js";
import { runCommandInTerminal, openTerminalHere } from "../bottom-panel/bottom-panel.js";
import { refreshIcons } from "../../app/app-icons.js";
import { chatWithAi } from "../../services/fs.service.js";
import { probeToolVersions, readSystemDetails } from "../../services/shell.service.js";
import pkg from "../../../package.json";
import { injectWelcomeActions } from "./projects.js";
import { replaceInProject } from "./labs2.js";
import { getAiProviderPreset, normalizeAiRuntimeSettings } from "../../app/app-settings.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`aurelius.px.${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`aurelius.px.${key}`, JSON.stringify(value));
    } catch {
      // sin almacenamiento
    }
  }
};

function markInjected() {
  window.__auPxInjected = true;
}

function rerender() {
  window.dispatchEvent(new CustomEvent("au:rerender"));
}

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toastSuccess(t("Copiado al portapapeles.", "Copied to clipboard."), label);
  } catch (error) {
    toastError(String(error), label);
  }
}

function runInTerminal(command, title) {
  if (!appState.projectPath) {
    toastInfo(t("Abrí un proyecto primero.", "Open a project first."), t("Terminal", "Terminal"));
    return;
  }

  if (!appState.layout.bottomPanelVisible) {
    appState.layout.bottomPanelVisible = true;
    rerender();
  }

  setTimeout(() => runCommandInTerminal(command, { title }), appState.layout.bottomPanelVisible ? 0 : 80);
}

const btn = (action, icon, label, extra = "") =>
  `<button type="button" class="au-px__btn ${extra}" data-px="${action}" title="${esc(label)}"><i data-lucide="${icon}"></i><span>${esc(label)}</span></button>`;

function bar(name, inner, extraClass = "") {
  return `<div class="au-px ${extraClass}" data-px-bar="${name}">${inner}</div>`;
}

/* ---------------------------------------------------------------- */
/* Explorer                                                          */
/* ---------------------------------------------------------------- */

function collectDirs(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.is_dir || node.isDir) {
      out.push(node.path);
      collectDirs(node.children, out);
    }
  }
  return out;
}

function injectExplorer() {
  const anchor = document.querySelector(".au-explorer__meta");
  if (!anchor || document.querySelector('[data-px-bar="explorer"]')) return;

  markInjected();
  // El Explorer es un grid de filas fijas: añadimos una fila para la barra.
  anchor.parentElement.style.gridTemplateRows = "48px 30px auto auto minmax(0, 1fr)";

  anchor.insertAdjacentHTML(
    "afterend",
    bar(
      "explorer",
      [
        btn("exp-collapse", "chevron-right", t("Colapsar", "Collapse")),
        btn("exp-expand", "chevron-down", t("Expandir", "Expand")),
        btn("exp-reveal", "crosshair", t("Revelar", "Reveal")),
        btn("exp-terminal", "terminal", t("Terminal", "Terminal")),
        btn("exp-copy", "copy", t("Ruta", "Path"))
      ].join("")
    )
  );
}

/* ---------------------------------------------------------------- */
/* Búsqueda                                                          */
/* ---------------------------------------------------------------- */

const searchFilters = store.get("search", { cs: false, word: false, rx: false, ext: "" });

function applySearchFilters() {
  const results = [...document.querySelectorAll(".au-search__result")];
  if (!results.length) return;

  const query = appState.search?.query || "";
  let regex = null;

  if (query) {
    try {
      const source = searchFilters.rx ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(searchFilters.word ? `\\b(?:${source})\\b` : source, searchFilters.cs ? "" : "i");
    } catch {
      regex = null;
    }
  }

  let visible = 0;

  for (const item of results) {
    const preview = item.querySelector(".au-search__result-preview")?.textContent || "";
    const path = decodeURIComponent(item.dataset.searchFilePath || "");
    const extOk = !searchFilters.ext || path.toLowerCase().endsWith(`.${searchFilters.ext}`);
    const textOk = !regex || regex.test(preview) || !preview;
    const show = extOk && textOk;

    item.style.display = show ? "" : "none";
    if (show) visible += 1;
  }

  const counter = document.querySelector("[data-px-count]");
  if (counter) counter.textContent = `${visible}/${results.length}`;
}

function injectSearch() {
  const form = document.getElementById("search-project-form");
  if (!form || document.querySelector('[data-px-bar="search"]')) return;

  const exts = [
    ...new Set(
      (appState.search?.results || [])
        .map((r) => String(r.path || "").split(".").pop().toLowerCase())
        .filter((e) => e && e.length < 8)
    )
  ].slice(0, 12);

  const toggle = (key, label, title) =>
    `<button type="button" class="au-px__chip ${searchFilters[key] ? "is-on" : ""}" data-px="srch-${key}" title="${esc(title)}">${label}</button>`;

  markInjected();
  form.parentElement.style.gridTemplateRows = "40px auto auto auto minmax(0, 1fr)";

  form.insertAdjacentHTML(
    "afterend",
    bar(
      "search",
      `${toggle("cs", "Aa", t("Distinguir mayúsculas", "Match case"))}
       ${toggle("word", "ab", t("Palabra completa", "Whole word"))}
       ${toggle("rx", ".*", t("Expresión regular", "Regular expression"))}
       <select class="au-px__select" data-px-ext title="${esc(t("Filtrar por extensión", "Filter by extension"))}">
         <option value="">${t("Todas", "All")}</option>
         ${exts.map((e) => `<option value="${e}" ${searchFilters.ext === e ? "selected" : ""}>.${e}</option>`).join("")}
       </select>
       <span class="au-px__count" data-px-count></span>
       ${btn("srch-copy", "copy", t("Copiar", "Copy"))}
       <div class="au-px__form au-px__replace">
         <input class="au-px__input" data-px-replace placeholder="${esc(t("Reemplazar por…", "Replace with…"))}" spellcheck="false" />
         ${btn("srch-replace", "pencil", t("Reemplazar todo", "Replace all"), "is-primary")}
       </div>`
    )
  );
}

/* ---------------------------------------------------------------- */
/* Git                                                               */
/* ---------------------------------------------------------------- */

const GIT_COMMANDS = [
  ["git-fetch", "refresh-cw", "Fetch", "git fetch --all --prune"],
  ["git-pull", "arrow-right", "Pull", "git pull --ff-only"],
  ["git-push", "send", "Push", "git push"],
  ["git-stash", "archive", "Stash", "git stash push -u"],
  ["git-pop", "undo-2", "Stash pop", "git stash pop"],
  ["git-log", "history", "Log", "git log --oneline --graph --decorate -n 30"],
  ["git-diffstat", "git-compare", "Diff stat", "git diff --stat"],
  ["git-branches", "git-branch", t("Ramas", "Branches"), "git branch -a -vv"],
  ["git-amend", "pencil", "Amend", "git commit --amend --no-edit"]
];

function injectGit() {
  const header = document.querySelector(".au-git-panel__header");
  if (!header || document.querySelector('[data-px-bar="git"]')) return;

  markInjected();
  header.parentElement.style.gridTemplateRows = "46px auto minmax(0, 1fr)";

  header.insertAdjacentHTML(
    "afterend",
    bar("git", btn("git-center", "git-branch", t("Centro de Git", "Git center"), "is-primary") + GIT_COMMANDS.map(([id, icon, label]) => btn(id, icon, label)).join(""), "is-wrap")
  );
}

/* ---------------------------------------------------------------- */
/* Monitor                                                           */
/* ---------------------------------------------------------------- */

const monitorHistory = { cpu: [], mem: [], lastStamp: null };
let monitorTimer = null;

function sample() {
  const m = appState.monitor;
  if (!m?.lastUpdatedAt || m.lastUpdatedAt === monitorHistory.lastStamp) return;

  monitorHistory.lastStamp = m.lastUpdatedAt;
  monitorHistory.cpu.push(Number(m.process?.cpuPercent) || 0);

  const total = Number(m.system?.totalMemoryBytes) || 0;
  monitorHistory.mem.push(total ? ((Number(m.system?.usedMemoryBytes) || 0) / total) * 100 : 0);

  for (const key of ["cpu", "mem"]) {
    if (monitorHistory[key].length > 60) monitorHistory[key].shift();
  }
}

function spark(values, label, unit) {
  const w = 300;
  const h = 56;
  const max = Math.max(10, ...values);
  const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  const last = values[values.length - 1] ?? 0;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return `<div class="au-px__spark"><header><span>${esc(label)}</span><strong>${last.toFixed(1)}${unit}</strong></header>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${values.length > 1 ? `<polyline points="${points}" />` : ""}</svg>
    <footer>${t("prom.", "avg")} ${avg.toFixed(1)}${unit} · ${t("máx.", "max")} ${Math.max(0, ...values).toFixed(1)}${unit} · ${values.length} ${t("muestras", "samples")}</footer></div>`;
}

function paintMonitor() {
  const host = document.querySelector('[data-px-bar="monitor"]');
  if (!host) return;
  host.querySelector("[data-px-sparks]").innerHTML = spark(monitorHistory.cpu, t("CPU proceso", "Process CPU"), "%") + spark(monitorHistory.mem, t("RAM sistema", "System RAM"), "%");
}

function setMonitorInterval(seconds) {
  clearInterval(monitorTimer);
  monitorTimer = null;
  if (seconds > 0) {
    monitorTimer = setInterval(() => {
      if (document.querySelector(".au-monitor")) {
        window.dispatchEvent(new CustomEvent("au:monitor-refresh"));
      } else {
        clearInterval(monitorTimer);
        monitorTimer = null;
      }
    }, seconds * 1000);
  }
}

function injectMonitor() {
  const header = document.querySelector(".au-monitor__header");
  if (!header) return;

  sample();

  if (document.querySelector('[data-px-bar="monitor"]')) {
    paintMonitor();
    return;
  }

  const current = store.get("monitor-interval", 0);

  markInjected();
  header.insertAdjacentHTML(
    "afterend",
    bar(
      "monitor",
      `<div class="au-px__row">
        <label class="au-px__inline">${t("Auto-actualizar", "Auto-refresh")}
          <select class="au-px__select" data-px-interval>
            ${[[0, t("Apagado", "Off")], [2, "2 s"], [5, "5 s"], [10, "10 s"], [30, "30 s"]].map(([v, l]) => `<option value="${v}" ${current === v ? "selected" : ""}>${l}</option>`).join("")}
          </select></label>
        ${btn("mon-copy", "copy", t("Copiar snapshot", "Copy snapshot"))}
        ${btn("mon-reset", "trash-2", t("Reiniciar historial", "Reset history"))}
      </div>
      <div class="au-px__sparks" data-px-sparks></div>`,
      "is-block"
    )
  );

  paintMonitor();
  if (current && !monitorTimer) setMonitorInterval(current);
}

/* ---------------------------------------------------------------- */
/* Tasks                                                             */
/* ---------------------------------------------------------------- */

function injectTasks() {
  const header = document.querySelector(".au-tasks__header");
  if (!header || document.querySelector('[data-px-bar="tasks"]')) return;

  const history = store.get("cmd-history", []);

  markInjected();
  header.insertAdjacentHTML(
    "afterend",
    bar(
      "tasks",
      `<form class="au-px__form" data-px-cmd-form>
        <i data-lucide="terminal"></i>
        <input class="au-px__input" data-px-cmd placeholder="${esc(t("Ejecutar cualquier comando en una terminal nueva…", "Run any command in a new terminal…"))}" spellcheck="false" list="au-px-history" />
        <datalist id="au-px-history">${history.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
        <button type="submit" class="au-px__btn is-primary">${t("Ejecutar", "Run")}</button>
      </form>
      ${history.length ? `<div class="au-px__recent">${history.slice(0, 6).map((c) => `<button type="button" class="au-px__chip" data-px="task-recent" data-cmd="${esc(c)}">${esc(c)}</button>`).join("")}${btn("task-clear", "trash-2", t("Borrar historial", "Clear history"))}</div>` : ""}`,
      "is-block"
    )
  );
}

/* ---------------------------------------------------------------- */
/* Doctor                                                            */
/* ---------------------------------------------------------------- */

const INSTALL_HINTS = {
  node: "sudo apt install nodejs npm   # o: curl -fsSL https://fnm.vercel.app/install | bash",
  npm: "sudo apt install npm",
  rust: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  cargo: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  git: "sudo apt install git",
  docker: "sudo apt install docker.io docker-compose-v2"
};

function injectToolchain() {
  const root = document.querySelector(".au-toolchain");
  if (!root || document.querySelector('[data-px-bar="toolchain"]')) return;

  const anchor = root.querySelector("header") || root.firstElementChild;

  markInjected();
  anchor?.insertAdjacentHTML(
    "afterend",
    bar(
      "toolchain",
      [btn("doc-copy", "copy", t("Copiar reporte (Markdown)", "Copy report (Markdown)")), btn("doc-hints", "wrench", t("Copiar comandos de instalación", "Copy install commands")), btn("doc-versions", "terminal", t("Versiones en terminal", "Versions in terminal"))].join("")
    )
  );
}

/* ---------------------------------------------------------------- */
/* Ajustes                                                           */
/* ---------------------------------------------------------------- */

const SHORTCUTS = [
  ["Ctrl+P", t("Abrir archivo rápido", "Quick open")], ["Ctrl+Shift+P", t("Paleta de comandos", "Command palette")], ["Ctrl+Shift+O", t("Ir a símbolo", "Go to symbol")],
  ["Ctrl+S", t("Guardar", "Save")], ["Alt+Z", "Zen"], ["Alt+A", t("Apariencia", "Appearance")], ["Alt+H", t("Historial local", "Local history")],
  ["Alt+D", t("Cambios sin guardar", "Unsaved changes")], ["Alt+B", t("Marcador", "Bookmark")], ["Alt+J", "Scratchpad"], ["Alt+T", "Flow timer"], ["Alt+W", t("Ajuste de línea", "Word wrap")]
];

function injectSettings() {
  const root = document.querySelector(".au-settings");
  if (!root || document.querySelector('[data-px-bar="settings"]')) return;

  markInjected();
  root.insertAdjacentHTML(
    "beforeend",
    `<section class="au-px au-px--settings" data-px-bar="settings">
      <h3>${t("Herramientas de configuración", "Configuration tools")}</h3>
      <div class="au-px__row">
        ${btn("set-export", "save", t("Exportar ajustes (JSON)", "Export settings (JSON)"))}
        ${btn("set-import", "file-plus-2", t("Importar ajustes", "Import settings"))}
        ${btn("set-reset-ui", "refresh-cw", t("Restablecer apariencia", "Reset appearance"))}
        ${btn("set-clear-data", "trash-2", t("Borrar datos locales (historial, notas)", "Clear local data (history, notes)"))}
      </div>
      <h3>${t("Atajos de teclado", "Keyboard shortcuts")}</h3>
      <div class="au-px__keys">${SHORTCUTS.map(([k, d]) => `<div><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join("")}</div>
      <input type="file" accept="application/json" hidden data-px-import />
    </section>`
  );
}

/* ---------------------------------------------------------------- */
/* IA: más acciones rápidas                                          */
/* ---------------------------------------------------------------- */

const AI_PROMPTS = [
  [t("Escribir tests", "Write tests"), "Escribí tests unitarios para el archivo activo, cubriendo casos borde. Devolvé solo el código."],
  [t("Documentar", "Document"), "Agregá documentación (docstrings/JSDoc) a las funciones del archivo activo sin cambiar su lógica."],
  [t("Optimizar", "Optimize"), "Revisá el archivo activo y proponé optimizaciones de rendimiento concretas con el código resultante."],
  [t("Mensaje de commit", "Commit message"), "Proponé un mensaje de commit (convencional, en una línea + cuerpo breve) para los cambios del archivo activo."],
  [t("Seguridad", "Security"), "Auditá el archivo activo buscando vulnerabilidades (inyección, secretos, validación). Listá hallazgos y arreglos."],
  [t("Simplificar", "Simplify"), "Simplificá el archivo activo manteniendo el comportamiento. Mostrá el diff conceptual y el código final."]
];

function injectAi() {
  const list = document.querySelector(".au-right-ai__quick-list");
  if (!list || list.querySelector("[data-px-ai]")) return;

  markInjected();
  list.insertAdjacentHTML(
    "beforeend",
    AI_PROMPTS.map(([label, prompt]) => `<button type="button" data-px-ai data-ai-quick-prompt="${esc(prompt)}"><span>${esc(label)}</span></button>`).join("")
  );
}


/* ---------------------------------------------------------------- */
/* Monitor: procesos, discos, red, batería                           */
/* ---------------------------------------------------------------- */

const fmtBytes = (n) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Number(n) || 0;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const fmtUptime = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d}d ` : ""}${h}h ${m}m`;
};

let lastNet = null;

function renderSystemDetails(details) {
  const host = document.querySelector("[data-px-sysdetails]");
  if (!host || !details) return;

  const now = Date.now();
  const totalRx = details.network.reduce((a, n) => a + n.rx_bytes, 0);
  const totalTx = details.network.reduce((a, n) => a + n.tx_bytes, 0);
  let rate = "";
  if (lastNet && now > lastNet.at) {
    const secs = (now - lastNet.at) / 1000;
    rate = `↓ ${fmtBytes(Math.max(0, totalRx - lastNet.rx) / secs)}/s · ↑ ${fmtBytes(Math.max(0, totalTx - lastNet.tx) / secs)}/s`;
  }
  lastNet = { at: now, rx: totalRx, tx: totalTx };

  const maxCpu = Math.max(1, ...details.processes.map((p) => p.cpu_percent));

  host.innerHTML = `
    <div class="au-px__chips">
      ${details.hostname ? `<span>${esc(details.hostname)}</span>` : ""}
      ${details.kernel ? `<span>Linux ${esc(details.kernel)}</span>` : ""}
      <span>${t("Encendido", "Uptime")} ${fmtUptime(details.uptime_seconds)}</span>
      ${details.battery_percent != null ? `<span>${t("Batería", "Battery")} ${details.battery_percent}% ${esc(details.battery_status || "")}</span>` : ""}
    </div>
    <div class="au-px__cols">
      <section class="au-px__card"><h4>${t("Procesos principales", "Top processes")}</h4>
        <table class="au-px__table"><thead><tr><th>${t("Proceso", "Process")}</th><th>PID</th><th>CPU</th><th>RAM</th></tr></thead><tbody>
        ${details.processes.slice(0, 10).map((p) => `<tr><td title="${esc(p.name)}">${esc(p.name)}</td><td>${p.pid}</td><td><span class="au-px__bar"><i style="--w:${Math.min(100, (p.cpu_percent / maxCpu) * 100)}%"></i></span> ${p.cpu_percent.toFixed(1)}%</td><td>${fmtBytes(p.memory_bytes)}</td></tr>`).join("")}
        </tbody></table></section>
      <section class="au-px__card"><h4>${t("Discos", "Disks")}</h4>
        ${details.disks.map((d) => { const pct = d.total_bytes ? (d.used_bytes / d.total_bytes) * 100 : 0; return `<div class="au-px__disk"><header><b>${esc(d.mount)}</b><span>${fmtBytes(d.used_bytes)} / ${fmtBytes(d.total_bytes)} · ${pct.toFixed(0)}%</span></header><span class="au-px__bar ${pct > 90 ? "is-hot" : ""}"><i style="--w:${pct}%"></i></span></div>`; }).join("") || `<p class="au-px__muted">—</p>`}
        <h4 style="margin-top:14px">${t("Red", "Network")}</h4>
        <p class="au-px__muted">${rate || t("Midiendo…", "Measuring…")}</p>
        ${details.network.map((n) => `<div class="au-px__net"><b>${esc(n.interface)}</b><span>↓ ${fmtBytes(n.rx_bytes)} · ↑ ${fmtBytes(n.tx_bytes)}</span></div>`).join("")}
      </section>
    </div>`;
}

let detailsBusy = false;

async function refreshSystemDetails() {
  if (detailsBusy || !document.querySelector("[data-px-sysdetails]")) return;
  detailsBusy = true;
  try {
    renderSystemDetails(await readSystemDetails());
  } catch (error) {
    const host = document.querySelector("[data-px-sysdetails]");
    if (host) host.innerHTML = `<p class="au-px__muted">${esc(String(error?.message || error))}</p>`;
  } finally {
    detailsBusy = false;
  }
}

function injectMonitorDetails() {
  const bar = document.querySelector('[data-px-bar="monitor"]');
  if (!bar || document.querySelector("[data-px-sysdetails]")) return;

  markInjected();
  bar.insertAdjacentHTML("afterend", `<div class="au-px au-px--page" data-px-sysdetails><p class="au-px__muted">${t("Leyendo el sistema…", "Reading the system…")}</p></div>`);
  refreshSystemDetails();
}

window.addEventListener("au:monitor-refresh", () => refreshSystemDetails());

/* ---------------------------------------------------------------- */
/* Doctor: herramientas adicionales                                  */
/* ---------------------------------------------------------------- */

const EXTRA_TOOLS = [
  ["node", "Node.js"], ["npm", "npm"], ["pnpm", "pnpm"], ["yarn", "Yarn"], ["bun", "Bun"], ["deno", "Deno"],
  ["python3", "Python 3"], ["pip3", "pip"], ["go", "Go"], ["java", "Java"], ["gcc", "GCC"], ["make", "Make"], ["cmake", "CMake"],
  ["docker", "Docker"], ["docker-compose", "Docker Compose"], ["kubectl", "kubectl"], ["psql", "PostgreSQL (psql)"], ["sqlite3", "SQLite"],
  ["ollama", "Ollama"], ["gh", "GitHub CLI"], ["php", "PHP"], ["ruby", "Ruby"], ["dotnet", ".NET"], ["cargo", "Cargo"], ["rustc", "Rust"], ["git", "Git"]
];

async function runExtraProbe() {
  const host = document.querySelector("[data-px-probe]");
  if (!host) return;
  host.innerHTML = `<p class="au-px__muted">${t("Detectando herramientas…", "Detecting tools…")}</p>`;

  try {
    const results = await probeToolVersions(EXTRA_TOOLS.map(([id]) => id));
    const names = Object.fromEntries(EXTRA_TOOLS);
    const found = results.filter((r) => r.found).length;
    host.innerHTML = `<p class="au-px__muted">${found} ${t("de", "of")} ${results.length} ${t("herramientas instaladas", "tools installed")}</p>
      <div class="au-px__tools">${results.map((r) => `<div class="au-px__tool ${r.found ? "is-ok" : "is-missing"}"><i></i><b>${esc(names[r.name] || r.name)}</b><span>${r.found ? esc(r.version) : t("no instalado", "not installed")}</span></div>`).join("")}</div>`;
    host.dataset.report = results.map((r) => `- [${r.found ? "x" : " "}] ${names[r.name] || r.name}: ${r.found ? r.version : "no instalado"}`).join("\n");
  } catch (error) {
    host.innerHTML = `<p class="au-px__muted">${esc(String(error?.message || error))}</p>`;
  }
}

function injectDoctorExtras() {
  const bar = document.querySelector('[data-px-bar="toolchain"]');
  if (!bar || document.querySelector("[data-px-probe]")) return;

  markInjected();
  bar.insertAdjacentHTML("afterend", `<section class="au-px au-px--page"><header class="au-px__phead"><h4>${t("Herramientas adicionales", "Additional tools")}</h4>${btn("doc-reprobe", "refresh-cw", t("Volver a detectar", "Detect again"))}${btn("doc-copy-probe", "copy", t("Copiar lista", "Copy list"))}</header><div data-px-probe></div></section>`);
  runExtraProbe();
}

/* ---------------------------------------------------------------- */
/* Búsqueda: historial                                               */
/* ---------------------------------------------------------------- */

function rememberQuery(value) {
  const q = String(value || "").trim();
  if (q.length < 2) return;
  store.set("search-history", [q, ...store.get("search-history", []).filter((x) => x !== q)].slice(0, 8));
}

function injectSearchHistory() {
  const bar = document.querySelector('[data-px-bar="search"]');
  if (!bar || bar.querySelector("[data-px-hist]")) return;

  const history = store.get("search-history", []);
  if (!history.length) return;

  markInjected();
  bar.insertAdjacentHTML("beforeend", `<div class="au-px__recent" data-px-hist>${history.map((q) => `<button type="button" class="au-px__chip" data-px="srch-hist" data-q="${esc(q)}">${esc(q)}</button>`).join("")}${btn("srch-hist-clear", "trash-2", t("Borrar", "Clear"))}</div>`);
}

/* ---------------------------------------------------------------- */
/* Tasks: favoritos                                                  */
/* ---------------------------------------------------------------- */

function parseTask(encoded) {
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}

function injectTaskFavorites() {
  const favs = store.get("task-favs", []);
  const bar = document.querySelector('[data-px-bar="tasks"]');

  if (bar && !bar.querySelector("[data-px-favs]") && favs.length) {
    markInjected();
    bar.insertAdjacentHTML("beforeend", `<div class="au-px__recent" data-px-favs><span class="au-px__muted">★</span>${favs.map((f) => `<button type="button" class="au-px__chip is-on" data-px="task-recent" data-cmd="${esc(f.command)}" title="${esc(f.command)}">${esc(f.label)}</button>`).join("")}</div>`);
  }

  document.querySelectorAll(".au-task-item__actions").forEach((actions) => {
    if (actions.querySelector("[data-px-star]")) return;
    const task = parseTask(actions.querySelector("[data-project-task-run]")?.dataset.projectTaskRun || "");
    if (!task) return;

    const on = favs.some((f) => f.command === task.command);
    markInjected();
    actions.insertAdjacentHTML("afterbegin", `<button type="button" class="au-task-item__action ${on ? "is-fav" : ""}" data-px-star data-px="task-star" data-cmd="${esc(task.command)}" data-label="${esc(task.label)}" title="${t("Favorito", "Favorite")}">${on ? "★" : "☆"}</button>`);
  });
}

/* ---------------------------------------------------------------- */
/* Ajustes: acerca de y datos                                        */
/* ---------------------------------------------------------------- */

function injectAbout() {
  const bar = document.querySelector('[data-px-bar="settings"]');
  if (!bar || bar.querySelector("[data-px-about]")) return;

  markInjected();
  bar.insertAdjacentHTML("beforeend", `
    <div data-px-about>
      <h3>${t("Datos y privacidad", "Data & privacy")}</h3>
      <div class="au-px__row">
        ${btn("set-clear-ai", "trash-2", t("Borrar conversaciones y skills de IA", "Clear AI chats and skills"))}
        ${btn("set-clear-key", "lock", t("Olvidar la API Key guardada", "Forget saved API key"))}
        ${btn("set-diag", "copy", t("Copiar información de diagnóstico", "Copy diagnostics"))}
      </div>
      <h3>${t("Acerca de", "About")}</h3>
      <div class="au-px__about"><b>Aurelius IDE</b> v${esc(pkg.version)} · Rust + Tauri + CodeMirror 6<br/>${t("Sin telemetría. Tus ajustes y conversaciones se guardan solo en este equipo.", "No telemetry. Your settings and chats are stored only on this machine.")}</div>
    </div>`);
}

/* ---------------------------------------------------------------- */
/* Eventos                                                           */
/* ---------------------------------------------------------------- */

function toolchainReport() {
  const items = appState.toolchainDoctor?.items || [];
  const lines = items.map((i) => `- [${i.ok ? "x" : " "}] **${i.label}** ${i.version || ""} — ${i.status || ""} ${i.detail || ""}`.trim());
  return `# Linux Toolchain Doctor\n\n${lines.join("\n") || "_sin datos_"}\n`;
}

function handle(action, target) {
  const root = appState.projectPath;

  switch (action) {
    case "exp-collapse":
      appState.expandedFolders.clear();
      return rerender();
    case "exp-expand":
      collectDirs(appState.fileTree).forEach((p) => appState.expandedFolders.add(p));
      return rerender();
    case "exp-reveal": {
      const file = appState.activeFilePath;
      if (!file || !root) return toastInfo(t("No hay archivo activo.", "No active file."), "Explorer");
      let cursor = file;
      while (cursor.length > root.length) {
        cursor = cursor.slice(0, cursor.lastIndexOf("/"));
        appState.expandedFolders.add(cursor);
      }
      rerender();
      return setTimeout(() => document.querySelector(".au-tree__row.is-active, [data-tree-active]")?.scrollIntoView?.({ block: "center" }), 120);
    }
    case "exp-terminal":
      return root ? (appState.layout.bottomPanelVisible || ((appState.layout.bottomPanelVisible = true), rerender()), setTimeout(() => openTerminalHere(root), 80)) : toastInfo(t("Abrí un proyecto primero.", "Open a project first."), "Explorer");
    case "exp-copy":
      return root && copy(root, "Explorer");

    case "srch-cs":
    case "srch-word":
    case "srch-rx": {
      const key = action.slice(5);
      searchFilters[key] = !searchFilters[key];
      store.set("search", searchFilters);
      target.classList.toggle("is-on", searchFilters[key]);
      return applySearchFilters();
    }
    case "srch-replace": {
      const input = document.querySelector("[data-px-replace]");
      const files = [...document.querySelectorAll(".au-search__result")]
        .filter((item) => item.style.display !== "none")
        .map((item) => decodeURIComponent(item.dataset.searchFilePath || ""))
        .filter(Boolean);

      return replaceInProject({
        query: appState.search?.query || "",
        replacement: input?.value ?? "",
        filters: searchFilters,
        files
      }).then((result) => {
        if (result) document.getElementById("search-project-form")?.requestSubmit();
      });
    }
    case "srch-copy":
      return copy((appState.search?.results || []).map((r) => `${r.path}:${r.line_number || 1}: ${(r.line_text || "").trim()}`).join("\n"), t("Búsqueda", "Search"));

    case "doc-reprobe":
      return runExtraProbe();
    case "doc-copy-probe":
      return copy(document.querySelector("[data-px-probe]")?.dataset.report || "", "Doctor");
    case "srch-hist": {
      const input = document.querySelector(".au-search__form input");
      if (input) {
        input.value = target.dataset.q;
        document.getElementById("search-project-form")?.requestSubmit();
      }
      return;
    }
    case "srch-hist-clear":
      store.set("search-history", []);
      return rerender();
    case "task-star": {
      const favs = store.get("task-favs", []);
      const exists = favs.some((f) => f.command === target.dataset.cmd);
      store.set("task-favs", exists ? favs.filter((f) => f.command !== target.dataset.cmd) : [...favs, { command: target.dataset.cmd, label: target.dataset.label }].slice(-8));
      return rerender();
    }
    case "set-clear-ai":
      try { Object.keys(localStorage).filter((k) => /^aurelius\.ai\./.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ }
      toastSuccess(t("Datos de IA borrados. Recargando…", "AI data cleared. Reloading…"), t("Ajustes", "Settings"));
      return setTimeout(() => location.reload(), 700);
    case "set-clear-key":
      window.dispatchEvent(new CustomEvent("au:import-settings", { detail: { aiApiKey: "" } }));
      return toastSuccess(t("API Key olvidada.", "API key forgotten."), t("Ajustes", "Settings"));
    case "set-diag":
      return copy(JSON.stringify({ app: `Aurelius IDE v${pkg.version}`, userAgent: navigator.userAgent, language: appState.settings.language, theme: appState.settings.theme, aiProvider: appState.settings.aiProvider, aiModel: appState.settings.aiModel, project: Boolean(appState.projectPath), time: new Date().toISOString() }, null, 2), t("Diagnóstico", "Diagnostics"));
    case "git-center":
      return window.dispatchEvent(new CustomEvent("au:open-git-center"));
    case "mon-copy":
      return copy(JSON.stringify(appState.monitor, null, 2), "Monitor");
    case "mon-reset":
      monitorHistory.cpu.length = 0;
      monitorHistory.mem.length = 0;
      return paintMonitor();

    case "task-recent":
      return runInTerminal(target.dataset.cmd, target.dataset.cmd);
    case "task-clear":
      store.set("cmd-history", []);
      return rerender();

    case "doc-copy":
      return copy(toolchainReport(), "Doctor");
    case "doc-hints": {
      const missing = (appState.toolchainDoctor?.items || []).filter((i) => !i.ok);
      const text = missing.map((i) => INSTALL_HINTS[String(i.id || i.label || "").toLowerCase().split(/[\s-]/)[0]]).filter(Boolean).join("\n");
      return text ? copy(text, "Doctor") : toastInfo(t("No hay herramientas faltantes con comando conocido.", "No missing tools with a known command."), "Doctor");
    }
    case "doc-versions":
      return runInTerminal("node -v; npm -v; rustc -V; cargo -V; git --version; docker --version", "Versions");

    case "set-export": {
      const dump = { settings: { ...appState.settings, aiApiKey: "" }, appearance: store.get("appearance-raw", null), exportedAt: new Date().toISOString() };
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" })), download: "aurelius-settings.json" });
      a.click();
      return URL.revokeObjectURL(a.href);
    }
    case "set-import":
      return document.querySelector("[data-px-import]")?.click();
    case "set-reset-ui":
      try { localStorage.removeItem("aurelius.appearance.v2"); } catch { /* nada */ }
      toastInfo(t("Apariencia restablecida. Recargando…", "Appearance reset. Reloading…"), t("Ajustes", "Settings"));
      return setTimeout(() => location.reload(), 600);
    case "set-clear-data":
      try {
        Object.keys(localStorage).filter((k) => /^aurelius\.(history|scratchpad|flow|toolbox|px)/.test(k)).forEach((k) => localStorage.removeItem(k));
      } catch { /* nada */ }
      return toastSuccess(t("Datos locales borrados.", "Local data cleared."), t("Ajustes", "Settings"));
    default:
      if (GIT_COMMANDS.some(([id]) => id === action)) {
        const [, , label, command] = GIT_COMMANDS.find(([id]) => id === action);
        return runInTerminal(command, `git · ${label}`);
      }
  }
}

async function testAiConnection(button) {
  const status = document.getElementById("settings-ai-test-status");
  const value = (id) => document.getElementById(id)?.value || "";

  const runtime = normalizeAiRuntimeSettings(
    {
      aiProvider: value("settings-ai-provider"),
      aiBaseUrl: value("settings-ai-base-url"),
      aiApiKey: value("settings-ai-api-key"),
      aiModel: value("settings-ai-model")
    },
    value("settings-ai-provider")
  );

  const preset = getAiProviderPreset(runtime.aiProvider);
  const paint = (text, kind) => {
    if (status) {
      status.textContent = text;
      status.dataset.kind = kind;
    }
  };

  if (preset.apiKeyRequired && !runtime.aiApiKey.trim()) {
    paint(t("Falta la API Key.", "API key is missing."), "error");
    return;
  }

  button.disabled = true;
  paint(t("Conectando…", "Connecting…"), "pending");

  const started = performance.now();

  try {
    const response = await chatWithAi({
      provider: runtime.aiProvider,
      baseUrl: runtime.aiBaseUrl,
      apiKey: runtime.aiApiKey,
      model: runtime.aiModel,
      messages: [{ role: "user", content: "Reply with the single word: ok" }]
    });

    const ms = Math.round(performance.now() - started);
    paint(`✓ ${t("Conectado", "Connected")} · ${runtime.aiModel} · ${ms} ms · “${String(response.content).slice(0, 40)}”`, "ok");
  } catch (error) {
    paint(`✗ ${String(error?.message || error)}`, "error");
  } finally {
    button.disabled = false;
  }
}

let started = false;

export function initPanelTools() {
  if (started) return;
  started = true;

  document.addEventListener("click", (event) => {
    const aiTest = event.target.closest("[data-ai-test]");

    if (aiTest) {
      testAiConnection(aiTest);
      return;
    }

    const target = event.target.closest("[data-px]");
    if (target) handle(target.dataset.px, target);
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-px-ext]")) {
      searchFilters.ext = event.target.value;
      store.set("search", searchFilters);
      applySearchFilters();
    }

    if (event.target.matches("[data-px-interval]")) {
      const seconds = Number(event.target.value) || 0;
      store.set("monitor-interval", seconds);
      setMonitorInterval(seconds);
    }

    if (event.target.matches("[data-px-import]")) {
      const file = event.target.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        try {
          const data = JSON.parse(text);
          if (!data || typeof data !== "object") throw new Error("JSON inválido");
          window.dispatchEvent(new CustomEvent("au:import-settings", { detail: data.settings || {} }));
          toastSuccess(t("Ajustes importados.", "Settings imported."), t("Ajustes", "Settings"));
        } catch (error) {
          toastError(String(error.message || error), t("Importar ajustes", "Import settings"));
        }
      });
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#search-project-form")) {
      rememberQuery(event.target.querySelector("input")?.value);
      return;
    }
    if (event.target.matches("#topbar-search-form")) {
      rememberQuery(event.target.querySelector("input")?.value);
      return;
    }
    if (!event.target.matches("[data-px-cmd-form]")) return;
    event.preventDefault();
    const input = event.target.querySelector("[data-px-cmd]");
    const command = input.value.trim();
    if (!command) return;

    const history = [command, ...store.get("cmd-history", []).filter((c) => c !== command)].slice(0, 20);
    store.set("cmd-history", history);
    input.value = "";
    runInTerminal(command, command.slice(0, 24));
    setTimeout(rerender, 150);
  });

  let queued = false;
  let injected = false;

  const run = () => {
    queued = false;
    injected = false;
    injectExplorer();
    injectSearch();
    injectGit();
    injectMonitor();
    injectTasks();
    injectToolchain();
    injectSettings();
    if (injectWelcomeActions()) window.__auPxInjected = true;
    injectAbout();
    injectMonitorDetails();
    injectDoctorExtras();
    injectSearchHistory();
    injectTaskFavorites();
    applySearchFilters();

    // Solo refrescamos iconos si realmente inyectamos algo nuevo (createIcons recorre todo el DOM).
    if (window.__auPxInjected) {
      window.__auPxInjected = false;
      refreshIcons();
    }

    injected = true;
  };

  new MutationObserver((mutations) => {
    if (queued) return;

    // Ignorar el ruido del editor y de la terminal (cada tecla muta su DOM).
    const relevant = mutations.some((mutation) => {
      const node = mutation.target;
      const el = node.nodeType === 1 ? node : node.parentElement;

      return !el?.closest?.(".cm-editor, .xterm, .au-fx-overlay, .au-scratch, .au-toast, .au-tb");
    });

    if (!relevant) return;

    queued = true;
    requestAnimationFrame(run);
  }).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });

  run();
}
