// src/components/search/search-panel.js
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

function encodePath(path) {
  return encodeURIComponent(path || "");
}

function normalizeProjectName(projectName) {
  const value = String(projectName || "").trim();

  if (!value || value === "Sin proyecto" || value === "No project") {
    return t("Sin proyecto", "No project");
  }

  return value;
}

function getSearchQuery() {
  return String(appState.search?.query || "");
}

function getSearchResults() {
  return Array.isArray(appState.search?.results) ? appState.search.results : [];
}

function getSearchState() {
  const query = getSearchQuery();
  const results = getSearchResults();

  if (!appState.projectPath) {
    return {
      icon: "folder-open",
      title: t("Sin proyecto abierto", "No open project"),
      description: t(
        "Abrí una carpeta para buscar archivos y contenido dentro del workspace.",
        "Open a folder to search files and content inside the workspace."
      )
    };
  }

  if (appState.search.isLoading) {
    return {
      icon: "loader-circle",
      title: t("Buscando en el proyecto", "Searching in project"),
      description: t(
        "Aurelius está escaneando archivos, rutas y coincidencias de contenido.",
        "Aurelius is scanning files, paths and content matches."
      )
    };
  }

  if (!query.trim()) {
    return {
      icon: "search",
      title: t("Esperando consulta", "Waiting for query"),
      description: t(
        "Escribí al menos 2 caracteres para buscar por nombre de archivo o contenido.",
        "Type at least 2 characters to search by file name or content."
      )
    };
  }

  if (!results.length) {
    return {
      icon: "file-question",
      title: t("Sin resultados", "No results"),
      description: t(
        `No se encontraron coincidencias para “${query}”.`,
        `No matches found for “${query}”.`
      )
    };
  }

  return null;
}

function getMatchIcon(matchKind = "") {
  const normalized = String(matchKind).toLowerCase();

  if (
    normalized.includes("nombre") ||
    normalized.includes("name") ||
    normalized.includes("ruta") ||
    normalized.includes("path")
  ) {
    return "file-search";
  }

  if (normalized.includes("contenido") || normalized.includes("content")) {
    return "text-search";
  }

  return "search-check";
}

function getResultLineLabel(result) {
  if (Number(result.line_number) > 0) {
    return `L${result.line_number}`;
  }

  return t("Ruta", "Path");
}

function getResultsLabel(count) {
  if (count === 1) {
    return t("1 resultado", "1 result");
  }

  return `${count} ${t("resultados", "results")}`;
}

function getMatchKindLabel(matchKind = "") {
  const normalized = String(matchKind || "").toLowerCase();

  if (normalized.includes("nombre") || normalized.includes("name")) {
    return t("Nombre", "Name");
  }

  if (normalized.includes("ruta") || normalized.includes("path")) {
    return t("Ruta", "Path");
  }

  if (normalized.includes("contenido") || normalized.includes("content")) {
    return t("Contenido", "Content");
  }

  return matchKind || t("Coincidencia", "Match");
}

function getFileNameFromPath(path = "") {
  return String(path || "").split("/").filter(Boolean).pop() || path;
}

function groupResultsByPath(results = []) {
  const groups = new Map();

  results.forEach((result) => {
    const key = result.path || result.name || "unknown";

    if (!groups.has(key)) {
      groups.set(key, {
        path: result.path || "",
        name: result.name || getFileNameFromPath(result.path),
        results: []
      });
    }

    groups.get(key).results.push(result);
  });

  return Array.from(groups.values());
}

function renderEmptyState() {
  const state = getSearchState();

  if (!state) {
    return "";
  }

  return `
    <div class="au-search__empty ${appState.search.isLoading ? "is-loading" : ""}">
      <span class="au-search__empty-icon">
        <i data-lucide="${escapeHTML(state.icon)}"></i>
      </span>

      <strong>${escapeHTML(state.title)}</strong>

      <p>${escapeHTML(state.description)}</p>
    </div>
  `;
}

