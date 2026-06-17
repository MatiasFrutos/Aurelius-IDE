// src/components/bottom-panel/bottom-panel.js
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import { appState } from "../../app/state.js";
import { getLanguage, t } from "../../app/i18n.js";

import {
  spawnTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  onTerminalOutput,
  onTerminalExit
} from "../../services/terminal.service.js";

import { runProjectDiagnostics } from "../../services/tasks.service.js";

let activeBottomTab = "terminal";
let activeTerminalId = null;

let outputUnlisten = null;
let exitUnlisten = null;
let terminalMountScheduled = false;
let bottomPanelBindScheduled = false;
let initialTerminalCreated = false;

const terminalRegistry = new Map();

const TERMINAL_BUFFER_LIMIT = 160000;
const TERMINAL_START_DELAY_MS = 140;
const TERMINAL_PROBLEM_LIMIT = 220;

const SUPPORTED_PROBLEM_EXTENSIONS = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
  "json",
  "rs",
  "toml",
  "md",
  "vue",
  "svelte",
  "astro",
  "py",
  "go",
  "java",
  "kt",
  "php",
  "c",
  "h",
  "cpp",
  "hpp"
];

const bottomPanelState = {
  terminalCounter: 0,
  diagnosticsRunning: false,
  lastDiagnostics: null,
  output: [
    {
      type: "info",
      source: "Aurelius",
      message: t(
        "Output listo. Acá se mostrarán tareas, procesos y salida del IDE.",
        "Output ready. Tasks, processes and IDE output will appear here."
      )
    }
  ],
  problems: [],
  logs: [
    {
      level: "info",
      time: getCurrentTimeLabel(),
      message: t(
        "Aurelius bottom panel inicializado.",
        "Aurelius bottom panel initialized."
      )
    }
  ]
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(value = "") {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }

  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\A ")
    .replaceAll("\r", "\\D ");
}

function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString(getLanguage() === "en" ? "en-US" : "es-AR");
}

function normalizePath(value = "") {
  return String(value || "").replaceAll("\\", "/");
}

function normalizeProblemPath(value = "") {
  return normalizePath(value)
    .replace(/^file:\/\//, "")
    .replace(/^\/@fs\//, "/")
    .replace(/^\.\//, "")
    .trim();
}

function isAbsolutePath(path = "") {
  const normalized = normalizeProblemPath(path);

  return normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized);
}

function getBaseName(path = "") {
  const normalized = normalizePath(path);

  return normalized.split("/").filter(Boolean).pop() || normalized || "terminal";
}

function getFileExtension(path = "") {
  const fileName = getBaseName(path);
  const parts = fileName.split(".");

  if (parts.length <= 1) {
    return "";
  }

  return parts.pop().toLowerCase();
}

function hasSupportedProblemExtension(path = "") {
  const extension = getFileExtension(path);

  return SUPPORTED_PROBLEM_EXTENSIONS.includes(extension);
}

function resolveProblemFilePath(filePath = "") {
  const normalizedFilePath = normalizeProblemPath(filePath);

  if (!normalizedFilePath) {
    return "";
  }

  if (/^(node:|npm:|pnpm:|yarn:|bun:|https?:)/i.test(normalizedFilePath)) {
    return "";
  }

  if (isAbsolutePath(normalizedFilePath)) {
    return normalizedFilePath;
  }

  if (!appState.projectPath) {
    return normalizedFilePath;
  }

  return `${normalizePath(appState.projectPath).replace(/\/+$/g, "")}/${normalizedFilePath.replace(/^\/+/g, "")}`;
}

function getProjectRelativePath(filePath = "") {
  const normalizedProjectPath = normalizePath(appState.projectPath || "").replace(/\/+$/g, "");
  const normalizedFilePath = normalizePath(filePath);

  if (!normalizedProjectPath || !normalizedFilePath.startsWith(`${normalizedProjectPath}/`)) {
    return normalizedFilePath;
  }

  return normalizedFilePath.slice(normalizedProjectPath.length + 1);
}

function normalizeSeverity(severity) {
  const value = String(severity || "info").toLowerCase();

  if (value === "warn") {
    return "warning";
  }

  if (value === "note" || value === "help") {
    return "info";
  }

  if (["error", "warning", "info"].includes(value)) {
    return value;
  }

  return "info";
}

function inferSeverityFromText(value = "", fallback = "error") {
  const text = String(value || "").toLowerCase();

  if (/\b(error|failed|failure|panic|exception|syntaxerror|typeerror|referenceerror|fatal)\b/.test(text)) {
    return "error";
  }

  if (/\b(warning|warn|deprecated)\b/.test(text)) {
    return "warning";
  }

  if (/\b(info|note|help)\b/.test(text)) {
    return "info";
  }

  return normalizeSeverity(fallback);
}

function getSeverityIcon(severity) {
  const normalized = normalizeSeverity(severity);

  if (normalized === "error") {
    return "circle-alert";
  }

  if (normalized === "warning") {
    return "triangle-alert";
  }

  return "info";
}

function getProblemTitle(problem) {
  const source = problem.source || "diagnostic";
  const severity = normalizeSeverity(problem.severity);

  if (severity === "error") {
    return `${source} error`;
  }

  if (severity === "warning") {
    return `${source} warning`;
  }

  return `${source} info`;
}

function getProblemLocation(problem) {
  const parts = [];

  if (problem.file) {
    parts.push(getProjectRelativePath(problem.file));
  }

  if (problem.line) {
    parts.push(`Ln ${problem.line}`);
  }

  if (problem.column) {
    parts.push(`Col ${problem.column}`);
  }

  return parts.join(" · ") || t("Proyecto", "Project");
}

function getProblemKey(problem) {
  return [
    normalizePath(problem.file || problem.path || ""),
    Number(problem.line || 0),
    Number(problem.column || 0),
    normalizeSeverity(problem.severity),
    String(problem.message || "").trim().slice(0, 180),
    String(problem.source || "").trim()
  ].join("|");
}

function getTerminalStatusLabel(record) {
  if (record?.connected) {
    return t("Conectada", "Connected");
  }

  if (record?.starting) {
    return t("Iniciando", "Starting");
  }

  return t("Detenida", "Stopped");
}

function getTerminalPanelState(record) {
  if (record?.connected) {
    return "success";
  }

  if (record?.starting) {
    return "warning";
  }

  return "muted";
}

function addOutput(type, source, message) {
  bottomPanelState.output.unshift({
    type,
    source,
    message
  });

  bottomPanelState.output = bottomPanelState.output.slice(0, 160);
}

function setOutput(items) {
  bottomPanelState.output = Array.isArray(items) ? items.slice(0, 220) : [];
}

function addLog(level, message) {
  bottomPanelState.logs.unshift({
    level,
    time: getCurrentTimeLabel(),
    message
  });

  bottomPanelState.logs = bottomPanelState.logs.slice(0, 220);
}

function normalizeProblem(problem, index = 0, sourceFallback = "diagnostic") {
  const file = resolveProblemFilePath(problem.file || problem.path || "");
  const line = Number(problem.line || 0);
  const column = Number(problem.column || 0);
  const severity = normalizeSeverity(problem.severity);
  const message = String(problem.message || t("Diagnóstico sin mensaje.", "Diagnostic without message.")).trim();
  const source = problem.source || sourceFallback;

  return {
    id: problem.id || `problem-${Date.now()}-${index}`,
    file,
    path: file,
    line: line > 0 ? line : null,
    column: column > 0 ? column : null,
    severity,
    message,
    source
  };
}

function syncEditorDiagnostics() {
  appState.editorDiagnostics = bottomPanelState.problems.slice(0, TERMINAL_PROBLEM_LIMIT);
}

function setProblems(problems) {
  const normalizedProblems = Array.isArray(problems)
    ? problems
        .map((problem, index) => normalizeProblem(problem, index, "diagnostic"))
        .filter((problem) => problem.file && hasSupportedProblemExtension(problem.file))
    : [];

  bottomPanelState.problems = normalizedProblems.slice(0, TERMINAL_PROBLEM_LIMIT);
  syncEditorDiagnostics();
  updateProblemsCountDom();

  if (activeBottomTab === "problems") {
    rerenderBottomPanel();
  }
}

function addProblems(problems = []) {
  if (!Array.isArray(problems) || !problems.length) {
    return;
  }

  const existingKeys = new Set(bottomPanelState.problems.map(getProblemKey));
  const nextProblems = [];

  problems.forEach((problem, index) => {
    const normalizedProblem = normalizeProblem(problem, index, problem.source || "terminal");

    if (!normalizedProblem.file || !hasSupportedProblemExtension(normalizedProblem.file)) {
      return;
    }

    const key = getProblemKey(normalizedProblem);

    if (existingKeys.has(key)) {
      return;
    }

    existingKeys.add(key);
    nextProblems.push(normalizedProblem);
  });

  if (!nextProblems.length) {
    return;
  }

  bottomPanelState.problems = [
    ...nextProblems,
    ...bottomPanelState.problems
  ].slice(0, TERMINAL_PROBLEM_LIMIT);

  syncEditorDiagnostics();
  updateProblemsCountDom();

  addLog(
    "warning",
    `${t("Terminal detectó", "Terminal detected")} ${nextProblems.length} ${t("problema(s).", "problem(s).")}`
  );

  if (activeBottomTab === "problems") {
    rerenderBottomPanel();
  }
}

function updateProblemsCountDom() {
  const problemTab = document.querySelector('[data-bottom-tab="problems"] small');

  if (problemTab) {
    problemTab.textContent = String(bottomPanelState.problems.length);
  }
}

function hasCargoTomlNode(node) {
  if (!node) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some(hasCargoTomlNode);
  }

  const name = String(node.name || "").toLowerCase();

  if (name === "cargo.toml") {
    return true;
  }

  const children = node.children || node.items || node.files || [];

  if (Array.isArray(children)) {
    return children.some(hasCargoTomlNode);
  }

  return false;
}

function hasPackageJsonNode(node) {
  if (!node) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some(hasPackageJsonNode);
  }

  const name = String(node.name || "").toLowerCase();

  if (name === "package.json") {
    return true;
  }

  const children = node.children || node.items || node.files || [];

  if (Array.isArray(children)) {
    return children.some(hasPackageJsonNode);
  }

  return false;
}

