// src/app/app.js
import {
  appState,
  updateSetting,
  setSearchQuery,
  setSearchResults,
  setSearchLoading,
  setTopbarVisible,
  toggleTopbarVisible,
  toggleSidebarVisible,
  setRightPanelVisible,
  toggleRightPanelVisible,
  setBottomPanelVisible,
  toggleBottomPanelVisible,
  setSidebarWidth,
  setRightPanelWidth,
  setBottomPanelHeight,
  setActivityPanel,
  toggleFolder
} from "./state.js";

import { t } from "./i18n.js";

import {
  applyLayoutPreferences,
  persistLayoutPreferences,
  restoreWorkspaceSession,
  flushLayoutPreferences
} from "./app-session.js";

import {
  loadSettings,
  persistSettings,
  saveSettings,
  getAiProviderPreset,
  getDefaultAiRuntimeSettings,
  normalizeAiRuntimeSettings
} from "./app-settings.js";

import {
  loadRecentProjects,
  handleOpenProject as openProjectAction,
  handleOpenRecentProject as openRecentProjectAction,
  handleClearRecentProjects as clearRecentProjectsAction,
  handleRefreshProject as refreshProjectAction,
  openProjectForSessionRestore
} from "./app-project-actions.js";

import {
  handleCreateFile as createFileAction,
  handleCreateFolder as createFolderAction,
  handleRenamePath as renamePathAction,
  handleDeletePath as deletePathAction,
  handleOpenFile as openFileAction,
  handleOpenGitFile as openGitFileAction,
  handleSaveFile as saveFileAction,
  handleTabClick as tabClickAction,
  handleCloseTab as closeTabAction,
  handleCloseAllTabs as closeAllTabsAction,
  handleCloseActiveTab as closeActiveTabAction,
  handleOpenProblemFile as openProblemFileAction,
  moveTab as moveTabAction,
  jumpEditorToPosition
} from "./app-file-actions.js";

import {
  submitAiPrompt,
  clearAiChat,
  openAiSettings,
  fillAiQuickPrompt,
  copyAiMessage,
  insertAiMessageInEditor,
  replaceEditorSelectionWithAiMessage
} from "./app-ai-actions.js";

import {
  loadProjectTasks,
  executeProjectTask,
  copyProjectTaskCommand,
  loadToolchainDoctor
} from "./app-project-tools.js";

import {
  refreshLiveServerStatus,
  startLiveServer,
  stopLiveServer,
  openLiveServerBrowser,
  toggleLiveServer
} from "./app-live-server.js";

import { refreshMonitorSnapshot } from "./app-monitor.js";
import { refreshIcons } from "./app-icons.js";
import { createCommandActions } from "./app-command-actions.js";
import { handleAppContextMenu } from "./app-context-menu.js";

import {
  renderAppShell,
  renderTabs
} from "./app-render.js";

import { renderExplorer } from "../components/explorer/explorer.js";

import {
  bindQuickOpenEvents,
  closeQuickOpen,
  focusQuickOpenInput,
  getQuickOpenRenderState,
  isQuickOpenOpen,
  openQuickOpen
} from "./app-quick-open.js";

import {
  decodePath,
  getErrorMessage,
  isTypingTarget,
  isModalOpen,
  clampNumber,
  focusElementById
} from "./app-utils.js";

import { searchProject } from "../services/fs.service.js";

import {
  loadGitStatus,
  refreshGitStatus
} from "../components/git/git-panel.js";

import { runDiagnosticsAndPopulate } from "../components/bottom-panel/bottom-panel.js";

import {
  filterCommandActions,
  updateCommandPaletteResults
} from "../components/command-palette/command-palette.js";

import {
  renderCommandHelp,
  updateCommandHelpResults
} from "../components/command-help/command-help.js";

import { hideContextMenu } from "../components/context-menu/context-menu.js";
import { mountEditor } from "../components/editor/editor.js";
import { updateStatusbar } from "../components/statusbar/statusbar.js";

