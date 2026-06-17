// src/app/app-session.js
import {
  appState,
  setActivityPanel,
  setTopbarVisible,
  setSidebarVisible,
  setRightPanelVisible,
  setBottomPanelVisible,
  setSidebarWidth,
  setRightPanelWidth,
  setBottomPanelHeight,
  setActiveRightPanel,
  setActiveBottomPanel,
  setActiveFile,
  setActiveTab,
  updateCursorPosition
} from "./state.js";

import { readFile } from "../services/fs.service.js";

import {
  readUiSession,
  writeUiSession
} from "../services/session.service.js";

let uiSessionSaveTimer = null;

function normalizePath(value = "") {
  return String(value || "").replaceAll("\\", "/");
}

function normalizeOptionalPath(value) {
  const normalized = normalizePath(value).trim();

  return normalized ? normalized : null;
}

function normalizeSessionTab(tab = {}) {
  const path = normalizeOptionalPath(tab.path);

  if (!path) {
    return null;
  }

  const cursorLine = Number(tab.cursor_line ?? tab.cursorLine ?? 1);
  const cursorColumn = Number(tab.cursor_column ?? tab.cursorColumn ?? 1);

  return {
    path,
    cursorLine: Number.isFinite(cursorLine) && cursorLine > 0 ? cursorLine : 1,
    cursorColumn: Number.isFinite(cursorColumn) && cursorColumn > 0 ? cursorColumn : 1,
    isDirty: Boolean(tab.is_dirty ?? tab.isDirty)
  };
}

function normalizeSessionTabs(tabs = []) {
  if (!Array.isArray(tabs)) {
    return [];
  }

  const seen = new Set();
  const normalizedTabs = [];

  for (const tab of tabs) {
    const normalizedTab = normalizeSessionTab(tab);

    if (!normalizedTab || seen.has(normalizedTab.path)) {
      continue;
    }

    seen.add(normalizedTab.path);
    normalizedTabs.push(normalizedTab);
  }

  return normalizedTabs.slice(0, 24);
}

function normalizeExpandedFolders(folders = []) {
  if (!Array.isArray(folders)) {
    return [];
  }

  return Array.from(
    new Set(
      folders
        .map(normalizeOptionalPath)
        .filter(Boolean)
    )
  ).slice(0, 300);
}

function getOpenTabsPayload() {
  return appState.openTabs.map((tab) => {
    return {
      path: normalizePath(tab.path),
      cursor_line: Number(tab.cursorLine || 1),
      cursor_column: Number(tab.cursorColumn || 1),
      is_dirty: Boolean(tab.isDirty)
    };
  });
}

function getExpandedFoldersPayload() {
  return Array.from(appState.expandedFolders || [])
    .map(normalizePath)
    .filter(Boolean);
}

function applyExpandedFolders(savedSession) {
  const folders = normalizeExpandedFolders(savedSession?.expanded_folders);

  if (!folders.length) {
    return;
  }

  appState.expandedFolders = new Set(folders);
}

async function restoreTabsFromSession(savedSession, { renderApp } = {}) {
  const tabs = normalizeSessionTabs(savedSession?.open_tabs);
  const activeFilePath = normalizeOptionalPath(savedSession?.active_file_path);

  if (!tabs.length && !activeFilePath) {
    return;
  }

  const tabsToRestore = [...tabs];

  if (
    activeFilePath &&
    !tabsToRestore.some((tab) => tab.path === activeFilePath)
  ) {
    tabsToRestore.push({
      path: activeFilePath,
      cursorLine: 1,
      cursorColumn: 1,
      isDirty: false
    });
  }

  let restoredCount = 0;

  for (const tab of tabsToRestore) {
    try {
      const content = await readFile(tab.path);

      setActiveFile({
        path: tab.path,
        content
      });

      updateCursorPosition({
        line: tab.cursorLine,
        column: tab.cursorColumn
      });

      restoredCount += 1;
    } catch (error) {
      console.warn("No se pudo restaurar tab:", tab.path, error);
    }
  }

  if (!restoredCount) {
    return;
  }

  const activeTab = tabsToRestore.find((tab) => tab.path === activeFilePath) || tabsToRestore[0];

  if (activeTab) {
    setActiveTab(activeTab.path);

    updateCursorPosition({
      line: activeTab.cursorLine,
      column: activeTab.cursorColumn
    });
  }

  renderApp?.();
}

