// src/components/git/git-panel.js
import { appState } from "../../app/state.js";
import { t } from "../../app/i18n.js";

import {
  gitStatusProject,
  gitRefreshProject
} from "../../services/git.service.js";

const gitState = {
  loading: false,
  loaded: false,
  error: null,
  data: null
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodePath(path) {
  return encodeURIComponent(path || "");
}

function normalizePath(path = "") {
  return String(path || "").replaceAll("\\", "/");
}

function joinPath(root, filePath) {
  const safeRoot = normalizePath(root).replace(/\/+$/g, "");
  const safeFilePath = normalizePath(filePath).replace(/^\/+/g, "");

  if (!safeRoot) {
    return safeFilePath;
  }

  if (normalizePath(filePath).startsWith("/")) {
    return normalizePath(filePath);
  }

  return `${safeRoot}/${safeFilePath}`;
}

function getGitFileAbsolutePath(file) {
  const root = gitState.data?.root || appState.projectPath || "";

  return joinPath(root, file?.path || "");
}

function getStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();

  const labels = {
    modified: t("Modificado", "Modified"),
    added: t("Agregado", "Added"),
    deleted: t("Eliminado", "Deleted"),
    renamed: t("Renombrado", "Renamed"),
    untracked: t("Nuevo", "New"),
    conflict: t("Conflicto", "Conflict"),
    staged: "Staged",
    copied: t("Copiado", "Copied"),
    changed: t("Cambio", "Change"),
    unknown: t("Cambio", "Change")
  };

  return labels[normalized] || t("Cambio", "Change");
}

function getStatusIcon(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "added" || normalized === "untracked") {
    return "file-plus-2";
  }

  if (normalized === "deleted") {
    return "trash-2";
  }

  if (normalized === "renamed") {
    return "pencil";
  }

  if (normalized === "conflict") {
    return "triangle-alert";
  }

  if (normalized === "staged") {
    return "check-circle-2";
  }

  if (normalized === "copied") {
    return "copy";
  }

  return "file-text";
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "added" || normalized === "untracked") {
    return "is-added";
  }

  if (normalized === "deleted") {
    return "is-deleted";
  }

  if (normalized === "renamed") {
    return "is-renamed";
  }

  if (normalized === "conflict") {
    return "is-conflict";
  }

  if (normalized === "staged") {
    return "is-staged";
  }

  if (normalized === "copied") {
    return "is-copied";
  }

  return "is-modified";
}

function getFileName(path) {
  return normalizePath(path).split("/").filter(Boolean).pop() || path || t("Archivo", "File");
}

function getFileDirectory(path) {
  const parts = normalizePath(path).split("/").filter(Boolean);

  if (parts.length <= 1) {
    return "";
  }

  parts.pop();

  return parts.join("/");
}

function getRepoHealth(data) {
  if (!data?.is_repo && !data?.isRepo) {
    return {
      label: t("Sin repo", "No repo"),
      className: "is-neutral",
      icon: "git-branch"
    };
  }

  const files = Array.isArray(data.files) ? data.files : [];
  const changes = files.length;
  const conflicts = files.filter((file) => String(file.status || "").toLowerCase() === "conflict").length;

  if (conflicts > 0) {
    return {
      label: t("Conflictos", "Conflicts"),
      className: "is-conflict",
      icon: "triangle-alert"
    };
  }

  if (changes > 0) {
    return {
      label: t("Cambios", "Changes"),
      className: "is-dirty",
      icon: "git-compare"
    };
  }

  return {
    label: t("Limpio", "Clean"),
    className: "is-clean",
    icon: "check-circle-2"
  };
}

function getBranchLabel(branch) {
  return branch || t("sin-rama", "no-branch");
}

function getUpstreamLabel(upstream) {
  return upstream || t("sin upstream", "no upstream");
}

function getUnknownErrorLabel() {
  return t("Error desconocido.", "Unknown error.");
}

function getNoGitMessage() {
  return t(
    "La carpeta abierta no tiene repositorio Git inicializado.",
    "The opened folder does not have an initialized Git repository."
  );
}