import {
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

let commandPaletteOpen = false;
let commandPaletteQuery = "";
let commandPaletteActiveIndex = 0;

let commandHelpOpen = false;
let commandHelpQuery = "";

function getCommandHelpShortcuts() {
  return [
    {
      label: t("Abrir referencia de comandos", "Open command reference"),
      description: t(
        "Muestra esta ventana con todos los comandos.",
        "Shows this window with all commands."
      ),
      shortcut: "Ctrl+K",
      icon: "keyboard"
    },
    {
      label: "Command Palette",
      description: t("Ejecutar acciones rápidas.", "Run quick actions."),
      shortcut: "Ctrl+Shift+P",
      icon: "sparkles"
    },
    {
      label: "Quick Open",
      description: t(
        "Buscar y abrir archivos del proyecto.",
        "Search and open project files."
      ),
      shortcut: "Ctrl+P",
      icon: "file-search"
    },
    {
      label: t("Abrir proyecto", "Open project"),
      description: t("Seleccionar una carpeta de trabajo.", "Select a workspace folder."),
      shortcut: "Ctrl+O",
      icon: "folder-open"
    },
    {
      label: t("Guardar archivo", "Save file"),
      description: t("Guardar la pestaña activa.", "Save active tab."),
      shortcut: "Ctrl+S",
      icon: "save"
    },
    {
      label: t("Crear archivo", "Create file"),
      description: t("Crear archivo dentro del proyecto.", "Create file inside project."),
      shortcut: "Ctrl+N",
      icon: "file-plus-2"
    },
    {
      label: t("Crear carpeta", "Create folder"),
      description: t("Crear carpeta dentro del proyecto.", "Create folder inside project."),
      shortcut: "Ctrl+Shift+N",
      icon: "folder-plus"
    },
    {
      label: t("Cerrar pestaña", "Close tab"),
      description: t("Cerrar la pestaña activa.", "Close active tab."),
      shortcut: "Ctrl+W",
      icon: "x"
    },
    {
      label: "Explorer",
      description: t("Mostrar u ocultar panel izquierdo.", "Show or hide left panel."),
      shortcut: "Ctrl+B",
      icon: "files"
    },
    {
      label: t("Terminal / Bottom Panel", "Terminal / Bottom Panel"),
      description: t("Mostrar u ocultar panel inferior.", "Show or hide bottom panel."),
      shortcut: "Ctrl+J",
      icon: "terminal"
    },
    {
      label: t("Panel IA", "AI Panel"),
      description: t("Mostrar u ocultar panel derecho IA.", "Show or hide right AI panel."),
      shortcut: "Ctrl+I",
      icon: "bot"
    },
    {
      label: "Topbar",
      description: t("Mostrar u ocultar barra superior.", "Show or hide topbar."),
      shortcut: "Ctrl+Shift+T",
      icon: "panel-top"
    }
  ];
}

function isEditorKeyboardTarget(target) {
  return Boolean(target?.closest?.(".cm-editor"));
}

function renderApp() {
  const app = document.getElementById("app");

  if (!app) {
    return;
  }

  const quickOpenState = getQuickOpenRenderState();

  app.innerHTML =
    renderAppShell({
      commandPaletteOpen,
      commandPaletteQuery,
      commandPaletteActiveIndex,
      commandActions: getCommandActions(),
      ...quickOpenState
    }) +
    renderCommandHelp({
      isOpen: commandHelpOpen,
      query: commandHelpQuery,
      actions: getCommandActions(),
      shortcuts: getCommandHelpShortcuts()
    });

  refreshIcons();
  bindEvents();

  if (appState.activeFilePath && appState.activityPanel !== "settings") {
    mountEditor();
  }

  if (commandPaletteOpen) {
    focusCommandPaletteInput();
  }

  if (commandHelpOpen) {
    focusCommandHelpInput();
  }

  if (isQuickOpenOpen()) {
    focusQuickOpenInput();
  }

  updateStatusbar();
}

function renderExplorerOnly() {
  const explorer = document.querySelector(".au-explorer");

  if (!explorer) {
    return false;
  }

  explorer.outerHTML = renderExplorer({
    projectName: appState.projectName,
    fileTree: appState.fileTree,
    openTabs: appState.openTabs,
    activeFilePath: appState.activeFilePath
  });

  refreshIcons();
  bindExplorerEvents();
  bindOpenEditorsEvents();
  updateStatusbar();

  return true;
}

function renderTabsOnly() {
  const tabs = document.getElementById("editor-tabs");

  if (!tabs) {
    return false;
  }

  tabs.innerHTML = renderTabs();
  refreshIcons();
  updateStatusbar();

  return true;
}

function renderSoftProjectMutation() {
  const explorerUpdated = renderExplorerOnly();

  renderTabsOnly();
  updateStatusbar();

  if (!explorerUpdated) {
    refreshIcons();
  }
}

function handleOpenProject() {
  return openProjectAction({ renderApp });
}

function handleOpenRecentProject(projectPath) {
  return openRecentProjectAction(projectPath, { renderApp });
}

function handleClearRecentProjects() {
  return clearRecentProjectsAction({ renderApp });
}

function handleRefreshProject() {
  return refreshProjectAction({ renderApp: renderExplorerOnly });
}

function handleCreateFile(baseDirectoryPath = "") {
  return createFileAction({ renderApp, baseDirectoryPath });
}

function handleCreateFolder(baseDirectoryPath = "") {
  return createFolderAction({
    renderApp: renderSoftProjectMutation,
    baseDirectoryPath
  });
}

function handleRenamePath(currentPath) {
  return renamePathAction(currentPath, {
    renderApp: renderSoftProjectMutation
  });
}

function handleDeletePath(targetPath) {
  return deletePathAction(targetPath, {
    renderApp: renderSoftProjectMutation
  });
}

function handleOpenFile(filePath) {
  return openFileAction(filePath, { renderApp });
}

function handleOpenGitFile(filePath, status = "") {
  return openGitFileAction(filePath, status, { renderApp });
}

function handleSaveFile() {
  return saveFileAction({ renderApp });
}

function handleTabClick(path) {
  return tabClickAction(path, { renderApp });
}

function handleCloseTab(path) {
  return closeTabAction(path, { renderApp });
}

function handleCloseAllTabs() {
  return closeAllTabsAction({ renderApp });
}

function handleCloseActiveTab() {
  return closeActiveTabAction({ renderApp });
}

function moveTab(step) {
  return moveTabAction(step, { renderApp });
}

async function handleOpenProblemFile(event) {
  return openProblemFileAction(event, { renderApp });
}

function handleStartLiveServer() {
  return startLiveServer({ renderApp });
}

function handleStopLiveServer() {
  return stopLiveServer({ renderApp });
}

function handleToggleLiveServer() {
  return toggleLiveServer({ renderApp });
}

function handleOpenLiveServerBrowser() {
  return openLiveServerBrowser({ renderApp });
}

function handleRefreshLiveServerStatus() {
  return refreshLiveServerStatus({
    renderApp,
    silent: false
  });
}

async function handleActivityPanel(panel) {
  if (panel === "git") {
    setActivityPanel("git");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();
    renderApp();

    queueMicrotask(() => {
      loadGitStatus();
    });

    return;
  }

  if (panel === "monitor") {
    setActivityPanel("monitor");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();
    renderApp();

    queueMicrotask(() => {
      refreshMonitorSnapshot({
        renderApp,
        silent: true
      });
    });

    return;
  }

  if (panel === "tasks") {
    setActivityPanel("tasks");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();
    renderApp();

    queueMicrotask(() => {
      loadProjectTasks({
        renderApp,
        silent: true
      });
    });

    return;
  }

  if (panel === "toolchain") {
    setActivityPanel("toolchain");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();
    renderApp();

    queueMicrotask(() => {
      loadToolchainDoctor({
        renderApp,
        silent: true
      });
    });

    return;
  }

  if (panel === "ai") {
    setRightPanelVisible(true);
    persistLayoutPreferences();
    renderApp();

    toastInfo(
      t("Chat IA abierto en el panel derecho.", "AI chat opened in the right panel."),
      "Aurelius AI"
    );

    return;
  }

  if (panel === "search") {
    setActivityPanel("search");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();
    renderApp();
    return;
  }

  if (panel === "explorer") {
    setActivityPanel("explorer");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();
    renderApp();
    return;
  }

  setActivityPanel(panel);
  persistLayoutPreferences();
  renderApp();

  if (panel === "settings") {
    toastInfo(
      t("Página de ajustes abierta.", "Settings page opened."),
      "Settings"
    );
  }
}

async function handleToggleTheme() {
  try {
    const nextTheme = appState.settings.theme === "dark" ? "light" : "dark";

    updateSetting("theme", nextTheme);
    await persistSettings();

    renderApp();

    toastSuccess(
      nextTheme === "dark"
        ? t("Tema oscuro activado.", "Dark theme enabled.")
        : t("Tema claro activado.", "Light theme enabled."),
      t("Tema actualizado", "Theme updated")
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo guardar el tema", "Could not save theme")
    );
  }
}

async function handleToggleLanguage() {
  try {
    const nextLanguage = appState.settings.language === "en" ? "es" : "en";

    updateSetting("language", nextLanguage);
    await persistSettings();

    renderApp();

    toastSuccess(
      nextLanguage === "en"
        ? "Interface switched to English."
        : "Interfaz cambiada a español.",
      nextLanguage === "en" ? "Language updated" : "Idioma actualizado"
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo cambiar el idioma", "Could not change language")
    );
  }
}

function handleToggleTopbar() {
  toggleTopbarVisible();
  persistLayoutPreferences();
  renderApp();

  toastSuccess(
    appState.layout.topbarVisible
      ? t("Topbar visible.", "Topbar visible.")
      : t("Topbar oculto.", "Topbar hidden."),
    t("Layout actualizado", "Layout updated")
  );
}

function handleToggleSidebar() {
  toggleSidebarVisible();

  if (
    appState.layout.sidebarVisible &&
    !["explorer", "search", "git", "monitor", "tasks", "toolchain"].includes(appState.activityPanel)
  ) {
    setActivityPanel("explorer");
  }

  persistLayoutPreferences();
  renderApp();
}

function handleToggleRightPanel() {
  toggleRightPanelVisible();
  persistLayoutPreferences();
  renderApp();
}

function handleToggleBottomPanel() {
  toggleBottomPanelVisible();
  persistLayoutPreferences();
  renderApp();
}

function ensureBottomPanelOpen() {
  if (!appState.layout.bottomPanelVisible) {
    setBottomPanelVisible(true);
    persistLayoutPreferences();
  }
}

function focusCommandPaletteInput(selectAll = false) {
  focusElementById("command-palette-input", { selectAll });
}

function openCommandPalette() {
  commandPaletteOpen = true;
  commandPaletteQuery = "";
  commandPaletteActiveIndex = 0;

  commandHelpOpen = false;
  commandHelpQuery = "";

  closeQuickOpen(renderApp);
  hideContextMenu();

  renderApp();
  focusCommandPaletteInput(true);
}

function closeCommandPalette() {
  commandPaletteOpen = false;
  commandPaletteQuery = "";
  commandPaletteActiveIndex = 0;
  renderApp();
}

function focusCommandHelpInput(selectAll = false) {
  focusElementById("command-help-input", { selectAll });
}

function openCommandHelp() {
  commandHelpOpen = true;
  commandHelpQuery = "";

  commandPaletteOpen = false;
  commandPaletteQuery = "";
  commandPaletteActiveIndex = 0;

  closeQuickOpen(renderApp);
  hideContextMenu();

  renderApp();
  focusCommandHelpInput(true);
}

function closeCommandHelp() {
  commandHelpOpen = false;
  commandHelpQuery = "";
  renderApp();
}

function handleCommandHelpInput(event) {
  commandHelpQuery = event.target.value || "";

  updateCommandHelpResults({
    query: commandHelpQuery,
    actions: getCommandActions(),
    shortcuts: getCommandHelpShortcuts(),
    onExecute: executeCommandHelpAction
  });
}

function executeCommandHelpAction(actionId) {
  const action = getCommandActions().find((item) => item.id === actionId);

  if (!action || action.disabled) {
    return;
  }

  commandHelpOpen = false;
  commandHelpQuery = "";

  action.run();
}

function handleOpenQuickOpen() {
  if (!appState.projectPath) {
    toastWarning(
      t(
        "Primero abrí un proyecto para buscar archivos.",
        "Open a project first to search files."
      ),
      "Quick Open"
    );

    return;
  }

  openQuickOpen(renderApp);
}

function handleRunDiagnostics() {
  ensureBottomPanelOpen();
  renderApp();

  queueMicrotask(() => {
    runDiagnosticsAndPopulate();
  });
}

function handleOpenGitPanel() {
  setActivityPanel("git");

  if (!appState.layout.sidebarVisible) {
    toggleSidebarVisible();
  }

  persistLayoutPreferences();
  renderApp();

  queueMicrotask(() => {
    loadGitStatus();
  });
}

function getCommandActions() {
  return createCommandActions({
    handleOpenProject,
    handleCreateFile,
    handleCreateFolder,
    handleSaveFile,
    handleCloseActiveTab,
    handleActivityPanel,
    handleOpenGitPanel,
    handleToggleTheme,
    handleToggleLanguage,
    handleToggleTopbar,
    handleToggleSidebar,
    handleToggleRightPanel,
    handleToggleBottomPanel,
    handleRunDiagnostics,
    handleOpenQuickOpen,
    handleStartLiveServer,
    handleStopLiveServer,
    handleToggleLiveServer,
    handleOpenLiveServerBrowser,
    handleRefreshLiveServerStatus,
    ensureBottomPanelOpen,
    renderApp
  });
}

function getVisibleCommandActions() {
  return filterCommandActions(getCommandActions(), commandPaletteQuery);
}

function syncCommandPaletteActiveItem(nextIndex) {
  const items = Array.from(document.querySelectorAll("[data-command-action-id]"));

  if (!items.length) {
    commandPaletteActiveIndex = 0;
    return;
  }

  const safeIndex = Math.max(0, Math.min(nextIndex, items.length - 1));

  commandPaletteActiveIndex = safeIndex;

  items.forEach((item, index) => {
    const isActive = index === safeIndex;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      item.scrollIntoView({
        block: "nearest"
      });
    }
  });
}