export async function readLayoutPreferences() {
  try {
    return await readUiSession();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function buildUiSessionPayload() {
  return {
    activity_panel: appState.activityPanel,
    topbar_visible: appState.layout.topbarVisible,
    sidebar_visible: appState.layout.sidebarVisible,
    right_panel_visible: appState.layout.rightPanelVisible,
    bottom_panel_visible: appState.layout.bottomPanelVisible,
    sidebar_width: appState.layout.sidebarWidth,
    right_panel_width: appState.layout.rightPanelWidth,
    bottom_panel_height: appState.layout.bottomPanelHeight,
    active_right_panel: appState.layout.activeRightPanel || "ai",
    active_bottom_panel: appState.layout.activeBottomPanel || "terminal",

    project_path: appState.projectPath || null,
    active_file_path: appState.activeFilePath || null,
    open_tabs: getOpenTabsPayload(),
    expanded_folders: getExpandedFoldersPayload()
  };
}

export function persistLayoutPreferences() {
  window.clearTimeout(uiSessionSaveTimer);

  uiSessionSaveTimer = window.setTimeout(async () => {
    try {
      await writeUiSession(buildUiSessionPayload());
    } catch (error) {
      console.error(error);
    }
  }, 120);
}

export async function flushLayoutPreferences() {
  window.clearTimeout(uiSessionSaveTimer);

  try {
    return await writeUiSession(buildUiSessionPayload());
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function applyLayoutPreferences() {
  const savedLayout = await readLayoutPreferences();

  if (!savedLayout) {
    return null;
  }

  if (typeof savedLayout.activity_panel === "string") {
    setActivityPanel(savedLayout.activity_panel);
  }

  if (typeof savedLayout.topbar_visible === "boolean") {
    setTopbarVisible(savedLayout.topbar_visible);
  }

  if (typeof savedLayout.sidebar_visible === "boolean") {
    setSidebarVisible(savedLayout.sidebar_visible);
  }

  if (typeof savedLayout.right_panel_visible === "boolean") {
    setRightPanelVisible(savedLayout.right_panel_visible);
  }

  if (typeof savedLayout.bottom_panel_visible === "boolean") {
    setBottomPanelVisible(savedLayout.bottom_panel_visible);
  }

  if (Number.isFinite(Number(savedLayout.sidebar_width))) {
    setSidebarWidth(Number(savedLayout.sidebar_width));
  }

  if (Number.isFinite(Number(savedLayout.right_panel_width))) {
    setRightPanelWidth(Number(savedLayout.right_panel_width));
  }

  if (Number.isFinite(Number(savedLayout.bottom_panel_height))) {
    setBottomPanelHeight(Number(savedLayout.bottom_panel_height));
  }

  if (typeof savedLayout.active_right_panel === "string") {
    setActiveRightPanel(savedLayout.active_right_panel);
  }

  if (typeof savedLayout.active_bottom_panel === "string") {
    setActiveBottomPanel(savedLayout.active_bottom_panel);
  }

  applyExpandedFolders(savedLayout);

  return savedLayout;
}

export async function restoreWorkspaceSession(
  savedSession,
  {
    renderApp,
    openProjectForSessionRestore
  } = {}
) {
  if (!savedSession) {
    return false;
  }

  const projectPath = normalizeOptionalPath(savedSession.project_path);

  if (!projectPath || typeof openProjectForSessionRestore !== "function") {
    return false;
  }

  try {
    const projectOpened = await openProjectForSessionRestore(projectPath, {
      renderApp: null
    });

    if (!projectOpened) {
      return false;
    }

    applyExpandedFolders(savedSession);

    await restoreTabsFromSession(savedSession, {
      renderApp
    });

    persistLayoutPreferences();

    return true;
  } catch (error) {
    console.error("No se pudo restaurar la sesión del workspace:", error);
    return false;
  }
}