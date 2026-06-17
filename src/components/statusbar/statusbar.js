// src/components/statusbar/statusbar.js
import { openUrl } from "@tauri-apps/plugin-opener";
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";

let statusbarEventsBound = false;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRelativePath() {
  if (!appState.activeFilePath) {
    return t("Sin archivo activo", "No active file");
  }

  if (!appState.projectPath) {
    return appState.activeFilePath;
  }

  return appState.activeFilePath.replace(`${appState.projectPath}/`, "");
}

function getProjectLabel() {
  return appState.projectName || t("Sin proyecto", "No project");
}

function getDirtyLabel() {
  return appState.isDirty ? t("Modificado", "Modified") : t("Guardado", "Saved");
}

function getDirtyIcon() {
  return appState.isDirty ? "circle-alert" : "check-circle-2";
}

function getDirtyClassName() {
  return appState.isDirty ? "is-dirty" : "is-saved";
}

function getCursorLabel() {
  return `${t("Ln", "Ln")} ${appState.cursorLine}, ${t("Col", "Col")} ${appState.cursorColumn}`;
}

function getLiveServerState() {
  return appState.liveServer || {
    isLoading: false,
    running: false,
    host: "127.0.0.1",
    port: 4587,
    url: null,
    root: null
  };
}

function getLiveServerHost() {
  const liveServer = getLiveServerState();

  return liveServer.host || "127.0.0.1";
}

function getLiveServerPort() {
  const liveServer = getLiveServerState();

  return liveServer.port || 4587;
}

function getLiveServerUrl() {
  const liveServer = getLiveServerState();

  if (liveServer.url) {
    return liveServer.url;
  }

  return `http://${getLiveServerHost()}:${getLiveServerPort()}`;
}

function getLiveServerLabel() {
  const liveServer = getLiveServerState();

  if (liveServer.isLoading) {
    return t("Iniciando Live Server", "Starting Live Server");
  }

  if (liveServer.running) {
    return getLiveServerUrl();
  }

  return t("Live Server apagado", "Live Server stopped");
}

function getLiveServerTitle() {
  const liveServer = getLiveServerState();

  if (liveServer.running) {
    return `${t("Live Server activo", "Live Server running")}: ${getLiveServerUrl()}. ${t("Click para abrir en el navegador", "Click to open in browser")}.`;
  }

  return `${t("Live Server detenido", "Live Server stopped")}. ${t("URL configurada", "Configured URL")}: ${getLiveServerUrl()}`;
}

function getLiveServerIcon() {
  const liveServer = getLiveServerState();

  if (liveServer.isLoading) {
    return "loader-circle";
  }

  if (liveServer.running) {
    return "radio-tower";
  }

  return "server";
}

function getLiveServerClassName() {
  const liveServer = getLiveServerState();

  if (liveServer.isLoading) {
    return "is-loading";
  }

  if (liveServer.running) {
    return "is-running";
  }

  return "is-stopped";
}

function isValidHttpUrl(url) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

async function openExternalUrl(url) {
  if (!isValidHttpUrl(url)) {
    return false;
  }

  try {
    await openUrl(url);
    return true;
  } catch (error) {
    console.warn("No se pudo abrir la URL con @tauri-apps/plugin-opener:", error);
  }

  try {
    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

    if (openedWindow) {
      openedWindow.opener = null;
      return true;
    }
  } catch (error) {
    console.warn("No se pudo abrir la URL con window.open:", error);
  }

  try {
    await navigator.clipboard?.writeText?.(url);
    console.warn("No se pudo abrir el navegador. La URL fue copiada al portapapeles:", url);
  } catch {
    return false;
  }

  return false;
}

async function openLiveServerUrl() {
  const liveServer = getLiveServerState();

  if (!liveServer.running || liveServer.isLoading) {
    return;
  }

  const url = getLiveServerUrl();

  await openExternalUrl(url);
}