function executeCommandAction(actionId) {
  const action = getCommandActions().find((item) => item.id === actionId);

  if (!action || action.disabled) {
    return;
  }

  commandPaletteOpen = false;
  commandPaletteQuery = "";
  commandPaletteActiveIndex = 0;

  action.run();
}

function handleCommandPaletteInput(event) {
  commandPaletteQuery = event.target.value || "";
  commandPaletteActiveIndex = 0;

  updateCommandPaletteResults({
    query: commandPaletteQuery,
    actions: getCommandActions(),
    activeIndex: commandPaletteActiveIndex,
    onHover: syncCommandPaletteActiveItem,
    onExecute: executeCommandAction
  });
}

function handleCommandPaletteKeydown(event) {
  const visibleActions = getVisibleCommandActions();

  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();

    if (!visibleActions.length) {
      return;
    }

    syncCommandPaletteActiveItem(
      (commandPaletteActiveIndex + 1 + visibleActions.length) % visibleActions.length
    );

    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    if (!visibleActions.length) {
      return;
    }

    syncCommandPaletteActiveItem(
      (commandPaletteActiveIndex - 1 + visibleActions.length) % visibleActions.length
    );

    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    const action = visibleActions[commandPaletteActiveIndex];

    if (action) {
      executeCommandAction(action.id);
    }
  }
}