function getProjectDiagnosticKind() {
  if (hasCargoTomlNode(appState.fileTree)) {
    return "rust";
  }

  if (hasPackageJsonNode(appState.fileTree)) {
    return "node";
  }

  return "unknown";
}

function getTerminalTheme() {
  return {
    background: "#07100c",
    foreground: "#d7e2dc",
    cursor: "#22c55e",
    cursorAccent: "#07100c",
    selectionBackground: "#14532d",
    black: "#020617",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#f59e0b",
    blue: "#38bdf8",
    magenta: "#a78bfa",
    cyan: "#2dd4bf",
    white: "#e5e7eb",
    brightBlack: "#64748b",
    brightRed: "#f87171",
    brightGreen: "#4ade80",
    brightYellow: "#fbbf24",
    brightBlue: "#60a5fa",
    brightMagenta: "#c084fc",
    brightCyan: "#67e8f9",
    brightWhite: "#f8fafc"
  };
}

function getTerminalFontFamily() {
  return [
    `"${appState.settings.editorFontFamily || "JetBrains Mono"}"`,
    '"Fira Code"',
    '"Cascadia Code"',
    '"DejaVu Sans Mono"',
    "monospace"
  ].join(", ");
}

function stripAnsi(value = "") {
  return String(value || "")
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function cleanTerminalLine(value = "") {
  return stripAnsi(value)
    .replace(/^[┌└├│╭╰─\s]+/g, "")
    .replace(/\s+$/g, "");
}

function updateTerminalProblemContext(record, line) {
  if (!record) {
    return;
  }

  const cleanLine = cleanTerminalLine(line).trim();

  if (!cleanLine) {
    return;
  }

  if (/^(error|warning|warn|note|help)(\[.*?\])?:/i.test(cleanLine)) {
    record.lastProblemMessage = cleanLine;
    record.lastProblemSeverity = inferSeverityFromText(cleanLine);
    return;
  }

  if (/\b(error|failed|failure|panic|exception|syntaxerror|typeerror|referenceerror|fatal)\b/i.test(cleanLine)) {
    record.lastProblemMessage = cleanLine;
    record.lastProblemSeverity = "error";
    return;
  }

  if (/\b(warning|warn|deprecated)\b/i.test(cleanLine)) {
    record.lastProblemMessage = cleanLine;
    record.lastProblemSeverity = "warning";
  }
}

function buildTerminalProblem(record, file, line, column, rawMessage = "", source = "terminal") {
  const resolvedFile = resolveProblemFilePath(file);
  const safeLine = Number(line || 0);
  const safeColumn = Number(column || 0);

  if (!resolvedFile || !safeLine || !hasSupportedProblemExtension(resolvedFile)) {
    return null;
  }

  const message = String(rawMessage || record?.lastProblemMessage || t("Problema detectado desde terminal.", "Problem detected from terminal.")).trim();
  const severity = inferSeverityFromText(message, record?.lastProblemSeverity || "error");

  return {
    file: resolvedFile,
    path: resolvedFile,
    line: safeLine,
    column: safeColumn > 0 ? safeColumn : 1,
    severity,
    message,
    source
  };
}

function parseTerminalProblemLine(record, rawLine) {
  const line = cleanTerminalLine(rawLine);
  const cleanLine = line.trim();

  if (!cleanLine) {
    return null;
  }

  updateTerminalProblemContext(record, cleanLine);

  const rustArrowMatch = cleanLine.match(/^(?:-->\s*)?(.+?):(\d+):(\d+)(?:\s|$)/);

  if (rustArrowMatch && hasSupportedProblemExtension(rustArrowMatch[1])) {
    return buildTerminalProblem(
      record,
      rustArrowMatch[1],
      rustArrowMatch[2],
      rustArrowMatch[3],
      record?.lastProblemMessage || cleanLine,
      "rust"
    );
  }

  const vitePluginMatch = cleanLine.match(/^(.+?):(\d+):(\d+):\s*(.+)$/);

  if (vitePluginMatch && hasSupportedProblemExtension(vitePluginMatch[1])) {
    return buildTerminalProblem(
      record,
      vitePluginMatch[1],
      vitePluginMatch[2],
      vitePluginMatch[3],
      vitePluginMatch[4] || cleanLine,
      "terminal"
    );
  }

  const tsStyleMatch = cleanLine.match(/^(.+?)\((\d+),(\d+)\):\s*(.+)$/);

  if (tsStyleMatch && hasSupportedProblemExtension(tsStyleMatch[1])) {
    return buildTerminalProblem(
      record,
      tsStyleMatch[1],
      tsStyleMatch[2],
      tsStyleMatch[3],
      tsStyleMatch[4] || cleanLine,
      "typescript"
    );
  }

  const stackWithParenthesisMatch = cleanLine.match(/\((file:\/\/\/?.+?|\/.+?|\.?\.?\/.+?):(\d+):(\d+)\)/);

  if (stackWithParenthesisMatch && hasSupportedProblemExtension(stackWithParenthesisMatch[1])) {
    return buildTerminalProblem(
      record,
      stackWithParenthesisMatch[1],
      stackWithParenthesisMatch[2],
      stackWithParenthesisMatch[3],
      cleanLine,
      "stack"
    );
  }

  const stackWithoutParenthesisMatch = cleanLine.match(/\bat\s+(file:\/\/\/?.+?|\/.+?|\.?\.?\/.+?):(\d+):(\d+)/);

  if (stackWithoutParenthesisMatch && hasSupportedProblemExtension(stackWithoutParenthesisMatch[1])) {
    return buildTerminalProblem(
      record,
      stackWithoutParenthesisMatch[1],
      stackWithoutParenthesisMatch[2],
      stackWithoutParenthesisMatch[3],
      cleanLine,
      "stack"
    );
  }

  const plainFileMatch = cleanLine.match(/(^|\s)(file:\/\/\/?.+?|\/[^\s:]+|\.\.?\/[^\s:]+|[A-Za-z0-9_.@~/-]+):(\d+):(\d+)(?::|\s|$)/);

  if (plainFileMatch && hasSupportedProblemExtension(plainFileMatch[2])) {
    return buildTerminalProblem(
      record,
      plainFileMatch[2],
      plainFileMatch[3],
      plainFileMatch[4],
      cleanLine,
      "terminal"
    );
  }

  return null;
}

function scanTerminalProblems(record, data) {
  if (!record || !data) {
    return;
  }

  const cleanData = stripAnsi(data);

  if (!cleanData.trim()) {
    return;
  }

  record.problemScanBuffer = `${record.problemScanBuffer || ""}${cleanData}`;

  const lines = record.problemScanBuffer.split("\n");

  record.problemScanBuffer = lines.pop() || "";

  const detectedProblems = [];

  lines.forEach((line) => {
    const problem = parseTerminalProblemLine(record, line);

    if (problem) {
      detectedProblems.push(problem);
    }
  });

  if (record.problemScanBuffer.length > 2000) {
    const problem = parseTerminalProblemLine(record, record.problemScanBuffer);

    if (problem) {
      detectedProblems.push(problem);
    }

    record.problemScanBuffer = "";
  }

  if (detectedProblems.length) {
    addProblems(detectedProblems);
  }
}

function appendTerminalBuffer(record, data) {
  if (!record) {
    return;
  }

  record.outputBuffer += String(data ?? "");

  if (record.outputBuffer.length > TERMINAL_BUFFER_LIMIT) {
    record.outputBuffer = record.outputBuffer.slice(-TERMINAL_BUFFER_LIMIT);
  }
}

function getTerminalBufferText(record) {
  if (!record?.terminal?.buffer?.active) {
    return stripAnsi(record?.outputBuffer || "").trimEnd();
  }

  const buffer = record.terminal.buffer.active;
  const lines = [];

  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index);

    if (!line) {
      continue;
    }

    lines.push(line.translateToString(true));
  }

  return lines.join("\n").replace(/\n+$/g, "");
}

