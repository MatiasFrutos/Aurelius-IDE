// src/components/topbar/topbar.js
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isPanelActive(panel) {
  return appState.activityPanel === panel;
}

function getSidebarTitle() {
  return appState.layout.sidebarVisible
    ? t("Ocultar Explorer", "Hide Explorer")
    : t("Mostrar Explorer", "Show Explorer");
}

function getRightPanelTitle() {
  return appState.layout.rightPanelVisible
    ? t("Ocultar IA lateral", "Hide side AI")
    : t("Mostrar IA lateral", "Show side AI");
}

function getBottomPanelTitle() {
  return appState.layout.bottomPanelVisible
    ? t("Ocultar terminal", "Hide terminal")
    : t("Mostrar terminal", "Show terminal");
}

function getTopbarSearchValue() {
  return appState.search?.query ? escapeHTML(appState.search.query) : "";
}

function renderMenuButton({ panel, label }) {
  return `
    <button
      class="au-topbar__menu-item ${isPanelActive(panel) ? "is-active" : ""}"
      type="button"
      data-activity-panel="${panel}"
    >
      ${label}
    </button>
  `;
}

function renderTopbarSearch() {
  return `
    <form
      class="au-topbar__search"
      id="topbar-search-form"
      autocomplete="off"
      role="search"
      aria-label="${t("Buscar en el proyecto", "Search in project")}"
    >
      <span class="au-topbar__search-icon" aria-hidden="true">
        <i data-lucide="search"></i>
      </span>

      <input
        class="au-topbar__search-input"
        id="topbar-search-input"
        type="search"
        name="query"
        value="${getTopbarSearchValue()}"
        placeholder="${t("Buscar archivos o contenido...", "Search files or content...")}"
        aria-label="${t("Buscar archivos o contenido", "Search files or content")}"
        spellcheck="false"
      />

      <button
        class="au-topbar__search-submit"
        type="submit"
        title="${t("Buscar", "Search")}"
        aria-label="${t("Buscar", "Search")}"
      >
        <i data-lucide="search-check"></i>
      </button>
    </form>
  `;
}

export function renderTopbar() {
  return `
    <header class="au-topbar">
      <div class="au-topbar__brand">
        <span class="au-topbar__logo" aria-hidden="true">
          <i data-lucide="code-2"></i>
        </span>

        <span class="au-topbar__brand-copy">
          <strong>Aurelius</strong>
          <small>IDE</small>
        </span>
      </div>

      <nav class="au-topbar__menu" aria-label="${t("Menú principal", "Main menu")}">
        <button class="au-topbar__menu-item" type="button" id="open-project-btn">
          ${t("Archivo", "File")}
        </button>

        ${renderMenuButton({
          panel: "explorer",
          label: "Explorer"
        })}

        ${renderMenuButton({
          panel: "search",
          label: t("Buscar", "Search")
        })}

        ${renderMenuButton({
          panel: "git",
          label: "Git"
        })}

        ${renderMenuButton({
          panel: "tasks",
          label: "Tasks"
        })}

        ${renderMenuButton({
          panel: "toolchain",
          label: "Doctor"
        })}

        ${renderMenuButton({
          panel: "ai",
          label: t("IA", "AI")
        })}
      </nav>

      ${renderTopbarSearch()}

      <div class="au-topbar__actions">
        <button
          class="au-topbar__action ${appState.layout.sidebarVisible ? "is-active" : ""}"
          type="button"
          id="toggle-sidebar-btn"
          title="${getSidebarTitle()}"
          aria-label="${getSidebarTitle()}"
        >
          <i data-lucide="panel-left"></i>
        </button>

        <button
          class="au-topbar__action ${appState.layout.bottomPanelVisible ? "is-active" : ""}"
          type="button"
          id="toggle-bottom-panel-btn"
          title="${getBottomPanelTitle()}"
          aria-label="${getBottomPanelTitle()}"
        >
          <i data-lucide="terminal"></i>
        </button>

        <button
          class="au-topbar__action ${appState.layout.rightPanelVisible ? "is-active" : ""}"
          type="button"
          id="toggle-right-panel-btn"
          title="${getRightPanelTitle()}"
          aria-label="${getRightPanelTitle()}"
        >
          <i data-lucide="bot"></i>
        </button>

        <button
          class="au-topbar__action ${isPanelActive("settings") ? "is-active" : ""}"
          type="button"
          title="${t("Ajustes", "Settings")}"
          aria-label="${t("Ajustes", "Settings")}"
          data-activity-panel="settings"
        >
          <i data-lucide="settings"></i>
        </button>
      </div>
    </header>
  `;
}