function startPanelResize(event, panel) {
  event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const startSidebarWidth = appState.layout.sidebarWidth;
  const startRightPanelWidth = appState.layout.rightPanelWidth;
  const startBottomPanelHeight = appState.layout.bottomPanelHeight;

  document.body.classList.add("is-resizing-layout");

  const onMouseMove = (moveEvent) => {
    if (panel === "sidebar") {
      const nextWidth = clampNumber(startSidebarWidth + (moveEvent.clientX - startX), 220, 460);

      setSidebarWidth(nextWidth);
      document
        .querySelector(".aurelius-main")
        ?.style.setProperty("--au-effective-sidebar-width", `${nextWidth}px`);

      return;
    }

    if (panel === "right") {
      const nextWidth = clampNumber(startRightPanelWidth - (moveEvent.clientX - startX), 280, 620);

      setRightPanelWidth(nextWidth);
      document
        .querySelector(".aurelius-main")
        ?.style.setProperty("--au-effective-right-panel-width", `${nextWidth}px`);

      return;
    }

    if (panel === "bottom") {
      const nextHeight = clampNumber(startBottomPanelHeight - (moveEvent.clientY - startY), 140, 420);

      setBottomPanelHeight(nextHeight);
      document
        .querySelector(".aurelius-main")
        ?.style.setProperty("--au-effective-bottom-panel-height", `${nextHeight}px`);
    }
  };

  const onMouseUp = () => {
    persistLayoutPreferences();

    document.body.classList.remove("is-resizing-layout");
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

async function runProjectSearch(query, { source = "search-panel" } = {}) {
  try {
    if (!appState.projectPath) {
      toastWarning(
        t("Primero abrí un proyecto para buscar.", "Open a project first to search."),
        t("Sin proyecto", "No project")
      );

      return;
    }

    const safeQuery = String(query ?? "").trim();

    setSearchQuery(safeQuery);

    if (safeQuery.length < 2) {
      setSearchResults([]);

      if (source === "topbar") {
        setActivityPanel("search");

        if (!appState.layout.sidebarVisible) {
          toggleSidebarVisible();
        }

        persistLayoutPreferences();
      }

      renderApp();

      toastInfo(
        t(
          "La búsqueda necesita al menos 2 caracteres.",
          "Search needs at least 2 characters."
        ),
        "Search"
      );

      return;
    }

    setActivityPanel("search");

    if (!appState.layout.sidebarVisible) {
      toggleSidebarVisible();
    }

    persistLayoutPreferences();

    setSearchLoading(true);
    renderApp();

    const results = await searchProject(appState.projectPath, safeQuery);

    setResultsAndRender(results);
  } catch (error) {
    console.error(error);
    setSearchLoading(false);
    renderApp();

    toastError(
      getErrorMessage(error),
      t("No se pudo buscar", "Could not search")
    );
  }
}

function setResultsAndRender(results) {
  const safeResults = Array.isArray(results) ? results : [];

  setSearchResults(safeResults);
  setSearchLoading(false);

  renderApp();

  toastSuccess(
    `${safeResults.length} ${t("resultado(s) encontrados.", "result(s) found.")}`,
    "Search"
  );
}

async function handleSearchSubmit(event) {
  event.preventDefault();

  const input = document.getElementById("project-search-input");
  const query = input?.value?.trim() || "";

  return runProjectSearch(query, {
    source: "search-panel"
  });
}

async function handleTopbarSearchSubmit(event) {
  event.preventDefault();

  const input = document.getElementById("topbar-search-input");
  const query = input?.value?.trim() || "";

  return runProjectSearch(query, {
    source: "topbar"
  });
}

function syncSettingsAiProviderFields(provider, { forceDefaults = false, keepApiKey = true } = {}) {
  const providerSelect = document.getElementById("settings-ai-provider");
  const baseUrlInput = document.getElementById("settings-ai-base-url");
  const modelInput = document.getElementById("settings-ai-model");
  const apiKeyInput = document.getElementById("settings-ai-api-key");

  if (!providerSelect || !baseUrlInput || !modelInput || !apiKeyInput) {
    return;
  }

  const preset = getAiProviderPreset(provider);
  const currentApiKey = apiKeyInput.value || "";

  const nextRuntime = forceDefaults
    ? getDefaultAiRuntimeSettings(preset.id, keepApiKey ? currentApiKey : "")
    : normalizeAiRuntimeSettings({
        aiProvider: preset.id,
        aiBaseUrl: baseUrlInput.value,
        aiModel: modelInput.value,
        aiApiKey: currentApiKey
      });

  providerSelect.value = nextRuntime.aiProvider;
  baseUrlInput.value = nextRuntime.aiBaseUrl;
  modelInput.value = nextRuntime.aiModel;
  apiKeyInput.value = nextRuntime.aiApiKey;

  baseUrlInput.placeholder = preset.baseUrl;
  modelInput.placeholder = preset.model;
  apiKeyInput.placeholder = preset.apiKeyRequired
    ? "sk-..."
    : t("No requerida para Ollama local", "Not required for local Ollama");

  apiKeyInput.disabled = !preset.apiKeyRequired;
}

function handleSettingsAiProviderChange(event) {
  syncSettingsAiProviderFields(event.target.value, {
    forceDefaults: true,
    keepApiKey: true
  });
}

function getSettingsFormValues() {
  const rawSettings = {
    theme: document.getElementById("settings-theme")?.value || "dark",
    language: document.getElementById("settings-language")?.value || "es",
    uiScale: Number(document.getElementById("settings-ui-scale")?.value || 1),
    sidebarWidth: Number(document.getElementById("settings-sidebar-width")?.value || 286),
    editorFontSize: Number(document.getElementById("settings-editor-font-size")?.value || 14),
    editorFontFamily: document.getElementById("settings-editor-font-family")?.value || "JetBrains Mono",
    aiProvider: document.getElementById("settings-ai-provider")?.value || "ollama",
    aiBaseUrl: document.getElementById("settings-ai-base-url")?.value || "http://localhost:11434",
    aiApiKey: document.getElementById("settings-ai-api-key")?.value || "",
    aiModel: document.getElementById("settings-ai-model")?.value || "llama3.2"
  };

  const normalizedAiRuntime = normalizeAiRuntimeSettings(
    rawSettings,
    rawSettings.aiProvider
  );

  return {
    ...rawSettings,
    ...normalizedAiRuntime
  };
}

async function handleSettingsSave(event) {
  event.preventDefault();

  try {
    const nextTopbarVisible =
      document.getElementById("settings-topbar-visible")?.value !== "false";

    const nextSettings = getSettingsFormValues();

    await saveSettings(nextSettings);

    setTopbarVisible(nextTopbarVisible);
    setSidebarWidth(nextSettings.sidebarWidth);

    persistLayoutPreferences();
    renderApp();

    toastSuccess(
      nextSettings.language === "en"
        ? "Settings saved successfully."
        : "Settings guardados correctamente.",
      "Settings"
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudieron guardar los settings", "Could not save settings")
    );
  }
}

function bindSettingsEvents() {
  const settingsForm = document.getElementById("settings-form");
  const aiProviderSelect = document.getElementById("settings-ai-provider");

  settingsForm?.addEventListener("submit", handleSettingsSave);

  if (aiProviderSelect) {
    syncSettingsAiProviderFields(aiProviderSelect.value, {
      forceDefaults: false,
      keepApiKey: true
    });

    aiProviderSelect.addEventListener("change", handleSettingsAiProviderChange);
  }

  document.querySelectorAll("[data-settings-ai-provider-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const provider = card.dataset.settingsAiProviderCard;

      if (!provider || !aiProviderSelect) {
        return;
      }

      aiProviderSelect.value = provider;
      syncSettingsAiProviderFields(provider, {
        forceDefaults: true,
        keepApiKey: true
      });
    });
  });
}