function preserveTerminalText(record) {
  if (!record?.terminal) {
    return;
  }

  const renderedText = getTerminalBufferText(record).trimEnd();
  const storedText = stripAnsi(record.outputBuffer || "").trimEnd();

  if (!renderedText) {
    return;
  }

  if (!storedText || renderedText.length > storedText.length) {
    record.outputBuffer = renderedText;
  }
}

function preserveAllTerminalText() {
  for (const record of terminalRegistry.values()) {
    preserveTerminalText(record);
  }
}

function writeTerminalBuffer(record) {
  if (!record?.terminal || !record.outputBuffer) {
    return;
  }

  const text = String(record.outputBuffer || "");

  if (!text) {
    return;
  }

  record.terminal.write(text, () => {
    try {
      record.terminal?.scrollToBottom?.();
    } catch {
      // xterm puede no estar listo todavía.
    }
  });
}

async function copyTextToClipboard(text, label = "Terminal") {
  const value = String(text || "");

  if (!value.trim()) {
    addOutput(
      "warning",
      label,
      t("No hay texto para copiar.", "There is no text to copy.")
    );

    addLog("warning", `${label}: ${t("sin texto para copiar.", "no text to copy.")}`);
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");

      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";

      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    addOutput(
      "success",
      label,
      t("Texto copiado al portapapeles.", "Text copied to clipboard.")
    );

    addLog("success", `${label}: ${t("texto copiado.", "text copied.")}`);
    return true;
  } catch (error) {
    console.error(error);

    addOutput(
      "error",
      label,
      `${t("No se pudo copiar texto", "Could not copy text")}: ${String(error)}`
    );

    addLog("error", `${label}: ${t("falló copiar texto", "copy text failed")}: ${String(error)}`);
    return false;
  }
}

async function copyTerminalSelection() {
  const record = getActiveTerminal();

  if (!record?.terminal) {
    addOutput(
      "warning",
      "Terminal",
      t("No hay terminal activa para copiar.", "There is no active terminal to copy from.")
    );

    return;
  }

  const selectedText = record.terminal.getSelection();

  await copyTextToClipboard(
    selectedText,
    `${record.title} · ${t("selección", "selection")}`
  );

  record.terminal.focus();
}

async function copyTerminalAll() {
  const record = getActiveTerminal();

  if (!record) {
    addOutput(
      "warning",
      "Terminal",
      t("No hay terminal activa para copiar.", "There is no active terminal to copy from.")
    );

    return;
  }

  const terminalText = getTerminalBufferText(record);

  await copyTextToClipboard(
    terminalText,
    `${record.title} · ${t("todo", "all")}`
  );

  record.terminal?.focus?.();
}

function getTerminalList() {
  return Array.from(terminalRegistry.values()).sort((a, b) => a.index - b.index);
}

function getActiveTerminal() {
  if (!activeTerminalId) {
    return null;
  }

  return terminalRegistry.get(activeTerminalId) || null;
}

function createTerminalRecord({ cwd = null, title = "" } = {}) {
  bottomPanelState.terminalCounter += 1;

  const localId = `terminal-${crypto.randomUUID()}`;
  const safeCwd = cwd || appState.projectPath || null;

  const record = {
    localId,
    sessionId: null,
    title: title || `Terminal ${bottomPanelState.terminalCounter}`,
    index: bottomPanelState.terminalCounter,
    terminal: null,
    fitAddon: null,
    resizeObserver: null,
    dataDisposable: null,
    starting: false,
    cwd: safeCwd,
    connected: false,
    mounted: false,
    outputBuffer: "",
    pendingCommand: null,
    problemScanBuffer: "",
    lastProblemMessage: "",
    lastProblemSeverity: "error"
  };

  terminalRegistry.set(localId, record);
  activeTerminalId = localId;

  addLog("info", `${record.title} ${t("creada.", "created.")}`);

  if (safeCwd) {
    addLog("info", `${record.title} cwd: ${safeCwd}`);
  }

  return record;
}

