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
      title="${escapeHTML(label)}"
      aria-label="${escapeHTML(label)}"
    >
      ${escapeHTML(label)}
    </button>
  `;
}

function renderTopbarSearch() {
  return `
    <div class="au-topbar__search-wrap">
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
    </div>
  `;
}

let windowControlsBound = false;

function bindWindowControls() {
  if (windowControlsBound) {
    return;
  }

  windowControlsBound = true;

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-window-action]");

    if (!button) {
      return;
    }

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      const action = button.dataset.windowAction;

      if (action === "minimize") {
        await appWindow.minimize();
      } else if (action === "maximize") {
        await appWindow.toggleMaximize();
      } else if (action === "close") {
        await appWindow.close();
      }
    } catch (error) {
      console.error(error);
    }
  });
}

export function renderTopbar() {
  bindWindowControls();

  return `
    <header class="au-topbar" data-tauri-drag-region>
      <div class="au-topbar__brand" data-tauri-drag-region>
        <span class="au-topbar__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.7 3.6h2.6L19.6 20.4h-2.7L12 7.7 7.1 20.4H4.4L10.7 3.6Z" fill="currentColor" stroke="none"/>
            <path d="M8.9 14.2h6.2l.8 2.2H8.1l.8-2.2Z" fill="rgb(var(--au-accent-rgb))" stroke="none"/>
          </svg>
        </span>

        <span class="au-topbar__brand-copy" data-tauri-drag-region>
          <strong>Aurelius</strong>
          <small>IDE</small>
        </span>
      </div>

      <nav class="au-topbar__menu" aria-label="${t("Menú principal", "Main menu")}">
        <button
          class="au-topbar__menu-item"
          type="button"
          id="open-project-btn"
          title="${t("Abrir proyecto", "Open project")}"
          aria-label="${t("Abrir proyecto", "Open project")}"
        >
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
          panel: "toolbox",
          label: "Toolbox"
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

      <div class="au-window-controls" aria-label="${t("Controles de ventana", "Window controls")}">
        <button type="button" class="au-window-controls__btn" data-window-action="minimize" title="${t("Minimizar", "Minimize")}" aria-label="${t("Minimizar", "Minimize")}">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg>
        </button>
        <button type="button" class="au-window-controls__btn" data-window-action="maximize" title="${t("Maximizar", "Maximize")}" aria-label="${t("Maximizar", "Maximize")}">
          <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1" /></svg>
        </button>
        <button type="button" class="au-window-controls__btn is-close" data-window-action="close" title="${t("Cerrar", "Close")}" aria-label="${t("Cerrar", "Close")}">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
        </button>
      </div>
    </header>
  `;
}