function bindWelcomeEvents() {
  const welcomeOpenProjectButton = document.getElementById("welcome-open-project-btn");
  const welcomeNewFileButton = document.getElementById("welcome-new-file-btn");
  const welcomeNewFolderButton = document.getElementById("welcome-new-folder-btn");
  const clearRecentButton = document.getElementById("welcome-clear-recent-btn");

  welcomeOpenProjectButton?.addEventListener("click", handleOpenProject);
  welcomeNewFileButton?.addEventListener("click", () => handleCreateFile());
  welcomeNewFolderButton?.addEventListener("click", () => handleCreateFolder());
  clearRecentButton?.addEventListener("click", handleClearRecentProjects);

  document.querySelectorAll("[data-recent-project-path]").forEach((button) => {
    button.addEventListener("click", () => {
      const projectPath = decodePath(button.dataset.recentProjectPath);
      handleOpenRecentProject(projectPath);
    });
  });
}

function bindOpenEditorsEvents() {
  document.querySelectorAll(".au-open-editors [data-tab-path]").forEach((button) => {
    button.addEventListener("click", () => {
      handleTabClick(decodePath(button.dataset.tabPath));
    });
  });

  document.querySelectorAll(".au-open-editors [data-close-tab-path]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleCloseTab(decodePath(button.dataset.closeTabPath));
    });
  });
}