function ensureInitialTerminal() {
  initialTerminalCreated = true;
  return ensureActiveTerminalPointer();
}

function ensureActiveTerminalPointer() {
  if (!terminalRegistry.size) {
    activeTerminalId = null;
    return null;
  }

  if (!activeTerminalId || !terminalRegistry.has(activeTerminalId)) {
    activeTerminalId = getTerminalList()[0]?.localId || null;
  }

  return getActiveTerminal();
}

function fitTerminal(record) {
  if (!record?.terminal || !record?.fitAddon) {
    return;
  }

  try {
    record.fitAddon.fit();
  } catch (error) {
    console.error(error);
  }
}

function fitTerminalStable(record) {
  if (!record?.terminal || !record?.fitAddon) {
    return;
  }

  requestAnimationFrame(() => {
    fitTerminal(record);

    requestAnimationFrame(() => {
      fitTerminal(record);
      syncTerminalSize(record);
    });
  });
}

function getTerminalDimensions(record) {
  if (!record?.terminal) {
    return {
      cols: 80,
      rows: 24
    };
  }

  return {
    cols: record.terminal.cols || 80,
    rows: record.terminal.rows || 24
  };
}

function syncTerminalSize(record) {
  if (!record?.terminal || !record?.sessionId) {
    return;
  }

  fitTerminal(record);

  const { cols, rows } = getTerminalDimensions(record);

  resizeTerminal(record.sessionId, cols, rows).catch((error) => {
    console.error(error);
    addLog(
      "error",
      `${t("No se pudo sincronizar tamaño de", "Could not sync size for")} ${record.title}: ${String(error)}`
    );
  });
}

function writeBanner(record, message) {
  if (!record?.terminal) {
    return;
  }

  const banner = `\r\n\x1b[32m${message}\x1b[0m\r\n\r\n`;

  appendTerminalBuffer(record, banner);
  record.terminal.write(banner, () => {
    try {
      record.terminal?.scrollToBottom?.();
    } catch {
      // xterm puede no estar listo todavía.
    }
  });
}

function disposeTerminalView(record, { preserveBuffer = true } = {}) {
  if (!record) {
    return;
  }

  if (preserveBuffer) {
    preserveTerminalText(record);
  }

  if (record.resizeObserver) {
    record.resizeObserver.disconnect();
    record.resizeObserver = null;
  }

  if (record.dataDisposable) {
    try {
      record.dataDisposable.dispose();
    } catch (error) {
      console.error(error);
    }

    record.dataDisposable = null;
  }

  if (record.terminal) {
    record.terminal.dispose();
    record.terminal = null;
  }

  record.fitAddon = null;
  record.mounted = false;
}

function disposeAllTerminalViews(options = {}) {
  for (const record of terminalRegistry.values()) {
    disposeTerminalView(record, options);
  }
}

async function ensureTerminalListeners() {
  if (!outputUnlisten) {
    outputUnlisten = await onTerminalOutput((payload) => {
      const record = getTerminalList().find((terminalItem) => terminalItem.sessionId === payload.id);

      if (!record) {
        return;
      }

      appendTerminalBuffer(record, payload.data);
      scanTerminalProblems(record, payload.data);

      if (record.terminal) {
        record.terminal.write(payload.data, () => {
          try {
            record.terminal?.scrollToBottom?.();
          } catch {
            // xterm puede no estar listo todavía.
          }
        });
      }
    });
  }

  if (!exitUnlisten) {
    exitUnlisten = await onTerminalExit((payload) => {
      const record = getTerminalList().find((terminalItem) => terminalItem.sessionId === payload.id);

      if (!record) {
        return;
      }

      if (record.problemScanBuffer) {
        scanTerminalProblems(record, "\n");
      }

      const exitMessage = `\r\n\x1b[33m${payload.message}\x1b[0m\r\n`;

      appendTerminalBuffer(record, exitMessage);

      if (record.terminal) {
        record.terminal.write(exitMessage, () => {
          try {
            record.terminal?.scrollToBottom?.();
          } catch {
            // xterm puede no estar listo todavía.
          }
        });
      }

      record.connected = false;
      record.sessionId = null;
      record.starting = false;

      addOutput("warning", record.title, payload.message);
      addLog("warning", `${record.title}: ${payload.message}`);

      updateBottomPanelHeaderState();
      updateTerminalListState(record);
    });
  }
}

async function startTerminalSession(record) {
  if (!record || record.starting || record.sessionId) {
    return;
  }

  record.starting = true;
  record.connected = false;
  updateBottomPanelHeaderState();
  updateTerminalListState(record);

  try {
    await ensureTerminalListeners();

    fitTerminal(record);

    const { cols, rows } = getTerminalDimensions(record);

    record.sessionId = await spawnTerminal({
      cwd: record.cwd || appState.projectPath || null,
      cols,
      rows
    });

    await resizeTerminal(record.sessionId, cols, rows);

    record.connected = true;

    writeBanner(record, `${record.title} ${t("conectada.", "connected.")}`);

    addOutput(
      "success",
      record.title,
      t("Terminal real iniciada correctamente.", "Real terminal started successfully.")
    );

    addLog(
      "success",
      `${record.title} ${t("conectada al shell del sistema.", "connected to the system shell.")}`
    );

    updateBottomPanelHeaderState();
    updateTerminalListState(record);
    fitTerminalStable(record);

    if (record.pendingCommand) {
      const command = record.pendingCommand;
      record.pendingCommand = null;

      setTimeout(() => {
        sendCommandToTerminal(record, command);
      }, TERMINAL_START_DELAY_MS);
    }
  } catch (error) {
    console.error(error);

    const message = `${t("No se pudo iniciar", "Could not start")} ${record.title}: ${String(error)}`;

    record.connected = false;
    record.sessionId = null;

    addOutput("error", record.title, message);
    addLog("error", message);

    const terminalMessage = [
      "",
      `\x1b[31m${t("No se pudo iniciar la terminal real.", "Could not start the real terminal.")}\x1b[0m`,
      String(error),
      ""
    ].join("\r\n");

    appendTerminalBuffer(record, terminalMessage);

    if (record.terminal) {
      record.terminal.write(terminalMessage, () => {
        try {
          record.terminal?.scrollToBottom?.();
        } catch {
          // xterm puede no estar listo todavía.
        }
      });
    }
  } finally {
    record.starting = false;
    updateBottomPanelHeaderState();
    updateTerminalListState(record);
  }
}