function renderResultItem(result, index = 0) {
  const lineLabel = getResultLineLabel(result);
  const matchIcon = getMatchIcon(result.match_kind);
  const matchKindLabel = getMatchKindLabel(result.match_kind);
  const path = String(result.path || "");
  const fileName = result.name || getFileNameFromPath(path);
  const lineText = String(result.line_text || "");
  const hasLineText = Boolean(lineText.trim()) && lineText.trim() !== path && lineText.trim() !== fileName;

  return `
    <button
      class="au-search__result"
      type="button"
      data-search-file-path="${encodePath(path)}"
      ${Number(result.line_number) > 0 ? `data-search-line-number="${Number(result.line_number)}"` : ""}
      title="${escapeHTML(path)}"
      style="--au-search-result-delay: ${Math.min(index * 12, 180)}ms"
    >
      <span class="au-search__result-icon" aria-hidden="true">
        <i data-lucide="${escapeHTML(matchIcon)}"></i>
      </span>

      <span class="au-search__result-main">
        <span class="au-search__result-name">
          ${escapeHTML(fileName)}
        </span>

        ${
          hasLineText
            ? `
              <span class="au-search__result-preview">
                ${escapeHTML(lineText)}
              </span>
            `
            : `
              <span class="au-search__result-path">
                ${escapeHTML(path)}
              </span>
            `
        }
      </span>

      <span class="au-search__result-meta">
        <em>${escapeHTML(lineLabel)}</em>
        <small>${escapeHTML(matchKindLabel)}</small>
      </span>
    </button>
  `;
}

function renderResults() {
  const emptyState = getSearchState();

  if (emptyState) {
    return renderEmptyState();
  }

  const results = getSearchResults();

  return `
    <div class="au-search__results">
      ${results.map(renderResultItem).join("")}
    </div>
  `;
}

export function renderSearchPanel() {
  const query = getSearchQuery();
  const results = getSearchResults();
  const resultsCount = results.length;
  const groupsCount = groupResultsByPath(results).length;
  const hasQuery = query.trim().length > 0;
  const projectName = normalizeProjectName(appState.projectName);

  return `
    <aside class="au-search-panel">
      <header class="au-search__header">
        <div class="au-search__title">
          <span>
            <i data-lucide="search"></i>
            <span>Search</span>
          </span>

          <strong title="${escapeHTML(t("Buscar en proyecto", "Search in project"))}">
            ${escapeHTML(t("Buscar en proyecto", "Search in project"))}
          </strong>
        </div>

        <div class="au-search__badge" title="${escapeHTML(t("Resultados encontrados", "Results found"))}">
          ${resultsCount}
        </div>
      </header>

      <form class="au-search__form" id="search-project-form">
        <label class="au-search__label" for="project-search-input">
          ${escapeHTML(t("Consulta", "Query"))}
        </label>

        <div class="au-search__control">
          <i data-lucide="search"></i>

          <input
            id="project-search-input"
            type="search"
            placeholder="${escapeHTML(t("Buscar archivo o contenido...", "Search file or content..."))}"
            value="${escapeHTML(query)}"
            autocomplete="off"
            spellcheck="false"
          />

          ${
            hasQuery
              ? `
                <span class="au-search__query-size" title="${escapeHTML(t("Caracteres de búsqueda", "Search characters"))}">
                  ${query.trim().length}
                </span>
              `
              : ""
          }
        </div>

        <button class="au-search__submit" type="submit" ${appState.search.isLoading ? "disabled" : ""}>
          <i data-lucide="${appState.search.isLoading ? "loader-circle" : "scan-search"}"></i>
          <span>${escapeHTML(appState.search.isLoading ? t("Buscando...", "Searching...") : t("Buscar", "Search"))}</span>
        </button>
      </form>

      <section class="au-search__summary">
        <article>
          <span>Workspace</span>
          <strong title="${escapeHTML(projectName)}">${escapeHTML(projectName)}</strong>
        </article>

        <article>
          <span>${escapeHTML(t("Archivos", "Files"))}</span>
          <strong>${groupsCount}</strong>
        </article>

        <article>
          <span>${escapeHTML(t("Coincidencias", "Matches"))}</span>
          <strong>${resultsCount}</strong>
        </article>
      </section>

      <section class="au-search__content">
        <header class="au-search__content-head">
          <div>
            <span>${escapeHTML(t("Resultados", "Results"))}</span>
            <strong>
              ${
                hasQuery
                  ? escapeHTML(getResultsLabel(resultsCount))
                  : escapeHTML(t("Sin consulta activa", "No active query"))
              }
            </strong>
          </div>

          <small>${escapeHTML(appState.search.isLoading ? t("Escaneando...", "Scanning...") : "Ready")}</small>
        </header>

        ${renderResults()}
      </section>
    </aside>
  `;
}