function bindProjectToolsEvents() {
  const projectTasksRefreshButton = document.getElementById("project-tasks-refresh-btn");
  const toolchainRefreshButton = document.getElementById("toolchain-refresh-btn");

  projectTasksRefreshButton?.addEventListener("click", () => {
    loadProjectTasks({
      renderApp
    });
  });

  toolchainRefreshButton?.addEventListener("click", () => {
    loadToolchainDoctor({
      renderApp
    });
  });

  document.querySelectorAll("[data-project-task-run]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        const task = JSON.parse(decodeURIComponent(button.dataset.projectTaskRun || ""));

        executeProjectTask(task, {
          renderApp
        });
      } catch (error) {
        console.error(error);

        toastError(
          t(
            "No se pudo leer el comando seleccionado.",
            "Could not read the selected command."
          ),
          "Project Commands"
        );
      }
    });
  });

  document.querySelectorAll("[data-project-task-copy]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        const task = JSON.parse(decodeURIComponent(button.dataset.projectTaskCopy || ""));

        copyProjectTaskCommand(task);
      } catch (error) {
        console.error(error);

        toastError(
          t(
            "No se pudo copiar el comando seleccionado.",
            "Could not copy the selected command."
          ),
          "Project Commands"
        );
      }
    });
  });
}

function bindLiveServerEvents() {
  const liveServerToggleButton = document.getElementById("live-server-toggle-btn");
  const liveServerStartButton = document.getElementById("live-server-start-btn");
  const liveServerStopButton = document.getElementById("live-server-stop-btn");
  const liveServerOpenButton = document.getElementById("live-server-open-btn");
  const liveServerRefreshButton = document.getElementById("live-server-refresh-btn");

  liveServerToggleButton?.addEventListener("click", handleToggleLiveServer);
  liveServerStartButton?.addEventListener("click", handleStartLiveServer);
  liveServerStopButton?.addEventListener("click", handleStopLiveServer);
  liveServerOpenButton?.addEventListener("click", handleOpenLiveServerBrowser);
  liveServerRefreshButton?.addEventListener("click", handleRefreshLiveServerStatus);
}

function bindCommandHelpEvents() {
  const commandHelpInput = document.getElementById("command-help-input");

  commandHelpInput?.addEventListener("input", handleCommandHelpInput);

  commandHelpInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandHelp();
    }
  });

  document.querySelectorAll("[data-command-help-close]").forEach((element) => {
    element.addEventListener("click", closeCommandHelp);
  });

  document.querySelectorAll("[data-command-help-action-id]").forEach((button) => {
    button.addEventListener("click", () => {
      executeCommandHelpAction(button.dataset.commandHelpActionId);
    });
  });
}