function createTerminalView(record, container) {
  disposeTerminalView(record);

  container.innerHTML = "";

  record.terminal = new XtermTerminal({
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: getTerminalFontFamily(),
    fontSize: Number(appState.settings.editorFontSize || 13),
    lineHeight: 1.18,
    letterSpacing: 0,
    scrollback: 5000,
    convertEol: true,
    allowTransparency: false,
    theme: getTerminalTheme(),
    customKeyEventHandler: (event) => {
      const key = String(event.key || "").toLowerCase();
      const hasCtrl = event.ctrlKey || event.metaKey;

      if (hasCtrl && event.shiftKey && key === "c" && event.type === "keydown") {
        copyTerminalSelection();
        return false;
      }

      return true;
    }
  });

  record.fitAddon = new FitAddon();

  record.terminal.loadAddon(record.fitAddon);
  record.terminal.open(container);
  record.mounted = true;

  fitTerminalStable(record);

  requestAnimationFrame(() => {
    writeTerminalBuffer(record);

    requestAnimationFrame(() => {
      fitTerminalStable(record);
    });
  });

  record.dataDisposable = record.terminal.onData((data) => {
    if (!record.sessionId) {
      return;
    }

    writeTerminal(record.sessionId, data).catch((error) => {
      const message = `${t("No se pudo escribir en", "Could not write to")} ${record.title}: ${String(error)}`;

      console.error(error);
      addOutput("error", record.title, message);
      addLog("error", message);
    });
  });

  record.resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      syncTerminalSize(record);
    });
  });

  record.resizeObserver.observe(container);
}

function isTerminalViewAttached(record, container) {
  if (!record || !container || !record.terminal || !record.mounted) {
    return false;
  }

  if (record.terminal.element && container.contains(record.terminal.element)) {
    return true;
  }

  return Boolean(container.querySelector(".xterm"));
}

async function mountActiveTerminal() {
  terminalMountScheduled = false;

  const container = document.getElementById("terminal-mount");

  if (!container || activeBottomTab !== "terminal") {
    return;
  }

  const record = ensureActiveTerminalPointer();

  if (!record) {
    return;
  }

  const terminalViewAttached = isTerminalViewAttached(record, container);

  if (!terminalViewAttached) {
    createTerminalView(record, container);
  }

  fitTerminalStable(record);

  if (!record.sessionId && !record.starting) {
    await startTerminalSession(record);
    return;
  }

  if (record.sessionId) {
    record.connected = true;
    syncTerminalSize(record);
    updateBottomPanelHeaderState();
    updateTerminalListState(record);
  }
}

function scheduleTerminalMount() {
  if (terminalMountScheduled) {
    return;
  }

  terminalMountScheduled = true;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      mountActiveTerminal();
    });
  });
}

function updateBottomPanelHeaderState() {
  const state = document.getElementById("bottom-panel-state");
  const record = getActiveTerminal();

  if (!state || !record) {
    return;
  }

  if (record.starting) {
    state.textContent = t("Iniciando", "Starting");
    state.dataset.state = "warning";
    return;
  }

  if (record.sessionId && record.connected) {
    state.textContent = t("Conectada", "Connected");
    state.dataset.state = "success";
    return;
  }

  state.textContent = t("Detenida", "Stopped");
  state.dataset.state = "muted";
}

function updateTerminalListState(record) {
  if (!record) {
    return;
  }

  const button = document.querySelector(`[data-terminal-tab="${cssEscape(record.localId)}"]`);

  if (!button) {
    return;
  }

  const label = button.querySelector(".au-terminal-list-item__copy small");
  const status = button.querySelector(".au-terminal-list-item__status");

  if (label) {
    label.textContent = getTerminalStatusLabel(record);
  }

  if (status) {
    status.classList.toggle("is-connected", Boolean(record.connected));
    status.classList.toggle("is-muted", !record.connected);
  }
}

async function destroyTerminalSession(record) {
  if (!record) {
    return;
  }

  try {
    if (record.sessionId) {
      await killTerminal(record.sessionId);
      addLog("warning", `${record.title} ${t("cerrada manualmente.", "closed manually.")}`);
    }
  } catch (error) {
    addLog("error", `${t("No se pudo cerrar", "Could not close")} ${record.title}: ${String(error)}`);
  }

  record.sessionId = null;
  record.connected = false;
  record.starting = false;
  updateTerminalListState(record);
}

function handleNewTerminal() {
  preserveAllTerminalText();
  disposeAllTerminalViews();

  const record = createTerminalRecord({
    cwd: appState.projectPath || null
  });

  activeBottomTab = "terminal";
  activeTerminalId = record.localId;

  rerenderBottomPanel();
}

function handleSelectTerminal(localId) {
  if (!terminalRegistry.has(localId)) {
    return;
  }

  if (activeTerminalId === localId && activeBottomTab === "terminal") {
    fitTerminalStable(getActiveTerminal());
    return;
  }

  preserveAllTerminalText();
  disposeAllTerminalViews();

  activeBottomTab = "terminal";
  activeTerminalId = localId;

  addLog(
    "info",
    `${t("Terminal activa", "Active terminal")}: ${terminalRegistry.get(localId)?.title || localId}.`
  );

  rerenderBottomPanel();
}

function handleTerminalRestart() {
  const record = getActiveTerminal();

  if (!record) {
    return;
  }

  destroyTerminalSession(record).then(() => {
    record.outputBuffer = "";
    record.pendingCommand = null;
    record.problemScanBuffer = "";
    record.lastProblemMessage = "";
    record.lastProblemSeverity = "error";
    disposeTerminalView(record, {
      preserveBuffer: false
    });
    activeBottomTab = "terminal";
    rerenderBottomPanel();
  });
}

function handleCloseTerminal(localId) {
  const record = terminalRegistry.get(localId);

  if (!record) {
    return;
  }

  const wasActive = activeTerminalId === localId;

  destroyTerminalSession(record).then(() => {
    disposeTerminalView(record);
    terminalRegistry.delete(localId);

    addLog("warning", `${record.title} ${t("eliminada del panel.", "removed from the panel.")}`);

    if (!terminalRegistry.size) {
      activeTerminalId = null;
    } else if (wasActive) {
      activeTerminalId = getTerminalList()[0]?.localId || null;
    }

    activeBottomTab = "terminal";
    rerenderBottomPanel();
  });
}

function handleDeleteActiveTerminal() {
  const record = getActiveTerminal();

  if (!record) {
    return;
  }

  handleCloseTerminal(record.localId);
}

function handleHideBottomPanel() {
  preserveAllTerminalText();

  const toggleButton = document.getElementById("toggle-bottom-panel-btn");

  if (toggleButton) {
    toggleButton.click();
    return;
  }

  document.dispatchEvent(
    new CustomEvent("aurelius:hide-bottom-panel", {
      detail: {
        source: "bottom-panel"
      }
    })
  );
}

function clearCurrentTab() {
  if (activeBottomTab === "terminal") {
    const record = getActiveTerminal();

    if (record) {
      record.outputBuffer = "";
      record.problemScanBuffer = "";

      if (record.terminal) {
        record.terminal.clear();
        record.terminal.writeln(`\x1b[32m${t("Terminal limpiada.", "Terminal cleared.")}\x1b[0m`);
      }

      addLog("info", `${record.title} ${t("limpiada.", "cleared.")}`);
    }

    return;
  }

  if (activeBottomTab === "output") {
    bottomPanelState.output = [
      {
        type: "info",
        source: "Aurelius",
        message: t("Output limpiado.", "Output cleared.")
      }
    ];
  }

  if (activeBottomTab === "problems") {
    bottomPanelState.problems = [];
    appState.editorDiagnostics = [];
    updateProblemsCountDom();
  }

  if (activeBottomTab === "logs") {
    bottomPanelState.logs = [
      {
        level: "info",
        time: getCurrentTimeLabel(),
        message: t("Logs limpiados.", "Logs cleared.")
      }
    ];
  }

  rerenderBottomPanel();
}

