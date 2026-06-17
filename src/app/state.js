// src/app/state.js

export const appState = {
  projectPath: null,
  projectName: null,
  fileTree: [],

  activeFilePath: null,
  activeFileName: null,
  activeFileContent: "",

  openTabs: [],
  isDirty: false,
  editorView: null,
  expandedFolders: new Set(),

  cursorLine: 1,
  cursorColumn: 1,
  activeLanguage: "Text",

  recentProjects: [],

  activityPanel: "explorer",

  layout: {
    topbarVisible: true,
    sidebarVisible: true,
    rightPanelVisible: true,
    bottomPanelVisible: true,
    sidebarWidth: 286,
    rightPanelWidth: 360,
    bottomPanelHeight: 220,
    activeRightPanel: "ai",
    activeBottomPanel: "terminal"
  },

  search: {
    query: "",
    results: [],
    isLoading: false
  },

  monitor: {
    isLoading: false,
    lastUpdatedAt: null,
    process: {
      cpuPercent: null,
      memoryBytes: null,
      virtualMemoryBytes: null,
      pid: null
    },
    system: {
      totalMemoryBytes: null,
      usedMemoryBytes: null,
      freeMemoryBytes: null,
      cpuCount: null,
      loadAverage: null
    }
  },

  liveServer: {
    isLoading: false,
    running: false,
    host: "127.0.0.1",
    port: 4587,
    url: null,
    root: null
  },

  projectTools: {
    isLoading: false,
    tasks: [],
    lastRun: null
  },

  toolchainDoctor: {
    isLoading: false,
    items: [],
    lastCheckedAt: null
  },

  ai: {
    messages: [],
    isLoading: false
  },

  settings: {
    theme: "dark",
    language: "es",
    uiScale: 1,
    sidebarWidth: 286,
    editorFontSize: 14,
    editorFontFamily: "JetBrains Mono",
    aiProvider: "ollama",
    aiBaseUrl: "http://localhost:11434",
    aiApiKey: "",
    aiModel: "llama3.2"
  }
};

const LANGUAGE_BY_EXTENSION = {
  js: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  jsx: "React JSX",

  ts: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  tsx: "React TSX",

  html: "HTML",
  htm: "HTML",
  vue: "HTML",
  svelte: "HTML",
  astro: "HTML",

  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",

  json: "JSON",
  jsonc: "JSON",

  rs: "Rust",

  md: "Markdown",
  markdown: "Markdown",
  mdx: "Markdown",

  sql: "SQL",

  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",

  toml: "TOML",

  yaml: "YAML",
  yml: "YAML",

  py: "Python",
  pyw: "Python",

  php: "PHP",
  phtml: "PHP",

  xml: "XML",
  svg: "XML",
  xhtml: "XML",

  java: "Java",

  c: "C",
  h: "C / C++",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  hh: "C++",
  hxx: "C++",

  go: "Go",

  env: "Config",
  ini: "Config",
  conf: "Config",
  cfg: "Config",
  properties: "Config",

  dockerignore: "Config",
  gitignore: "Config",

  txt: "Text",
  log: "Log"
};

const LANGUAGE_BY_FILENAME = {
  ".env": "Config",
  ".env.local": "Config",
  ".env.development": "Config",
  ".env.production": "Config",
  ".gitignore": "Config",
  ".dockerignore": "Config",
  ".npmrc": "Config",
  ".yarnrc": "Config",
  dockerfile: "Config",
  containerfile: "Config",
  makefile: "Config",
  "cargo.toml": "TOML",
  "package.json": "JSON",
  "package-lock.json": "JSON",
  "pnpm-lock.yaml": "YAML",
  "yarn.lock": "Text",
  "tsconfig.json": "JSON",
  "jsconfig.json": "JSON",
  "vite.config.js": "JavaScript",
  "vite.config.ts": "TypeScript",
  "tauri.conf.json": "JSON",
  "README.md": "Markdown",
  readme: "Markdown",
  license: "Text"
};