function bindAppContextMenu() {
  document.getElementById("app")?.addEventListener("contextmenu", (event) => {
    handleAppContextMenu(event, {
      renderApp,
      handleCreateFile,
      handleCreateFolder,
      handleDeletePath,
      handleToggleLiveServer,
      commandPaletteOpen,
      commandHelpOpen,
      isQuickOpenOpen
    });
  });
}

function bindGitEvents() {
  const gitPanel = document.querySelector(".au-git-panel");

  gitPanel?.addEventListener("click", (event) => {
    const refreshButton = event.target.closest("#git-refresh-btn");

    if (refreshButton) {
      event.preventDefault();
      refreshGitStatus();
      return;
    }

    const fileButton = event.target.closest("[data-git-file-path]");

    if (!fileButton || fileButton.disabled) {
      return;
    }

    handleOpenGitFile(
      decodePath(fileButton.dataset.gitFilePath),
      fileButton.dataset.gitFileStatus || ""
    );
  });
}

function bindActivityEvents() {
  document.querySelectorAll("[data-activity-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      handleActivityPanel(button.dataset.activityPanel);
    });
  });
}

function bindAiEvents() {
  const aiForm = document.getElementById("ai-chat-form");
  const aiClearButton = document.getElementById("ai-clear-chat-btn");
  const aiOpenSettingsButton = document.getElementById("ai-open-settings-btn");

  aiForm?.addEventListener("submit", (event) => {
    submitAiPrompt(event, {
      renderApp
    });
  });

  aiClearButton?.addEventListener("click", () => {
    clearAiChat({
      renderApp
    });
  });

  aiOpenSettingsButton?.addEventListener("click", () => {
    openAiSettings({
      renderApp,
      setActivityPanel,
      persistLayoutPreferences
    });
  });

  document.querySelectorAll("[data-ai-quick-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      fillAiQuickPrompt(button.dataset.aiQuickPrompt || "");
    });
  });

  document.querySelectorAll("[data-ai-copy-message]").forEach((button) => {
    button.addEventListener("click", () => {
      copyAiMessage(button.dataset.aiCopyMessage);
    });
  });

  document.querySelectorAll("[data-ai-insert-message]").forEach((button) => {
    button.addEventListener("click", () => {
      insertAiMessageInEditor(button.dataset.aiInsertMessage, {
        renderApp
      });
    });
  });

  document.querySelectorAll("[data-ai-replace-selection-message]").forEach((button) => {
    button.addEventListener("click", () => {
      replaceEditorSelectionWithAiMessage(button.dataset.aiReplaceSelectionMessage);
    });
  });
}

function bindSearchEvents() {
  const searchForm = document.getElementById("search-project-form");
  const topbarSearchForm = document.getElementById("topbar-search-form");

  searchForm?.addEventListener("submit", handleSearchSubmit);
  topbarSearchForm?.addEventListener("submit", handleTopbarSearchSubmit);

  document.querySelectorAll("[data-search-file-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const filePath = decodePath(button.dataset.searchFilePath);
      const lineNumber = Number(button.dataset.searchLineNumber || 0);

      await handleOpenFile(filePath);

      if (lineNumber > 0) {
        jumpEditorToPosition(lineNumber, 1);
      }
    });
  });
}

function bindCommandPaletteEvents() {
  const commandPaletteInput = document.getElementById("command-palette-input");

  commandPaletteInput?.addEventListener("input", handleCommandPaletteInput);
  commandPaletteInput?.addEventListener("keydown", handleCommandPaletteKeydown);

  document.querySelectorAll("[data-command-action-id]").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      const index = Number(button.dataset.commandIndex);

      if (Number.isFinite(index)) {
        syncCommandPaletteActiveItem(index);
      }
    });

    button.addEventListener("click", () => {
      executeCommandAction(button.dataset.commandActionId);
    });
  });

  document.querySelectorAll("[data-command-palette-close]").forEach((element) => {
    element.addEventListener("click", closeCommandPalette);
  });
}

function bindTabsEvents() {
  const editorTabs = document.getElementById("editor-tabs");

  editorTabs?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-tab-path]");

    if (closeButton) {
      event.stopPropagation();
      handleCloseTab(decodePath(closeButton.dataset.closeTabPath));
      return;
    }

    const tabButton = event.target.closest("[data-tab-path]");

    if (!tabButton) {
      return;
    }

    handleTabClick(decodePath(tabButton.dataset.tabPath));
  });
}

function bindEditorEvents() {
  const closeAllButton = document.getElementById("editor-close-all-tabs-btn");

  closeAllButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleCloseAllTabs();
  });
}

function bindExplorerEvents() {
  const explorerTree = document.getElementById("explorer-tree");

  explorerTree?.addEventListener("click", (event) => {
    const renameButton = event.target.closest("[data-rename-path]");

    if (renameButton) {
      event.stopPropagation();
      handleRenamePath(decodePath(renameButton.dataset.renamePath));
      return;
    }

    const deleteButton = event.target.closest("[data-delete-path]");

    if (deleteButton) {
      event.stopPropagation();
      handleDeletePath(decodePath(deleteButton.dataset.deletePath));
      return;
    }

    const folderButton = event.target.closest("[data-folder-path]");

    if (folderButton) {
      const folderPath = decodePath(folderButton.dataset.folderPath);

      toggleFolder(folderPath);

      document.dispatchEvent(
        new CustomEvent("aurelius:explorer-folder-toggle", {
          detail: {
            folderPath
          }
        })
      );

      return;
    }

    const fileButton = event.target.closest("[data-file-path]");

    if (!fileButton) {
      return;
    }

    handleOpenFile(decodePath(fileButton.dataset.filePath));
  });
}