function openProblem(problemIndex) {
  const problem = bottomPanelState.problems[Number(problemIndex)];

  if (!problem) {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("aurelius:open-problem-file", {
      detail: {
        file: problem.file,
        line: problem.line || 1,
        column: problem.column || 1,
        severity: problem.severity,
        message: problem.message,
        source: problem.source
      }
    })
  );

  addLog("info", `${t("Problem seleccionado", "Selected problem")}: ${problem.file}:${problem.line || 1}`);
}

function buildDiagnosticsOutput(result) {
  const entries = [];

  entries.push({
    type: result.ok ? "success" : "warning",
    source: "Diagnostics",
    message: `${result.command} ${t("finalizó con código", "finished with code")} ${
      result.exit_code ?? t("desconocido", "unknown")
    } ${t("en", "in")} ${result.cwd}.`
  });

  if (result.problems?.length) {
    entries.push({
      type: result.ok ? "info" : "warning",
      source: "Problems",
      message: `${result.problems.length} ${t("problema(s) detectado(s).", "problem(s) detected.")}`
    });
  } else {
    entries.push({
      type: "success",
      source: "Problems",
      message: t("No se detectaron problemas.", "No problems detected.")
    });
  }

  if (result.stderr?.trim()) {
    entries.push({
      type: result.ok ? "info" : "error",
      source: "stderr",
      message: result.stderr.trim()
    });
  }

  if (result.stdout?.trim()) {
    const lines = result.stdout
      .split("\n")
      .filter(Boolean)
      .slice(-16)
      .join("\n");

    entries.push({
      type: "info",
      source: "stdout",
      message: lines || t("stdout vacío.", "empty stdout.")
    });
  }

  return entries;
}

function sendCommandToTerminal(record, command) {
  if (!record || !command) {
    return;
  }

  if (!record.sessionId) {
    record.pendingCommand = command;
    return;
  }

  const commandToSend = `${command}\r`;

  writeTerminal(record.sessionId, commandToSend).catch((error) => {
    const message = `${t("No se pudo ejecutar comando", "Could not run command")}: ${String(error)}`;

    addOutput("error", record.title, message);
    addLog("error", message);
  });
}

export async function runDiagnosticsAndPopulate() {
  try {
    if (!appState.projectPath) {
      addOutput(
        "warning",
        "Diagnostics",
        t(
          "Primero abrí un proyecto para ejecutar diagnósticos.",
          "Open a project first to run diagnostics."
        )
      );
      addLog(
        "warning",
        t(
          "Diagnostics cancelado: no hay proyecto abierto.",
          "Diagnostics cancelled: no project open."
        )
      );
      activeBottomTab = "output";
      rerenderBottomPanel();
      return;
    }

    const diagnosticKind = getProjectDiagnosticKind();

    if (diagnosticKind === "node") {
      setProblems([]);

      addOutput(
        "info",
        "Diagnostics",
        t(
          "Este proyecto parece ser Node/JavaScript. No se ejecutó cargo check porque no existe Cargo.toml en el árbol del proyecto.",
          "This project appears to be Node/JavaScript. cargo check was not run because no Cargo.toml exists in the project tree."
        )
      );

      addOutput(
        "success",
        "Project",
        t(
          "Para revisar este proyecto usá Project Commands y ejecutá npm run dev, npm test, npm run lint o el script disponible en package.json.",
          "To check this project, use Project Commands and run npm run dev, npm test, npm run lint or an available package.json script."
        )
      );

      addLog(
        "info",
        t(
          "Diagnostics omitido: proyecto Node/JavaScript sin Cargo.toml.",
          "Diagnostics skipped: Node/JavaScript project without Cargo.toml."
        )
      );

      activeBottomTab = "output";
      rerenderBottomPanel();
      return;
    }

    if (diagnosticKind === "unknown") {
      setProblems([]);

      addOutput(
        "warning",
        "Diagnostics",
        t(
          "No encontré Cargo.toml ni package.json en el árbol del proyecto. No hay diagnóstico automático para este tipo de proyecto.",
          "No Cargo.toml or package.json was found in the project tree. There is no automatic diagnostic for this project type."
        )
      );

      addLog(
        "warning",
        t(
          "Diagnostics omitido: tipo de proyecto desconocido.",
          "Diagnostics skipped: unknown project type."
        )
      );

      activeBottomTab = "output";
      rerenderBottomPanel();
      return;
    }

    bottomPanelState.diagnosticsRunning = true;
    activeBottomTab = "output";

    addOutput(
      "info",
      "Diagnostics",
      t(
        "Ejecutando cargo check --message-format=json...",
        "Running cargo check --message-format=json..."
      )
    );
    addLog("info", t("Run diagnostics iniciado.", "Run diagnostics started."));

    rerenderBottomPanel();

    const result = await runProjectDiagnostics(appState.projectPath);

    bottomPanelState.lastDiagnostics = result;
    bottomPanelState.diagnosticsRunning = false;

    setProblems(result.problems || []);
    setOutput(buildDiagnosticsOutput(result));

    activeBottomTab = bottomPanelState.problems.length ? "problems" : "output";

    addLog(
      result.ok ? "success" : "warning",
      `${t("Diagnostics finalizado", "Diagnostics finished")}: ${
        bottomPanelState.problems.length
      } ${t("problema(s).", "problem(s).")}`
    );

    rerenderBottomPanel();
  } catch (error) {
    console.error(error);

    bottomPanelState.diagnosticsRunning = false;

    setProblems([]);

    addOutput(
      "error",
      "Diagnostics",
      `${t("No se pudieron ejecutar diagnósticos", "Could not run diagnostics")}: ${String(error)}`
    );

    addLog("error", `${t("Diagnostics falló", "Diagnostics failed")}: ${String(error)}`);

    activeBottomTab = "output";
    rerenderBottomPanel();
  }
}

export function setBottomPanelProblems(problems = []) {
  setProblems(problems);
  activeBottomTab = "problems";
  rerenderBottomPanel();
}

export function appendBottomPanelOutput(type, source, message) {
  addOutput(type, source, message);
  activeBottomTab = "output";
  rerenderBottomPanel();
}

export function openTerminalHere(cwd, options = {}) {
  const safeCwd = cwd || appState.projectPath || null;

  preserveAllTerminalText();
  disposeAllTerminalViews();

  const record = createTerminalRecord({
    cwd: safeCwd,
    title:
      options.title ||
      `${t("Terminal", "Terminal")} · ${getBaseName(safeCwd || appState.projectPath || "")}`
  });

  activeBottomTab = "terminal";
  activeTerminalId = record.localId;

  addOutput(
    "info",
    record.title,
    safeCwd
      ? `${t("Abriendo terminal en", "Opening terminal in")} ${safeCwd}`
      : t("Abriendo terminal.", "Opening terminal.")
  );

  addLog(
    "info",
    safeCwd
      ? `${record.title}: ${t("open terminal here en", "open terminal here in")} ${safeCwd}`
      : `${record.title}: ${t("open terminal here sin cwd específico.", "open terminal here without specific cwd.")}`
  );

  rerenderBottomPanel();

  return record.localId;
}