function handleStatusbarClick(event) {
  const liveServerButton = event.target.closest?.("#status-live-server");

  if (!liveServerButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  openLiveServerUrl();
}

function handleStatusbarKeydown(event) {
  const liveServerButton = event.target.closest?.("#status-live-server");

  if (!liveServerButton) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  openLiveServerUrl();
}

function bindStatusbarEvents() {
  if (statusbarEventsBound) {
    return;
  }

  statusbarEventsBound = true;

  document.addEventListener("click", handleStatusbarClick);
  document.addEventListener("keydown", handleStatusbarKeydown);
}

export function renderStatusbar() {
  const projectLabel = getProjectLabel();
  const relativePath = getRelativePath();
  const dirtyLabel = getDirtyLabel();
  const dirtyIcon = getDirtyIcon();
  const dirtyClassName = getDirtyClassName();
  const liveServerLabel = getLiveServerLabel();
  const liveServerIcon = getLiveServerIcon();
  const liveServerClassName = getLiveServerClassName();
  const liveServerTitle = getLiveServerTitle();
  const liveServer = getLiveServerState();
  const liveServerTabIndex = liveServer.running && !liveServer.isLoading ? "0" : "-1";
  const liveServerRole = liveServer.running && !liveServer.isLoading ? "button" : "status";

  bindStatusbarEvents();

  return `
    <footer class="au-statusbar" id="statusbar">
      <div class="au-statusbar__left">
        <span
          class="au-statusbar__item au-statusbar__project"
          id="status-project"
          title="${escapeHTML(appState.projectPath || "")}"
        >
          <i data-lucide="folder-code"></i>
          <span>${escapeHTML(projectLabel)}</span>
        </span>

        <span
          class="au-statusbar__item au-statusbar__file"
          id="status-file"
          title="${escapeHTML(appState.activeFilePath || "")}"
        >
          <i data-lucide="file-code-2"></i>
          <span>${escapeHTML(relativePath)}</span>
        </span>
      </div>

      <div class="au-statusbar__right">
        <span
          class="au-statusbar__item au-statusbar__state ${dirtyClassName}"
          id="status-dirty"
          title="${escapeHTML(dirtyLabel)}"
        >
          <i data-lucide="${dirtyIcon}"></i>
          <span>${escapeHTML(dirtyLabel)}</span>
        </span>

        <span
          class="au-statusbar__item au-statusbar__cursor"
          id="status-cursor"
          title="${t("Posición del cursor", "Cursor position")}"
        >
          <i data-lucide="crosshair"></i>
          <span>${escapeHTML(getCursorLabel())}</span>
        </span>

        <span
          class="au-statusbar__item au-statusbar__language"
          id="status-language"
          title="${t("Lenguaje activo", "Active language")}"
        >
          <i data-lucide="braces"></i>
          <span>${escapeHTML(appState.activeLanguage)}</span>
        </span>

        <span
          class="au-statusbar__item au-statusbar__live-server ${liveServerClassName}"
          id="status-live-server"
          title="${escapeHTML(liveServerTitle)}"
          role="${liveServerRole}"
          tabindex="${liveServerTabIndex}"
          data-live-server-url="${escapeHTML(getLiveServerUrl())}"
        >
          <i data-lucide="${liveServerIcon}"></i>
          <span>${escapeHTML(liveServerLabel)}</span>
        </span>

        <span
          class="au-statusbar__item au-statusbar__version"
          title="${t("Versión de Aurelius IDE", "Aurelius IDE version")}"
        >
          <i data-lucide="sparkles"></i>
          <span>Aurelius v0.1</span>
        </span>
      </div>
    </footer>
  `;
}

export function updateStatusbar() {
  bindStatusbarEvents();

  const project = document.getElementById("status-project");
  const file = document.getElementById("status-file");
  const dirty = document.getElementById("status-dirty");
  const cursor = document.getElementById("status-cursor");
  const language = document.getElementById("status-language");
  const liveServer = document.getElementById("status-live-server");

  if (project) {
    const projectText = project.querySelector("span");

    if (projectText) {
      projectText.textContent = getProjectLabel();
    }

    project.title = appState.projectPath || "";
  }

  if (file) {
    const fileText = file.querySelector("span");

    if (fileText) {
      fileText.textContent = getRelativePath();
    }

    file.title = appState.activeFilePath || "";
  }

  if (dirty) {
    const dirtyText = dirty.querySelector("span");
    const dirtyIconElement = dirty.querySelector("i");

    if (dirtyText) {
      dirtyText.textContent = getDirtyLabel();
    }

    if (dirtyIconElement) {
      dirtyIconElement.setAttribute("data-lucide", getDirtyIcon());
    }

    dirty.title = getDirtyLabel();
    dirty.classList.toggle("is-dirty", appState.isDirty);
    dirty.classList.toggle("is-saved", !appState.isDirty);
  }

  if (cursor) {
    const cursorText = cursor.querySelector("span");

    if (cursorText) {
      cursorText.textContent = getCursorLabel();
    }

    cursor.title = t("Posición del cursor", "Cursor position");
  }

  if (language) {
    const languageText = language.querySelector("span");

    if (languageText) {
      languageText.textContent = appState.activeLanguage;
    }

    language.title = t("Lenguaje activo", "Active language");
  }

  if (liveServer) {
    const liveServerText = liveServer.querySelector("span");
    const liveServerIconElement = liveServer.querySelector("i");
    const liveServerState = getLiveServerState();
    const liveServerClassName = getLiveServerClassName();
    const liveServerIsClickable = liveServerState.running && !liveServerState.isLoading;

    if (liveServerText) {
      liveServerText.textContent = getLiveServerLabel();
    }

    if (liveServerIconElement) {
      liveServerIconElement.setAttribute("data-lucide", getLiveServerIcon());
    }

    liveServer.title = getLiveServerTitle();
    liveServer.dataset.liveServerUrl = getLiveServerUrl();
    liveServer.setAttribute("role", liveServerIsClickable ? "button" : "status");
    liveServer.setAttribute("tabindex", liveServerIsClickable ? "0" : "-1");

    liveServer.classList.toggle("is-loading", liveServerClassName === "is-loading");
    liveServer.classList.toggle("is-running", liveServerClassName === "is-running");
    liveServer.classList.toggle("is-stopped", liveServerClassName === "is-stopped");
  }

  window.lucide?.createIcons?.();
}