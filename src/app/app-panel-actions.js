// src/app/app-panel-actions.js
import {
  appState,
  setActivityPanel,
  setTopbarVisible,
  toggleTopbarVisible,
  toggleSidebarVisible,
  setRightPanelVisible,
  toggleRightPanelVisible,
  toggleBottomPanelVisible
} from "./state.js";

import { t } from "./i18n.js";
import { persistLayoutPreferences } from "./app-session.js";
import { refreshMonitorSnapshot } from "./app-monitor.js";
import { loadProjectTasks, loadToolchainDoctor } from "./app-project-tools.js";

import {
  loadGitStatus
} from "../components/git/git-panel.js";

import {
  toastSuccess,
  toastInfo
} from "../components/ui/toast.js";

const SIDEBAR_ACTIVITY_PANELS = [
  "explorer",
  "search",
  "git",
  "monitor",
  "tasks",
  "toolchain"
];

function isSidebarActivityPanel(panel) {
  return SIDEBAR_ACTIVITY_PANELS.includes(panel);
}

function openSidebarPanel(panel) {
  setActivityPanel(panel);

  if (!appState.layout.sidebarVisible) {
    toggleSidebarVisible();
  }

  persistLayoutPreferences();
}

function closeSidebarPanel() {
  if (appState.layout.sidebarVisible) {
    toggleSidebarVisible();
  }

  persistLayoutPreferences();
}

function shouldCloseSidebarPanel(panel) {
  return (
    isSidebarActivityPanel(panel) &&
    appState.activityPanel === panel &&
    appState.layout.sidebarVisible
  );
}

function runSidebarPanelEffect(panel, { renderApp }) {
  if (panel === "git") {
    queueMicrotask(() => {
      loadGitStatus();
    });

    return;
  }

  if (panel === "monitor") {
    queueMicrotask(() => {
      refreshMonitorSnapshot({
        renderApp,
        silent: true
      });
    });

    return;
  }

  if (panel === "tasks") {
    queueMicrotask(() => {
      loadProjectTasks({
        renderApp,
        silent: true
      });
    });

    return;
  }

  if (panel === "toolchain") {
    queueMicrotask(() => {
      loadToolchainDoctor({
        renderApp,
        silent: true
      });
    });
  }
}

export function createPanelActions({ renderApp }) {
  async function handleActivityPanel(panel) {
    if (!panel) {
      return;
    }

    if (shouldCloseSidebarPanel(panel)) {
      closeSidebarPanel();
      renderApp();
      return;
    }

    if (isSidebarActivityPanel(panel)) {
      openSidebarPanel(panel);
      renderApp();
      runSidebarPanelEffect(panel, { renderApp });
      return;
    }

    if (panel === "ai") {
      const shouldCloseRightPanel = appState.layout.rightPanelVisible;

      setRightPanelVisible(!shouldCloseRightPanel);
      persistLayoutPreferences();
      renderApp();

      if (!shouldCloseRightPanel) {
        toastInfo(
          t("Chat IA abierto en el panel derecho.", "AI chat opened in the right panel."),
          "Aurelius AI"
        );
      }

      return;
    }

    if (panel === "settings") {
      const isAlreadySettings = appState.activityPanel === "settings";

      setActivityPanel(isAlreadySettings ? "explorer" : "settings");
      persistLayoutPreferences();
      renderApp();

      if (!isAlreadySettings) {
        toastInfo(
          t("Página de ajustes abierta.", "Settings page opened."),
          "Settings"
        );
      }
    }
  }

  function handleOpenGitPanel() {
    if (shouldCloseSidebarPanel("git")) {
      closeSidebarPanel();
      renderApp();
      return;
    }

    openSidebarPanel("git");
    renderApp();

    queueMicrotask(() => {
      loadGitStatus();
    });
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
      !isSidebarActivityPanel(appState.activityPanel)
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

  function handleSetTopbarVisible(isVisible) {
    setTopbarVisible(Boolean(isVisible));
    persistLayoutPreferences();
    renderApp();
  }

  return {
    handleActivityPanel,
    handleOpenGitPanel,
    handleToggleTopbar,
    handleToggleSidebar,
    handleToggleRightPanel,
    handleToggleBottomPanel,
    handleSetTopbarVisible
  };
}