function bindLayoutEvents() {
  document.querySelectorAll("[data-resize-panel]").forEach((handle) => {
    handle.addEventListener("mousedown", (event) => {
      startPanelResize(event, handle.dataset.resizePanel);
    });
  });
}

function bindEvents() {
  document.getElementById("open-project-btn")?.addEventListener("click", handleOpenProject);
  document.getElementById("save-file-btn")?.addEventListener("click", handleSaveFile);
  document.getElementById("toggle-theme-btn")?.addEventListener("click", handleToggleTheme);
  document.getElementById("toggle-sidebar-btn")?.addEventListener("click", handleToggleSidebar);
  document.getElementById("toggle-right-panel-btn")?.addEventListener("click", handleToggleRightPanel);
  document.getElementById("toggle-bottom-panel-btn")?.addEventListener("click", handleToggleBottomPanel);
  document.getElementById("refresh-project-btn")?.addEventListener("click", handleRefreshProject);
  document.getElementById("new-file-btn")?.addEventListener("click", () => handleCreateFile());
  document.getElementById("new-folder-btn")?.addEventListener("click", () => handleCreateFolder());

  document.getElementById("monitor-refresh-btn")?.addEventListener("click", () => {
    refreshMonitorSnapshot({
      renderApp
    });
  });

  bindSettingsEvents();
  bindWelcomeEvents();
  bindOpenEditorsEvents();
  bindProjectToolsEvents();
  bindLiveServerEvents();
  bindCommandHelpEvents();
  bindGitEvents();
  bindActivityEvents();
  bindAiEvents();
  bindSearchEvents();
  bindCommandPaletteEvents();
  bindTabsEvents();
  bindEditorEvents();
  bindExplorerEvents();
  bindLayoutEvents();
  bindAppContextMenu();

  bindQuickOpenEvents({
    renderApp,
    openFile: handleOpenFile
  });
}

function bindGlobalEvents() {
  document.addEventListener(
    "click",
    (event) => {
      const closeAllTabsButton = event.target.closest(
        "#editor-close-all-tabs-btn, [data-editor-close-all-tabs]"
      );

      if (!closeAllTabsButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      handleCloseAllTabs();
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const hasCtrl = event.ctrlKey || event.metaKey;

    if (event.key === "Escape") {
      hideContextMenu();
    }

    if (isModalOpen()) {
      return;
    }

    if (commandHelpOpen && event.key === "Escape") {
      event.preventDefault();
      closeCommandHelp();
      return;
    }

    if (commandPaletteOpen && event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
      return;
    }

    if (isQuickOpenOpen() && event.key === "Escape") {
      event.preventDefault();
      closeQuickOpen(renderApp);
      return;
    }

    if (hasCtrl && !event.shiftKey && key === "k") {
      event.preventDefault();
      openCommandHelp();
      return;
    }

    if (hasCtrl && event.shiftKey && key === "p") {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (hasCtrl && !event.shiftKey && key === "p") {
      event.preventDefault();
      handleOpenQuickOpen();
      return;
    }

    if (commandPaletteOpen || commandHelpOpen || isQuickOpenOpen()) {
      return;
    }

    if (!hasCtrl) {
      return;
    }

    const targetIsTyping = isTypingTarget(event.target);
    const targetIsEditor = isEditorKeyboardTarget(event.target);

    if (targetIsTyping && !targetIsEditor) {
      return;
    }

    if (key === "s") {
      event.preventDefault();
      handleSaveFile();
      return;
    }

    if (key === "o") {
      event.preventDefault();
      handleOpenProject();
      return;
    }

    if (key === "t" && event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      handleToggleTopbar();
      return;
    }

    if (key === "b") {
      event.preventDefault();
      handleToggleSidebar();
      return;
    }

    if (key === "i") {
      event.preventDefault();
      handleToggleRightPanel();
      return;
    }

    if (key === "j") {
      event.preventDefault();
      handleToggleBottomPanel();
      return;
    }

    if (key === "n" && event.shiftKey) {
      event.preventDefault();
      handleCreateFolder();
      return;
    }

    if (key === "n") {
      event.preventDefault();
      handleCreateFile();
      return;
    }

    if (key === "w") {
      event.preventDefault();
      handleCloseActiveTab();
      return;
    }

    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      moveTab(-1);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      moveTab(1);
    }
  });

  window.addEventListener("beforeunload", () => {
    flushLayoutPreferences();
  });

  document.addEventListener("aurelius:dirty-change", () => {
    const tabs = document.getElementById("editor-tabs");

    if (tabs) {
      tabs.innerHTML = renderTabs();
      refreshIcons();
    }

    updateStatusbar();
  });

  document.addEventListener("aurelius:open-problem-file", handleOpenProblemFile);
}

export async function initAureliusApp() {
  await loadSettings();

  const savedSession = await applyLayoutPreferences();

  await loadRecentProjects();

  await restoreWorkspaceSession(savedSession, {
    renderApp,
    openProjectForSessionRestore
  });

  await refreshLiveServerStatus({
    renderApp: null,
    silent: true
  });

  renderApp();
  bindGlobalEvents();
}