export function runCommandInTerminal(command, options = {}) {
  const cleanCommand = String(command || "").trim();

  if (!cleanCommand) {
    addOutput(
      "warning",
      "Terminal",
      t("No se recibió ningún comando para ejecutar.", "No command was received to run.")
    );
    activeBottomTab = "output";
    rerenderBottomPanel();
    return null;
  }

  const safeCwd = options.cwd || appState.projectPath || null;
  const title =
    options.title ||
    `${t("Comando", "Command")} · ${cleanCommand.length > 22 ? `${cleanCommand.slice(0, 22)}…` : cleanCommand}`;

  preserveAllTerminalText();
  disposeAllTerminalViews();

  const record = createTerminalRecord({
    cwd: safeCwd,
    title
  });

  record.pendingCommand = cleanCommand;

  activeBottomTab = "terminal";
  activeTerminalId = record.localId;

  addOutput(
    "info",
    record.title,
    safeCwd
      ? `${t("Ejecutando en", "Running in")} ${safeCwd}: ${cleanCommand}`
      : `${t("Ejecutando", "Running")}: ${cleanCommand}`
  );

  addLog("info", `${record.title}: ${cleanCommand}`);

  rerenderBottomPanel();

  return record.localId;
}

function scheduleBottomPanelActionsBind() {
  if (bottomPanelBindScheduled) {
    return;
  }

  bottomPanelBindScheduled = true;

  queueMicrotask(() => {
    bottomPanelBindScheduled = false;
    bindBottomPanelActions();
  });
}

function rerenderBottomPanel() {
  const panel = document.querySelector(".au-bottom-panel");

  if (!panel) {
    return;
  }

  preserveAllTerminalText();
  disposeAllTerminalViews();

  panel.outerHTML = renderBottomPanel();

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function renderPanelTabButton(tab, icon, label, count = null) {
  const isActive = activeBottomTab === tab;

  return `
    <button class="au-bottom-panel__main-tab ${isActive ? "is-active" : ""}" type="button" data-bottom-tab="${tab}">
      <i data-lucide="${icon}"></i>
      <span>${escapeHTML(label)}</span>
      ${count !== null ? `<small>${escapeHTML(count)}</small>` : ""}
    </button>
  `;
}

function renderTerminalListItem(record) {
  const isActive = activeBottomTab === "terminal" && activeTerminalId === record.localId;

  return `
    <article class="au-terminal-list-item ${isActive ? "is-active" : ""}">
      <button
        class="au-terminal-list-item__main"
        type="button"
        data-terminal-tab="${escapeHTML(record.localId)}"
        title="${escapeHTML(record.title)}"
      >
        <span class="au-terminal-list-item__icon">
          <i data-lucide="terminal"></i>
        </span>

        <span class="au-terminal-list-item__copy">
          <strong>${escapeHTML(record.title)}</strong>
          <small>${escapeHTML(getTerminalStatusLabel(record))}</small>
        </span>

        <i class="au-terminal-list-item__status ${record.connected ? "is-connected" : "is-muted"}"></i>
      </button>

      <button
        class="au-terminal-list-item__delete"
        type="button"
        data-terminal-close="${escapeHTML(record.localId)}"
        title="${escapeHTML(t("Eliminar", "Delete"))} ${escapeHTML(record.title)}"
        aria-label="${escapeHTML(t("Eliminar", "Delete"))} ${escapeHTML(record.title)}"
      >
        <i data-lucide="trash-2"></i>
      </button>
    </article>
  `;
}

function renderOutputPanel() {
  return `
    <section class="au-panel-view au-output-view">
      <header class="au-panel-view__header">
        <div>
          <strong>Output</strong>
          <span>${escapeHTML(t("Salida del IDE, tareas y procesos internos.", "IDE output, tasks and internal processes."))}</span>
        </div>
      </header>

      <div class="au-output-list">
        ${bottomPanelState.output
          .map((item) => {
            return `
              <article class="au-output-item is-${escapeHTML(item.type)}">
                <span>${escapeHTML(item.source)}</span>
                <p>${escapeHTML(item.message)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderProblemsPanel() {
  if (bottomPanelState.diagnosticsRunning) {
    return `
      <section class="au-panel-view au-problems-view">
        <div class="au-empty-panel">
          <i data-lucide="refresh-cw"></i>
          <strong>${escapeHTML(t("Ejecutando diagnósticos", "Running diagnostics"))}</strong>
          <p>${escapeHTML(t(
            "Aurelius está corriendo cargo check y preparando Problems.",
            "Aurelius is running cargo check and preparing Problems."
          ))}</p>
        </div>
      </section>
    `;
  }

  if (!bottomPanelState.problems.length) {
    return `
      <section class="au-panel-view au-problems-view">
        <div class="au-empty-panel">
          <i data-lucide="check-circle-2"></i>
          <strong>${escapeHTML(t("No hay problemas detectados", "No problems detected"))}</strong>
          <p>${escapeHTML(t(
            "Ejecutá comandos como npm run dev, npm run build, cargo check o Run diagnostics. Si la terminal imprime archivo:línea:columna, Aurelius lo detecta.",
            "Run commands like npm run dev, npm run build, cargo check or Run diagnostics. If the terminal prints file:line:column, Aurelius detects it."
          ))}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="au-panel-view au-problems-view">
      <header class="au-panel-view__header">
        <div>
          <strong>Problems</strong>
          <span>
            ${bottomPanelState.problems.length}
            ${escapeHTML(t("problema(s) detectado(s). Click para abrir el archivo.", "problem(s) detected. Click to open the file."))}
          </span>
        </div>
      </header>

      <div class="au-problem-list">
        ${bottomPanelState.problems
          .map((problem, index) => {
            const severity = normalizeSeverity(problem.severity);

            return `
              <button
                class="au-problem-item is-${escapeHTML(severity)}"
                type="button"
                data-problem-index="${index}"
                title="${escapeHTML(getProblemLocation(problem))}"
              >
                <i data-lucide="${getSeverityIcon(severity)}"></i>
                <div>
                  <strong>${escapeHTML(getProblemTitle(problem))}</strong>
                  <p>${escapeHTML(problem.message)}</p>
                  <small>${escapeHTML(getProblemLocation(problem))}</small>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderLogsPanel() {
  return `
    <section class="au-panel-view au-logs-view">
      <header class="au-panel-view__header">
        <div>
          <strong>Logs</strong>
          <span>${escapeHTML(t("Eventos internos de Aurelius IDE.", "Internal Aurelius IDE events."))}</span>
        </div>
      </header>

      <div class="au-log-list">
        ${bottomPanelState.logs
          .map((log) => {
            return `
              <article class="au-log-item is-${escapeHTML(log.level)}">
                <span>${escapeHTML(log.time)}</span>
                <strong>${escapeHTML(log.level.toUpperCase())}</strong>
                <p>${escapeHTML(log.message)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderTerminalEmptyPanel() {
  return `
    <div class="au-terminal-empty">
      <span class="au-terminal-empty__icon">
        <i data-lucide="terminal"></i>
      </span>

      <strong>${escapeHTML(t("No hay terminales abiertas", "No open terminals"))}</strong>

      <p>
        ${escapeHTML(t(
          "Creá una nueva terminal para ejecutar comandos dentro del proyecto.",
          "Create a new terminal to run commands inside the project."
        ))}
      </p>

      <button id="terminal-empty-new-btn" type="button">
        <i data-lucide="terminal"></i>
        <span>${escapeHTML(t("Nueva terminal", "New terminal"))}</span>
      </button>
    </div>
  `;
}

function renderTerminalPanel() {
  const record = ensureActiveTerminalPointer();

  if (!record) {
    return renderTerminalEmptyPanel();
  }

  return `
    <div class="au-terminal-layout">
      <aside class="au-terminal-sidebar">
        <header class="au-terminal-sidebar__header">
          <div>
            <strong>${escapeHTML(t("Terminales", "Terminals"))}</strong>
            <span>${terminalRegistry.size} ${escapeHTML(t("sesión(es)", "session(s)"))}</span>
          </div>

          <button id="terminal-new-btn" type="button" title="${escapeHTML(t("Nueva terminal", "New terminal"))}">
            <i data-lucide="terminal"></i>
          </button>
        </header>

        <div class="au-terminal-list">
          ${getTerminalList().map(renderTerminalListItem).join("")}
        </div>
      </aside>

      <section class="au-terminal-real">
        <div class="au-terminal-real__meta">
          <span>
            <i data-lucide="folder"></i>
            ${
              record?.cwd
                ? escapeHTML(record.cwd)
                : appState.projectPath
                  ? escapeHTML(appState.projectPath)
                  : escapeHTML(t("Sin proyecto abierto", "No open project"))
            }
          </span>

          <strong id="bottom-panel-state" data-state="${getTerminalPanelState(record)}">
            ${escapeHTML(getTerminalStatusLabel(record))}
          </strong>
        </div>

        <div class="au-terminal-real__mount" id="terminal-mount"></div>
      </section>
    </div>
  `;
}

function renderActivePanel() {
  if (activeBottomTab === "output") {
    return renderOutputPanel();
  }

  if (activeBottomTab === "problems") {
    return renderProblemsPanel();
  }

  if (activeBottomTab === "logs") {
    return renderLogsPanel();
  }

  return renderTerminalPanel();
}

function bindBottomPanelActions() {
  document.querySelectorAll("[data-bottom-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.bottomTab || "terminal";

      if (nextTab === activeBottomTab && nextTab !== "terminal") {
        return;
      }

      if (nextTab !== "terminal") {
        preserveAllTerminalText();
        disposeAllTerminalViews();
      }

      activeBottomTab = nextTab;
      addLog("info", `${t("Panel inferior cambiado a", "Bottom panel changed to")} ${nextTab}.`);
      rerenderBottomPanel();
    });
  });

  document.querySelectorAll("[data-terminal-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      handleSelectTerminal(button.dataset.terminalTab);
    });
  });

  document.querySelectorAll("[data-terminal-close]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleCloseTerminal(button.dataset.terminalClose);
    });
  });

  document.querySelectorAll("[data-problem-index]").forEach((button) => {
    button.addEventListener("click", () => {
      openProblem(button.dataset.problemIndex);
    });
  });

  document.getElementById("diagnostics-run-btn")?.addEventListener("click", runDiagnosticsAndPopulate);
  document.getElementById("terminal-copy-selection-btn")?.addEventListener("click", copyTerminalSelection);
  document.getElementById("terminal-copy-all-btn")?.addEventListener("click", copyTerminalAll);
  document.getElementById("terminal-new-btn")?.addEventListener("click", handleNewTerminal);
  document.getElementById("terminal-empty-new-btn")?.addEventListener("click", handleNewTerminal);
  document.getElementById("terminal-restart-btn")?.addEventListener("click", handleTerminalRestart);
  document.getElementById("terminal-delete-active-btn")?.addEventListener("click", handleDeleteActiveTerminal);
  document.getElementById("bottom-hide-btn")?.addEventListener("click", handleHideBottomPanel);
  document.getElementById("bottom-clear-btn")?.addEventListener("click", clearCurrentTab);
}

