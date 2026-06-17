// src/app/app-render.js
import { appState } from "./state.js";
import { encodePath } from "./app-utils.js";
import { t } from "./i18n.js";

import { renderTopbar } from "../components/topbar/topbar.js";
import { renderActivityBar } from "../components/activity-bar/activity-bar.js";
import { renderExplorer } from "../components/explorer/explorer.js";
import { renderSearchPanel } from "../components/search/search-panel.js";
import { renderGitPanel } from "../components/git/git-panel.js";
import { renderMonitorPanel } from "../components/monitor/monitor-panel.js";
import { renderTasksPanel } from "../components/project-tools/tasks-panel.js";
import { renderToolchainPanel } from "../components/toolchain/toolchain-panel.js";
import { renderRightAiPanel } from "../components/right-panel/right-ai-panel.js";
import { renderBottomPanel } from "../components/bottom-panel/bottom-panel.js";
import { renderSettingsPanel } from "../components/settings/settings-panel.js";
import { renderCommandPalette } from "../components/command-palette/command-palette.js";
import { renderQuickOpen } from "../components/quick-open/quick-open.js";

import {
  renderEditorShell,
  renderEmptyEditor
} from "../components/editor/editor.js";

import { renderStatusbar } from "../components/statusbar/statusbar.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderTabs() {
  if (!appState.openTabs.length) {
    return "";
  }

  return appState.openTabs
    .map((tab) => {
      const safePath = encodePath(tab.path);
      const isActive = tab.path === appState.activeFilePath;

      return `
        <div class="aurelius-tab ${isActive ? "is-active" : ""}">
          <button class="aurelius-tab__button" data-tab-path="${safePath}" title="${escapeHTML(tab.path)}">
            <span>${escapeHTML(tab.name)}</span>
            ${tab.isDirty ? `<i class="aurelius-tab__dirty"></i>` : ""}
          </button>

          <button
            class="aurelius-tab__close"
            data-close-tab-path="${safePath}"
            title="${escapeHTML(t("Cerrar tab", "Close tab"))}"
            aria-label="${escapeHTML(t("Cerrar tab", "Close tab"))}"
          >
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
    })
    .join("");
}

export function renderSidePanel() {
  if (appState.activityPanel === "search") {
    return renderSearchPanel();
  }

  if (appState.activityPanel === "git") {
    return renderGitPanel();
  }

  if (appState.activityPanel === "monitor") {
    return renderMonitorPanel();
  }

  if (appState.activityPanel === "tasks") {
    return renderTasksPanel();
  }

  if (appState.activityPanel === "toolchain") {
    return renderToolchainPanel();
  }

  return renderExplorer({
    projectName: appState.projectName,
    fileTree: appState.fileTree,
    openTabs: appState.openTabs,
    activeFilePath: appState.activeFilePath
  });
}

export function renderWorkspace() {
  if (appState.activityPanel === "settings") {
    return `
      <section class="aurelius-workspace is-page">
        <div class="aurelius-page-area">
          ${renderSettingsPanel()}
        </div>
      </section>
    `;
  }

  return `
    <section class="aurelius-workspace">
      <div class="aurelius-tabs" id="editor-tabs">
        ${renderTabs()}
      </div>

      <div class="aurelius-editor-area" id="editor-area">
        ${appState.activeFilePath ? renderEditorShell() : renderEmptyEditor()}
      </div>
    </section>
  `;
}

export function renderCenterArea() {
  return `
    <section class="aurelius-center-area">
      <div class="aurelius-center-area__workspace">
        ${renderWorkspace()}
      </div>

      ${
        appState.layout.bottomPanelVisible
          ? `
            <div class="aurelius-center-area__bottom">
              ${renderBottomPanel()}
            </div>
          `
          : ""
      }
    </section>
  `;
}

export function renderRightPanel() {
  if (!appState.layout.rightPanelVisible) {
    return "";
  }

  return `
    <aside class="aurelius-right-panel">
      <div
        class="aurelius-resizer aurelius-resizer--right"
        data-resize-panel="right"
        title="${escapeHTML(t("Redimensionar IA", "Resize AI"))}"
      ></div>

      ${renderRightAiPanel()}
    </aside>
  `;
}

export function getLayoutStyle() {
  const sidebarWidth = appState.layout.sidebarVisible ? appState.layout.sidebarWidth : 0;
  const rightPanelWidth = appState.layout.rightPanelVisible ? appState.layout.rightPanelWidth : 0;
  const bottomPanelHeight = appState.layout.bottomPanelVisible ? appState.layout.bottomPanelHeight : 0;

  return [
    `--au-effective-sidebar-width: ${sidebarWidth}px`,
    `--au-effective-right-panel-width: ${rightPanelWidth}px`,
    `--au-effective-bottom-panel-height: ${bottomPanelHeight}px`
  ].join(";");
}

export function renderAppShell({
  commandPaletteOpen,
  commandPaletteQuery,
  commandPaletteActiveIndex,
  commandActions,
  quickOpenOpen,
  quickOpenQuery,
  quickOpenItems,
  quickOpenActiveIndex
}) {
  const layoutClasses = [
    appState.layout.topbarVisible ? "has-topbar" : "is-topbar-hidden",
    appState.layout.sidebarVisible ? "has-sidebar" : "is-sidebar-hidden",
    appState.layout.rightPanelVisible ? "has-right-panel" : "is-right-panel-hidden",
    appState.layout.bottomPanelVisible ? "has-bottom-panel" : "is-bottom-panel-hidden"
  ].join(" ");

  return `
    <div class="aurelius-shell ${appState.layout.topbarVisible ? "has-topbar" : "is-topbar-hidden"}">
      ${appState.layout.topbarVisible ? renderTopbar() : ""}

      <main class="aurelius-main ${layoutClasses}" style="${getLayoutStyle()}">
        ${renderActivityBar()}

        ${
          appState.layout.sidebarVisible
            ? `
              <aside class="aurelius-side-panel">
                ${renderSidePanel()}

                <div
                  class="aurelius-resizer aurelius-resizer--sidebar"
                  data-resize-panel="sidebar"
                  title="${escapeHTML(t("Redimensionar Explorer", "Resize Explorer"))}"
                ></div>
              </aside>
            `
            : ""
        }

        ${renderCenterArea()}
        ${renderRightPanel()}
      </main>

      ${renderStatusbar()}

      ${renderCommandPalette({
        isOpen: commandPaletteOpen,
        query: commandPaletteQuery,
        actions: commandActions,
        activeIndex: commandPaletteActiveIndex
      })}

      ${renderQuickOpen({
        isOpen: quickOpenOpen,
        query: quickOpenQuery,
        items: quickOpenItems,
        activeIndex: quickOpenActiveIndex,
        projectName: appState.projectName
      })}
    </div>
  `;
}