const ALLOWED_ACTIVITY_PANELS = [
  "explorer",
  "search",
  "git",
  "monitor",
  "tasks",
  "toolchain",
  "ai",
  "settings"
];

const ALLOWED_RIGHT_PANELS = ["ai"];
const ALLOWED_BOTTOM_PANELS = ["terminal", "problems", "output", "logs"];

let uiScaleResizeBound = false;
let uiScaleResizeTimer = null;

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function roundScale(value) {
  return Math.round(Number(value || 1) * 1000) / 1000;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function normalizePath(value = "") {
  return String(value || "")
    .replaceAll("\\", "/")
    .split("?")[0]
    .split("#")[0];
}

function normalizeOptionalPath(value) {
  const normalized = normalizePath(value);

  return normalized.trim() ? normalized : null;
}

function getPathName(path = "") {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  return parts.pop() || normalized || "";
}

function normalizeContent(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function getFileName(filePath = "") {
  return getPathName(filePath);
}

function getFileExtension(filePath = "") {
  const fileName = getFileName(filePath);
  const lowerName = fileName.toLowerCase();

  if (!lowerName) {
    return "txt";
  }

  if (LANGUAGE_BY_FILENAME[lowerName]) {
    return lowerName;
  }

  if (lowerName.startsWith(".") && !lowerName.slice(1).includes(".")) {
    return lowerName.slice(1) || "txt";
  }

  const parts = lowerName.split(".");

  if (parts.length <= 1) {
    return "txt";
  }

  return parts.pop() || "txt";
}

function normalizeFileTreeNode(node) {
  const safeNode = node || {};
  const path = normalizePath(safeNode.path || "");
  const name = String(safeNode.name || getPathName(path) || "").trim();
  const isDir = Boolean(safeNode.is_dir ?? safeNode.isDir);
  const children = Array.isArray(safeNode.children)
    ? safeNode.children.map(normalizeFileTreeNode).filter(Boolean)
    : [];

  if (!name || !path) {
    return null;
  }

  return {
    name,
    path,
    is_dir: isDir,
    children
  };
}

function normalizeFileTree(tree) {
  if (!Array.isArray(tree)) {
    return [];
  }

  return tree.map(normalizeFileTreeNode).filter(Boolean);
}

function collectRootExpandedFolders(tree) {
  const folders = new Set();

  for (const node of tree) {
    if (node?.is_dir && node.path) {
      folders.add(node.path);
    }
  }

  return folders;
}

function normalizeRecentProject(project) {
  const safeProject = project || {};
  const path = normalizePath(safeProject.path || "");
  const name = String(safeProject.name || getPathName(path) || path || "").trim();
  const openedAt = Number(safeProject.opened_at ?? safeProject.openedAt ?? 0);

  if (!path || !name) {
    return null;
  }

  return {
    name,
    path,
    opened_at: Number.isFinite(openedAt) ? openedAt : 0
  };
}

function getViewportAutoScale() {
  if (typeof window === "undefined") {
    return 1;
  }

  const width = Number(window.innerWidth || 1440);
  const height = Number(window.innerHeight || 900);

  let autoScale = 1;

  if (width < 1500) {
    autoScale = Math.min(autoScale, width / 1500);
  }

  if (height < 900) {
    autoScale = Math.min(autoScale, height / 900);
  }

  if (width <= 1366) {
    autoScale = Math.min(autoScale, 0.9);
  }

  if (width <= 1280) {
    autoScale = Math.min(autoScale, 0.86);
  }

  if (height <= 768) {
    autoScale = Math.min(autoScale, 0.86);
  }

  if (height <= 720) {
    autoScale = Math.min(autoScale, 0.82);
  }

  return roundScale(clampNumber(autoScale, 0.78, 1, 1));
}

function normalizeUiScale(value) {
  return roundScale(clampNumber(value, 0.75, 1.25, appState.settings.uiScale || 1));
}

function normalizeSettings(settings = {}) {
  const safeSettings = settings || {};

  const theme = safeSettings.theme === "light" ? "light" : "dark";
  const language = safeSettings.language === "en" ? "en" : "es";

  const uiScale = normalizeUiScale(
    safeSettings.uiScale ?? safeSettings.ui_scale ?? appState.settings.uiScale
  );

  const sidebarWidth = clampNumber(
    safeSettings.sidebarWidth ?? safeSettings.sidebar_width,
    220,
    420,
    appState.settings.sidebarWidth
  );

  const editorFontSize = clampNumber(
    safeSettings.editorFontSize ?? safeSettings.editor_font_size,
    11,
    24,
    appState.settings.editorFontSize
  );

  const editorFontFamily = String(
    safeSettings.editorFontFamily ?? safeSettings.editor_font_family ?? appState.settings.editorFontFamily
  ).trim() || "JetBrains Mono";

  const aiProvider = normalizeAiProvider(
    safeSettings.aiProvider ?? safeSettings.ai_provider ?? appState.settings.aiProvider
  );

  const aiBaseUrl = String(
    safeSettings.aiBaseUrl ?? safeSettings.ai_base_url ?? defaultAiBaseUrl(aiProvider)
  ).trim() || defaultAiBaseUrl(aiProvider);

  const aiApiKey = String(
    safeSettings.aiApiKey ?? safeSettings.ai_api_key ?? appState.settings.aiApiKey ?? ""
  ).trim();

  const aiModel = String(
    safeSettings.aiModel ?? safeSettings.ai_model ?? defaultAiModel(aiProvider)
  ).trim() || defaultAiModel(aiProvider);

  return {
    theme,
    language,
    uiScale,
    sidebarWidth,
    editorFontSize,
    editorFontFamily,
    aiProvider,
    aiBaseUrl: aiBaseUrl.replace(/\/+$/, ""),
    aiApiKey,
    aiModel
  };
}

function normalizeAiProvider(provider) {
  const value = String(provider || "").trim().toLowerCase();

  if (value === "openai" || value === "openrouter" || value === "claude") {
    return value;
  }

  return "ollama";
}

function defaultAiBaseUrl(provider) {
  if (provider === "openai") {
    return "https://api.openai.com/v1";
  }

  if (provider === "openrouter") {
    return "https://openrouter.ai/api/v1";
  }

  if (provider === "claude") {
    return "https://api.anthropic.com";
  }

  return "http://localhost:11434";
}

function defaultAiModel(provider) {
  if (provider === "openai") {
    return "gpt-4o-mini";
  }

  if (provider === "openrouter") {
    return "openai/gpt-4o-mini";
  }

  if (provider === "claude") {
    return "claude-3-5-sonnet-latest";
  }

  return "llama3.2";
}

function resetActiveFileState() {
  appState.activeFilePath = null;
  appState.activeFileName = null;
  appState.activeFileContent = "";
  appState.isDirty = false;
  appState.cursorLine = 1;
  appState.cursorColumn = 1;
  appState.activeLanguage = "Text";
}

function syncStateFromTab(tab) {
  if (!tab) {
    resetActiveFileState();
    return;
  }

  appState.activeFilePath = tab.path;
  appState.activeFileName = tab.name;
  appState.activeFileContent = tab.content;
  appState.isDirty = Boolean(tab.isDirty);
  appState.activeLanguage = tab.language || detectLanguage(tab.path);
  appState.cursorLine = tab.cursorLine || 1;
  appState.cursorColumn = tab.cursorColumn || 1;
}

function createTab({ path, content }) {
  const normalizedPath = normalizePath(path);
  const normalizedContent = normalizeContent(content);
  const name = getFileName(normalizedPath) || normalizedPath;
  const language = detectLanguage(normalizedPath);

  return {
    path: normalizedPath,
    name,
    content: normalizedContent,
    savedContent: normalizedContent,
    isDirty: false,
    cursorLine: 1,
    cursorColumn: 1,
    language
  };
}

function requestUiScaleMeasure() {
  queueMicrotask(() => {
    window.dispatchEvent(new Event("resize"));

    document.dispatchEvent(
      new CustomEvent("aurelius:ui-scale-change", {
        detail: {
          scale: Number(document.documentElement.style.getPropertyValue("--au-ui-scale") || 1),
          userScale: Number(document.documentElement.style.getPropertyValue("--au-user-ui-scale") || 1),
          autoScale: Number(document.documentElement.style.getPropertyValue("--au-auto-ui-scale") || 1)
        }
      })
    );

    try {
      appState.editorView?.requestMeasure?.();
    } catch {
      // No bloqueamos la escala si CodeMirror todavía no está montado.
    }
  });
}

function applyUiScaleCss(userScale, { notify = true } = {}) {
  const safeUserScale = normalizeUiScale(userScale);
  const autoScale = getViewportAutoScale();
  const effectiveScale = roundScale(clampNumber(safeUserScale * autoScale, 0.65, 1.25, 1));

  document.documentElement.style.setProperty("--au-user-ui-scale", String(safeUserScale));
  document.documentElement.style.setProperty("--au-auto-ui-scale", String(autoScale));
  document.documentElement.style.setProperty("--au-ui-scale", String(effectiveScale));

  document.documentElement.dataset.uiScale = String(safeUserScale);
  document.documentElement.dataset.autoUiScale = String(autoScale);
  document.documentElement.dataset.effectiveUiScale = String(effectiveScale);

  document.documentElement.style.fontSize = "";

  if (document.body) {
    document.body.style.zoom = "";
  }

  if (notify) {
    requestUiScaleMeasure();
  }
}

function bindUiScaleResizeOnce() {
  if (uiScaleResizeBound || typeof window === "undefined") {
    return;
  }

  uiScaleResizeBound = true;

  window.addEventListener("resize", () => {
    window.clearTimeout(uiScaleResizeTimer);

    uiScaleResizeTimer = window.setTimeout(() => {
      applyUiScaleCss(appState.settings.uiScale, {
        notify: false
      });

      try {
        appState.editorView?.requestMeasure?.();
      } catch {
        // No bloqueamos resize si CodeMirror no está montado.
      }
    }, 80);
  });
}

export function detectLanguage(filePath = "") {
  const fileName = getFileName(filePath).toLowerCase();

  if (LANGUAGE_BY_FILENAME[fileName]) {
    return LANGUAGE_BY_FILENAME[fileName];
  }

  const extension = getFileExtension(filePath);

  return LANGUAGE_BY_EXTENSION[extension] || "Text";
}

export function applyUiScale(scale) {
  bindUiScaleResizeOnce();
  applyUiScaleCss(scale);
}

export function applyEditorSettings() {
  const fontSize = Number(appState.settings.editorFontSize || 14);
  const safeFontSize = Number.isFinite(fontSize) ? Math.min(24, Math.max(11, fontSize)) : 14;
  const safeFontFamily =
    String(appState.settings.editorFontFamily || "JetBrains Mono").trim() || "JetBrains Mono";

  document.documentElement.style.setProperty("--au-editor-font-size", `${safeFontSize}px`);
  document.documentElement.style.setProperty("--au-editor-font-family", `"${safeFontFamily}"`);
}

export function applyTheme(theme) {
  const safeTheme = theme === "light" ? "light" : "dark";

  document.documentElement.dataset.theme = safeTheme;
}

export function applyLanguage(language) {
  const safeLanguage = language === "en" ? "en" : "es";

  document.documentElement.lang = safeLanguage;
  document.documentElement.dataset.language = safeLanguage;
}

export function setSettings(settings) {
  appState.settings = normalizeSettings({
    ...appState.settings,
    ...(settings || {})
  });

  applyTheme(appState.settings.theme);
  applyLanguage(appState.settings.language);
  applyUiScale(appState.settings.uiScale);
  applyEditorSettings();
}

export function updateSetting(key, value) {
  const nextSettings = {
    ...appState.settings,
    [key]: value
  };

  appState.settings = normalizeSettings(nextSettings);

  if (key === "theme") {
    applyTheme(appState.settings.theme);
  }

  if (key === "language") {
    applyLanguage(appState.settings.language);
  }

  if (key === "uiScale") {
    applyUiScale(appState.settings.uiScale);
  }

  if (key === "editorFontSize" || key === "editorFontFamily") {
    applyEditorSettings();
  }
}

export function setActivityPanel(panel) {
  appState.activityPanel = ALLOWED_ACTIVITY_PANELS.includes(panel) ? panel : "explorer";
}

export function setTopbarVisible(value) {
  appState.layout.topbarVisible = toBoolean(value, true);
}

export function toggleTopbarVisible() {
  appState.layout.topbarVisible = !appState.layout.topbarVisible;
}

export function setSidebarVisible(value) {
  appState.layout.sidebarVisible = toBoolean(value, true);
}

export function toggleSidebarVisible() {
  appState.layout.sidebarVisible = !appState.layout.sidebarVisible;
}

export function setRightPanelVisible(value) {
  appState.layout.rightPanelVisible = toBoolean(value, true);
}

export function toggleRightPanelVisible() {
  appState.layout.rightPanelVisible = !appState.layout.rightPanelVisible;
}

export function setBottomPanelVisible(value) {
  appState.layout.bottomPanelVisible = toBoolean(value, true);
}

export function toggleBottomPanelVisible() {
  appState.layout.bottomPanelVisible = !appState.layout.bottomPanelVisible;
}

export function setSidebarWidth(width) {
  appState.layout.sidebarWidth = clampNumber(width, 220, 460, 286);
}

export function setRightPanelWidth(width) {
  appState.layout.rightPanelWidth = clampNumber(width, 280, 620, 360);
}

export function setBottomPanelHeight(height) {
  appState.layout.bottomPanelHeight = clampNumber(height, 140, 420, 220);
}

export function setActiveRightPanel(panel) {
  appState.layout.activeRightPanel = ALLOWED_RIGHT_PANELS.includes(panel) ? panel : "ai";
}

export function setActiveBottomPanel(panel) {
  appState.layout.activeBottomPanel = ALLOWED_BOTTOM_PANELS.includes(panel) ? panel : "terminal";
}

export function setSearchQuery(query) {
  appState.search.query = String(query || "");
}

export function setSearchResults(results) {
  appState.search.results = Array.isArray(results) ? results : [];
}

export function setSearchLoading(value) {
  appState.search.isLoading = Boolean(value);
}

export function setMonitorLoading(value) {
  appState.monitor.isLoading = Boolean(value);
}

export function setMonitorSnapshot(snapshot) {
  const safeSnapshot = snapshot || {};

  appState.monitor = {
    ...appState.monitor,
    ...safeSnapshot,
    process: {
      ...appState.monitor.process,
      ...(safeSnapshot.process || {})
    },
    system: {
      ...appState.monitor.system,
      ...(safeSnapshot.system || {})
    },
    lastUpdatedAt: safeSnapshot.lastUpdatedAt || safeSnapshot.last_updated_at || new Date().toISOString()
  };
}

export function resetMonitorSnapshot() {
  appState.monitor = {
    isLoading: false,
    lastUpdatedAt: null,
    process: {
      cpuPercent: null,
      memoryBytes: null,
      virtualMemoryBytes: null,
      pid: null
    },
    system: {
      totalMemoryBytes: null,
      usedMemoryBytes: null,
      freeMemoryBytes: null,
      cpuCount: null,
      loadAverage: null
    }
  };
}

export function setLiveServerLoading(value) {
  appState.liveServer.isLoading = Boolean(value);
}

export function setLiveServerStatus(status) {
  const safeStatus = status || {};

  appState.liveServer = {
    ...appState.liveServer,
    isLoading: false,
    running: Boolean(safeStatus.running),
    host: safeStatus.host || "127.0.0.1",
    port: Number(safeStatus.port || 4587),
    url: safeStatus.url || null,
    root: safeStatus.root || null
  };
}

export function resetLiveServerStatus() {
  appState.liveServer = {
    isLoading: false,
    running: false,
    host: "127.0.0.1",
    port: 4587,
    url: null,
    root: null
  };
}

export function setProjectToolsLoading(value) {
  appState.projectTools.isLoading = Boolean(value);
}

export function setProjectTasks(tasks) {
  appState.projectTools.tasks = Array.isArray(tasks) ? tasks : [];
}

export function setProjectTaskRunResult(result) {
  appState.projectTools.lastRun = result || null;
}

export function resetProjectTools() {
  appState.projectTools = {
    isLoading: false,
    tasks: [],
    lastRun: null
  };
}

export function setToolchainDoctorLoading(value) {
  appState.toolchainDoctor.isLoading = Boolean(value);
}

export function setToolchainDoctorItems(items) {
  appState.toolchainDoctor.items = Array.isArray(items) ? items : [];
  appState.toolchainDoctor.lastCheckedAt = new Date().toISOString();
}

export function resetToolchainDoctor() {
  appState.toolchainDoctor = {
    isLoading: false,
    items: [],
    lastCheckedAt: null
  };
}

export function setAiLoading(value) {
  appState.ai.isLoading = Boolean(value);
}

export function addAiMessage(message) {
  const safeMessage = message || {};

  appState.ai.messages.push({
    role: safeMessage.role || "user",
    content: normalizeContent(safeMessage.content)
  });
}

export function clearAiMessages() {
  appState.ai.messages = [];
}

export function setProject({ path, tree }) {
  const normalizedPath = normalizeOptionalPath(path);
  const normalizedTree = normalizeFileTree(tree);

  appState.projectPath = normalizedPath;
  appState.projectName = normalizedPath ? getPathName(normalizedPath) || normalizedPath : null;
  appState.fileTree = normalizedTree;

  resetActiveFileState();

  appState.openTabs = [];
  appState.editorView = null;
  appState.expandedFolders = collectRootExpandedFolders(normalizedTree);

  resetProjectTools();
  resetToolchainDoctor();

  appState.search = {
    query: "",
    results: [],
    isLoading: false
  };
}

export function setProjectTree(tree) {
  appState.fileTree = normalizeFileTree(tree);

  for (const folderPath of collectRootExpandedFolders(appState.fileTree)) {
    appState.expandedFolders.add(folderPath);
  }
}

export function setRecentProjects(projects) {
  appState.recentProjects = Array.isArray(projects)
    ? projects.map(normalizeRecentProject).filter(Boolean)
    : [];
}

export function setActiveFile({ path, content }) {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    resetActiveFileState();
    return;
  }

  const existingTab = appState.openTabs.find((tab) => tab.path === normalizedPath);

  if (existingTab) {
    syncStateFromTab(existingTab);
    return;
  }

  const tab = createTab({
    path: normalizedPath,
    content
  });

  appState.openTabs.push(tab);
  syncStateFromTab(tab);
}

export function setActiveTab(path) {
  const normalizedPath = normalizePath(path);
  const tab = appState.openTabs.find((item) => item.path === normalizedPath);

  if (!tab) {
    return;
  }

  syncStateFromTab(tab);
}

export function updateActiveTabContent(content) {
  const tab = appState.openTabs.find((item) => item.path === appState.activeFilePath);

  if (!tab) {
    return;
  }

  const normalizedContent = normalizeContent(content);

  tab.content = normalizedContent;
  tab.isDirty = tab.content !== tab.savedContent;

  appState.activeFileContent = normalizedContent;
  appState.isDirty = tab.isDirty;
}

export function updateCursorPosition({ line, column }) {
  const numericLine = Number(line);
  const numericColumn = Number(column);

  const safeLine = Number.isFinite(numericLine) && numericLine > 0 ? numericLine : 1;
  const safeColumn = Number.isFinite(numericColumn) && numericColumn > 0 ? numericColumn : 1;

  appState.cursorLine = safeLine;
  appState.cursorColumn = safeColumn;

  const tab = appState.openTabs.find((item) => item.path === appState.activeFilePath);

  if (tab) {
    tab.cursorLine = safeLine;
    tab.cursorColumn = safeColumn;
  }
}

export function setCursorPosition(line, column) {
  updateCursorPosition({
    line,
    column
  });
}

export function markActiveTabSaved(content) {
  const tab = appState.openTabs.find((item) => item.path === appState.activeFilePath);

  if (!tab) {
    return;
  }

  const normalizedContent = normalizeContent(content);

  tab.content = normalizedContent;
  tab.savedContent = normalizedContent;
  tab.isDirty = false;

  appState.activeFileContent = normalizedContent;
  appState.isDirty = false;
}

export function closeTab(path) {
  const normalizedPath = normalizePath(path);
  const index = appState.openTabs.findIndex((tab) => tab.path === normalizedPath);

  if (index === -1) {
    return;
  }

  const wasActive = appState.activeFilePath === normalizedPath;

  appState.openTabs.splice(index, 1);

  if (!wasActive) {
    return;
  }

  const nextTab = appState.openTabs[index] || appState.openTabs[index - 1] || null;

  syncStateFromTab(nextTab);
}

export function updateTabPath(oldPath, newPath, content) {
  const normalizedOldPath = normalizePath(oldPath);
  const normalizedNewPath = normalizePath(newPath);
  const normalizedContent = normalizeContent(content);

  if (!normalizedOldPath || !normalizedNewPath) {
    return;
  }

  const tab = appState.openTabs.find((item) => item.path === normalizedOldPath);

  if (!tab) {
    return;
  }

  const name = getFileName(normalizedNewPath) || normalizedNewPath;
  const language = detectLanguage(normalizedNewPath);

  tab.path = normalizedNewPath;
  tab.name = name;
  tab.content = normalizedContent;
  tab.savedContent = normalizedContent;
  tab.isDirty = false;
  tab.language = language;

  if (appState.activeFilePath === normalizedOldPath) {
    syncStateFromTab(tab);
  }
}

export function removeTabsByPath(targetPath) {
  const normalizedTargetPath = normalizePath(targetPath);

  if (!normalizedTargetPath) {
    return;
  }

  appState.openTabs = appState.openTabs.filter((tab) => {
    return tab.path !== normalizedTargetPath && !tab.path.startsWith(`${normalizedTargetPath}/`);
  });

  const activeStillExists = appState.openTabs.some((tab) => tab.path === appState.activeFilePath);

  if (activeStillExists) {
    return;
  }

  syncStateFromTab(appState.openTabs[0] || null);
}

export function setDirty(value) {
  const isDirty = Boolean(value);
  const tab = appState.openTabs.find((item) => item.path === appState.activeFilePath);

  if (tab) {
    tab.isDirty = isDirty;
  }

  appState.isDirty = isDirty;
}

export function hasDirtyTabs() {
  return appState.openTabs.some((tab) => tab.isDirty);
}

export function getDirtyTabs() {
  return appState.openTabs.filter((tab) => tab.isDirty);
}

export function getActiveTab() {
  return appState.openTabs.find((tab) => tab.path === appState.activeFilePath) || null;
}

export function setEditorView(view) {
  appState.editorView = view || null;
}

export function toggleFolder(path) {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return;
  }

  if (appState.expandedFolders.has(normalizedPath)) {
    appState.expandedFolders.delete(normalizedPath);
    return;
  }

  appState.expandedFolders.add(normalizedPath);
}

export function isFolderExpanded(path) {
  return appState.expandedFolders.has(normalizePath(path));
}

export function expandFolder(path) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath) {
    appState.expandedFolders.add(normalizedPath);
  }
}

export function collapseFolder(path) {
  appState.expandedFolders.delete(normalizePath(path));
}