export function renderBottomPanel() {
  ensureInitialTerminal();

  scheduleBottomPanelActionsBind();

  if (activeBottomTab === "terminal" && terminalRegistry.size > 0) {
    scheduleTerminalMount();
  } else if (activeBottomTab !== "terminal") {
    disposeAllTerminalViews();
  }

  return `
    <section class="au-bottom-panel">
      <div
        class="aurelius-resizer aurelius-resizer--bottom"
        data-resize-panel="bottom"
        title="${escapeHTML(t("Redimensionar panel inferior", "Resize bottom panel"))}"
      ></div>

      <header class="au-bottom-panel__tabs">
        <div class="au-bottom-panel__left">
          ${renderPanelTabButton("terminal", "terminal", "Terminal", terminalRegistry.size)}
          ${renderPanelTabButton("output", "info", "Output", bottomPanelState.output.length)}
          ${renderPanelTabButton("problems", "circle-alert", "Problems", bottomPanelState.problems.length)}
          ${renderPanelTabButton("logs", "notebook-text", "Logs", bottomPanelState.logs.length)}
        </div>

        <div class="au-bottom-panel__actions">
          <button id="diagnostics-run-btn" type="button" title="Run diagnostics">
            <i data-lucide="circle-alert"></i>
            <span>${bottomPanelState.diagnosticsRunning ? "Running..." : "Run diagnostics"}</span>
          </button>

          <button id="terminal-copy-selection-btn" type="button" title="${escapeHTML(t("Copiar selección de terminal", "Copy terminal selection"))}">
            <i data-lucide="copy"></i>
            <span>${escapeHTML(t("Copiar selección", "Copy selection"))}</span>
          </button>

          <button id="terminal-copy-all-btn" type="button" title="${escapeHTML(t("Copiar todo el texto de terminal", "Copy all terminal text"))}">
            <i data-lucide="files"></i>
            <span>${escapeHTML(t("Copiar todo", "Copy all"))}</span>
          </button>

          <button id="bottom-clear-btn" type="button" title="${escapeHTML(t("Limpiar panel activo", "Clear active panel"))}">
            <i data-lucide="trash-2"></i>
            <span>${escapeHTML(t("Limpiar", "Clear"))}</span>
          </button>

          <button id="terminal-restart-btn" type="button" title="${escapeHTML(t("Reiniciar terminal activa", "Restart active terminal"))}">
            <i data-lucide="refresh-cw"></i>
            <span>${escapeHTML(t("Reiniciar", "Restart"))}</span>
          </button>

          <button id="terminal-delete-active-btn" type="button" title="${escapeHTML(t("Eliminar terminal activa", "Delete active terminal"))}">
            <i data-lucide="x"></i>
            <span>${escapeHTML(t("Eliminar", "Delete"))}</span>
          </button>

          <button id="bottom-hide-btn" type="button" title="${escapeHTML(t("Ocultar panel inferior", "Hide bottom panel"))}">
            <i data-lucide="chevron-down"></i>
            <span>${escapeHTML(t("Ocultar", "Hide"))}</span>
          </button>
        </div>
      </header>

      <main class="au-bottom-panel__body">
        ${renderActivePanel()}
      </main>
    </section>
  `;
}