function getChangesCount() {
  return gitState.data?.files?.length || 0;
}

function isRepo(data) {
  return Boolean(data?.is_repo || data?.isRepo);
}

function renderGitEmpty() {
  return `
    <div class="au-git-empty">
      <span class="au-git-empty__icon">
        <i data-lucide="git-branch"></i>
      </span>

      <small>Source Control</small>
      <strong>${escapeHTML(t("Sin proyecto abierto", "No open project"))}</strong>

      <p>
        ${escapeHTML(t(
          "Abrí un proyecto para ver estado Git, cambios pendientes, rama activa y últimos commits.",
          "Open a project to see Git status, pending changes, active branch and latest commits."
        ))}
      </p>
    </div>
  `;
}

function renderGitLoading() {
  return `
    <div class="au-git-empty">
      <span class="au-git-empty__icon is-loading">
        <i data-lucide="refresh-cw"></i>
      </span>

      <small>Git status</small>
      <strong>${escapeHTML(t("Consultando repositorio", "Reading repository"))}</strong>

      <p>
        ${escapeHTML(t(
          "Aurelius está leyendo rama, cambios, ahead/behind y últimos commits.",
          "Aurelius is reading branch, changes, ahead/behind and latest commits."
        ))}
      </p>
    </div>
  `;
}

function renderGitError() {
  return `
    <div class="au-git-empty is-error">
      <span class="au-git-empty__icon">
        <i data-lucide="circle-alert"></i>
      </span>

      <small>Error</small>
      <strong>${escapeHTML(t("No se pudo leer Git", "Could not read Git"))}</strong>

      <p>${escapeHTML(gitState.error || getUnknownErrorLabel())}</p>

      <small class="au-git-empty__tip">
        ${escapeHTML(t("Usá el botón de refrescar del header para reintentar.", "Use the refresh button in the header to retry."))}
      </small>
    </div>
  `;
}

function renderGitNotRepo(message) {
  return `
    <div class="au-git-empty">
      <span class="au-git-empty__icon">
        <i data-lucide="git-branch"></i>
      </span>

      <small>${escapeHTML(t("Git no inicializado", "Git not initialized"))}</small>
      <strong>${escapeHTML(t("No es un repositorio Git", "Not a Git repository"))}</strong>

      <p>${escapeHTML(message || getNoGitMessage())}</p>

      <small class="au-git-empty__tip">
        ${escapeHTML(t("Tip: corré", "Tip: run"))}
        <code>git init</code>
        ${escapeHTML(t(
          "en la terminal para versionar este proyecto.",
          "in the terminal to version this project."
        ))}
      </small>
    </div>
  `;
}

function renderGitSummary(data) {
  const branch = getBranchLabel(data.branch);
  const upstream = getUpstreamLabel(data.upstream);
  const fileCount = Array.isArray(data.files) ? data.files.length : 0;
  const commitCount = Array.isArray(data.commits) ? data.commits.length : 0;
  const ahead = Number(data.ahead || 0);
  const behind = Number(data.behind || 0);
  const health = getRepoHealth(data);

  return `
    <section class="au-git-summary">
      <div class="au-git-summary__hero ${health.className}">
        <span class="au-git-summary__icon">
          <i data-lucide="${escapeHTML(health.icon)}"></i>
        </span>

        <div class="au-git-summary__copy">
          <span>${escapeHTML(t("Branch actual", "Current branch"))}</span>
          <strong title="${escapeHTML(branch)}">${escapeHTML(branch)}</strong>
          <small title="${escapeHTML(upstream)}">${escapeHTML(upstream)}</small>
        </div>

        <span class="au-git-summary__state" title="${escapeHTML(health.label)}">
          ${escapeHTML(health.label)}
        </span>
      </div>

      <div class="au-git-summary__stats">
        <span title="${escapeHTML(t("Cambios pendientes", "Pending changes"))}">
          <strong>${fileCount}</strong>
          <small>${escapeHTML(t("Cambios", "Changes"))}</small>
        </span>

        <span title="${escapeHTML(t("Commits locales por subir", "Local commits to push"))}">
          <strong>${ahead}</strong>
          <small>Ahead</small>
        </span>

        <span title="${escapeHTML(t("Commits remotos pendientes", "Pending remote commits"))}">
          <strong>${behind}</strong>
          <small>Behind</small>
        </span>

        <span title="${escapeHTML(t("Commits cargados", "Loaded commits"))}">
          <strong>${commitCount}</strong>
          <small>Commits</small>
        </span>
      </div>
    </section>
  `;
}

function renderGitFiles(files = []) {
  if (!files.length) {
    return `
      <section class="au-git-section">
        <div class="au-git-section__head">
          <span>
            <i data-lucide="file-text"></i>
            ${escapeHTML(t("Cambios", "Changes"))}
          </span>
          <small>0</small>
        </div>

        <div class="au-git-section__empty">
          <i data-lucide="check-circle-2"></i>
          <span>${escapeHTML(t(
            "Working tree limpio. No hay cambios pendientes.",
            "Clean working tree. No pending changes."
          ))}</span>
        </div>
      </section>
    `;
  }

  return `
    <section class="au-git-section">
      <div class="au-git-section__head">
        <span>
          <i data-lucide="file-text"></i>
          ${escapeHTML(t("Cambios", "Changes"))}
        </span>
        <small>${files.length}</small>
      </div>

      <div class="au-git-files">
        ${files
          .map((file) => {
            const absolutePath = getGitFileAbsolutePath(file);
            const directory = getFileDirectory(file.path);
            const fileName = getFileName(file.path);
            const statusClass = getStatusClass(file.status);
            const statusLabel = getStatusLabel(file.status);
            const statusIcon = getStatusIcon(file.status);
            const encodedPath = encodePath(absolutePath);
            const originalPath = file.original_path || file.originalPath || "";
            const encodedOriginalPath = encodePath(originalPath);
            const isDeleted = String(file.status || "").toLowerCase() === "deleted";

            return `
              <button
                class="au-git-file ${statusClass} ${isDeleted ? "is-not-openable" : ""}"
                type="button"
                data-git-file-path="${encodedPath}"
                data-git-file-original-path="${encodedOriginalPath}"
                data-git-file-status="${escapeHTML(file.status || "")}"
                title="${escapeHTML(isDeleted ? t("Archivo eliminado", "Deleted file") : absolutePath)}"
                ${isDeleted ? "disabled" : ""}
              >
                <span class="au-git-file__icon">
                  <i data-lucide="${escapeHTML(statusIcon)}"></i>
                </span>

                <span class="au-git-file__content">
                  <strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong>
                  ${
                    directory
                      ? `<small title="${escapeHTML(directory)}">${escapeHTML(directory)}</small>`
                      : `<small>${escapeHTML(t("Raíz del repositorio", "Repository root"))}</small>`
                  }
                  ${
                    originalPath
                      ? `<em title="${escapeHTML(originalPath)}">${escapeHTML(t("Antes", "Before"))}: ${escapeHTML(originalPath)}</em>`
                      : ""
                  }
                </span>

                <span class="au-git-file__status" title="${escapeHTML(statusLabel)}">
                  ${escapeHTML(statusLabel)}
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderGitCommits(commits = []) {
  if (!commits.length) {
    return `
      <section class="au-git-section">
        <div class="au-git-section__head">
          <span>
            <i data-lucide="history"></i>
            ${escapeHTML(t("Últimos commits", "Latest commits"))}
          </span>
          <small>0</small>
        </div>

        <div class="au-git-section__empty">
          <i data-lucide="history"></i>
          <span>${escapeHTML(t("No hay commits para mostrar.", "No commits to show."))}</span>
        </div>
      </section>
    `;
  }

  return `
    <section class="au-git-section">
      <div class="au-git-section__head">
        <span>
          <i data-lucide="history"></i>
          ${escapeHTML(t("Últimos commits", "Latest commits"))}
        </span>
        <small>${commits.length}</small>
      </div>

      <div class="au-git-commits">
        ${commits
          .map((commit) => {
            const commitMessage = commit.message || t("Commit sin mensaje", "Commit without message");

            return `
              <article class="au-git-commit">
                <code title="${escapeHTML(commit.hash || "")}">${escapeHTML(commit.hash || "")}</code>
                <span title="${escapeHTML(commitMessage)}">
                  ${escapeHTML(commitMessage)}
                </span>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderGitContent() {
  if (!appState.projectPath) {
    return renderGitEmpty();
  }

  if (gitState.loading) {
    return renderGitLoading();
  }

  if (gitState.error) {
    return renderGitError();
  }

  if (!gitState.loaded || !gitState.data) {
    return renderGitEmpty();
  }

  if (!isRepo(gitState.data)) {
    return renderGitNotRepo(gitState.data.message);
  }

  return `
    ${renderGitSummary(gitState.data)}
    ${renderGitFiles(gitState.data.files || [])}
    ${renderGitCommits(gitState.data.commits || [])}
  `;
}

function renderGitHeaderActions() {
  const health = getRepoHealth(gitState.data);
  const changesCount = getChangesCount();

  return `
    <span class="au-git-panel__badge ${health.className}" title="${escapeHTML(t("Cambios pendientes", "Pending changes"))}">
      ${changesCount}
    </span>

    <button
      class="au-git-panel__action ${gitState.loading ? "is-loading" : ""}"
      type="button"
      id="git-refresh-btn"
      title="${escapeHTML(t("Refrescar Git", "Refresh Git"))}"
      aria-label="${escapeHTML(t("Refrescar Git", "Refresh Git"))}"
      ${gitState.loading ? "disabled" : ""}
    >
      <i data-lucide="refresh-cw"></i>
    </button>
  `;
}

export function renderGitPanel() {
  return `
    <section class="au-git-panel">
      <header class="au-git-panel__header">
        <div>
          <span>
            <i data-lucide="git-branch"></i>
            <span>Source Control</span>
          </span>

          <strong>Git</strong>
        </div>

        <div class="au-git-panel__actions" id="git-panel-actions">
          ${renderGitHeaderActions()}
        </div>
      </header>

      <div class="au-git-panel__body" id="git-panel-body">
        ${renderGitContent()}
      </div>
    </section>
  `;
}

export async function loadGitStatus() {
  if (!appState.projectPath) {
    gitState.loading = false;
    gitState.loaded = false;
    gitState.error = null;
    gitState.data = null;
    updateGitPanelDOM();
    return;
  }

  try {
    gitState.loading = true;
    gitState.loaded = false;
    gitState.error = null;

    updateGitPanelDOM();

    const data = await gitStatusProject(appState.projectPath);

    gitState.loading = false;
    gitState.loaded = true;
    gitState.error = null;
    gitState.data = data;

    updateGitPanelDOM();
  } catch (error) {
    gitState.loading = false;
    gitState.loaded = true;
    gitState.error = typeof error === "string"
      ? error
      : error?.message || t("No se pudo consultar Git.", "Could not query Git.");
    gitState.data = null;

    updateGitPanelDOM();
  }
}

export async function refreshGitStatus() {
  if (!appState.projectPath) {
    return loadGitStatus();
  }

  try {
    gitState.loading = true;
    gitState.error = null;

    updateGitPanelDOM();

    const data = await gitRefreshProject(appState.projectPath);

    gitState.loading = false;
    gitState.loaded = true;
    gitState.error = null;
    gitState.data = data;

    updateGitPanelDOM();
  } catch (error) {
    gitState.loading = false;
    gitState.loaded = true;
    gitState.error = typeof error === "string"
      ? error
      : error?.message || t("No se pudo refrescar Git.", "Could not refresh Git.");

    updateGitPanelDOM();
  }
}

function updateGitPanelDOM() {
  const body = document.getElementById("git-panel-body");
  const actions = document.getElementById("git-panel-actions");

  if (body) {
    body.innerHTML = renderGitContent();
  }

  if (actions) {
    actions.innerHTML = renderGitHeaderActions();
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}