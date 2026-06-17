// src/components/quick-open/quick-open.js
import { t } from "../../app/i18n.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFileIcon(fileName = "") {
  const lowerName = String(fileName || "").toLowerCase();

  if (lowerName.endsWith(".js") || lowerName.endsWith(".ts")) {
    return "file-code";
  }

  if (lowerName.endsWith(".json")) {
    return "braces";
  }

  if (lowerName.endsWith(".md")) {
    return "notebook-text";
  }

  if (lowerName.endsWith(".rs")) {
    return "cpu";
  }

  if (lowerName.endsWith(".css")) {
    return "palette";
  }

  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
    return "file-code-2";
  }

  if (lowerName.endsWith(".toml") || lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) {
    return "settings-2";
  }

  return "file";
}

function getShortPath(path = "", projectPath = "") {
  const normalizedPath = String(path || "").replaceAll("\\", "/");
  const normalizedProjectPath = String(projectPath || "").replaceAll("\\", "/");

  if (normalizedProjectPath && normalizedPath.startsWith(`${normalizedProjectPath}/`)) {
    return normalizedPath.slice(normalizedProjectPath.length + 1);
  }

  return normalizedPath;
}

function getDefaultProjectName(projectName) {
  return projectName || t("Sin proyecto", "No project");
}

function getFileFallbackName() {
  return t("archivo", "file");
}

function getSearchPlaceholder(projectName) {
  return `${t("Buscar archivo en", "Search file in")} ${projectName}...`;
}

export function flattenQuickOpenFiles(nodes = [], projectPath = "") {
  const files = [];

  function walk(items = []) {
    for (const node of items) {
      if (!node) {
        continue;
      }

      if (node.is_dir) {
        walk(node.children || []);
        continue;
      }

      const shortPath = getShortPath(node.path, projectPath);
      const name = node.name || shortPath.split("/").pop() || getFileFallbackName();

      files.push({
        name,
        path: node.path,
        shortPath,
        icon: getFileIcon(node.name || node.path)
      });
    }
  }

  walk(nodes);

  return files;
}

export function filterQuickOpenItems(items = [], query = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (!normalizedQuery) {
    return items.slice(0, 80);
  }

  return items
    .map((item) => {
      const name = String(item.name || "").toLowerCase();
      const shortPath = String(item.shortPath || "").toLowerCase();

      let score = 0;

      if (name === normalizedQuery) {
        score += 100;
      }

      if (name.startsWith(normalizedQuery)) {
        score += 80;
      }

      if (name.includes(normalizedQuery)) {
        score += 55;
      }

      if (shortPath.includes(normalizedQuery)) {
        score += 35;
      }

      const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

      if (queryParts.length && queryParts.every((part) => shortPath.includes(part))) {
        score += 25;
      }

      return {
        ...item,
        score
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.shortPath.localeCompare(b.shortPath))
    .slice(0, 80);
}

export function renderQuickOpen({
  isOpen,
  query,
  items,
  activeIndex = 0,
  projectName = ""
}) {
  if (!isOpen) {
    return "";
  }

  const safeItems = Array.isArray(items) ? items : [];
  const safeProjectName = getDefaultProjectName(projectName);
  const safeActiveIndex = Math.max(0, Math.min(activeIndex, safeItems.length - 1));

  return `
    <div class="au-quick-open-root">
      <div class="au-quick-open-backdrop" data-quick-open-close></div>

      <section
        class="au-quick-open"
        role="dialog"
        aria-modal="true"
        aria-label="Quick Open"
      >
        <header class="au-quick-open__header">
          <span class="au-quick-open__icon">
            <i data-lucide="search"></i>
          </span>

          <div class="au-quick-open__input-wrap">
            <input
              id="quick-open-input"
              type="text"
              value="${escapeHTML(query)}"
              placeholder="${escapeHTML(getSearchPlaceholder(safeProjectName))}"
              autocomplete="off"
              spellcheck="false"
              aria-label="${escapeHTML(t("Buscar archivo", "Search file"))}"
            />

            <span class="au-quick-open__hint">
              Ctrl P
            </span>
          </div>

          <button
            class="au-quick-open__close"
            type="button"
            data-quick-open-close
            title="${escapeHTML(t("Cerrar", "Close"))}"
            aria-label="${escapeHTML(t("Cerrar Quick Open", "Close Quick Open"))}"
          >
            <i data-lucide="x"></i>
          </button>
        </header>

        <main class="au-quick-open__body">
          ${
            safeItems.length
              ? `
                <div
                  class="au-quick-open__list"
                  role="listbox"
                  aria-label="${escapeHTML(t("Archivos encontrados", "Found files"))}"
                >
                  ${safeItems
                    .map((item, index) => {
                      const isActive = index === safeActiveIndex;
                      const itemPath = String(item.path || "");
                      const itemName = String(item.name || getFileFallbackName());
                      const itemShortPath = String(item.shortPath || item.path || "");

                      return `
                        <button
                          class="au-quick-open__item ${isActive ? "is-active" : ""}"
                          type="button"
                          role="option"
                          aria-selected="${isActive ? "true" : "false"}"
                          data-quick-open-index="${index}"
                          data-quick-open-path="${encodeURIComponent(itemPath)}"
                          title="${escapeHTML(itemPath)}"
                        >
                          <span class="au-quick-open__item-icon">
                            <i data-lucide="${escapeHTML(item.icon || "file")}"></i>
                          </span>

                          <span class="au-quick-open__item-copy">
                            <strong title="${escapeHTML(itemName)}">${escapeHTML(itemName)}</strong>
                            <small title="${escapeHTML(itemShortPath)}">${escapeHTML(itemShortPath)}</small>
                          </span>
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              `
              : `
                <div class="au-quick-open__empty">
                  <span>
                    <i data-lucide="search"></i>
                  </span>

                  <strong>${escapeHTML(t("Sin archivos", "No files"))}</strong>
                  <p>${escapeHTML(t("No hay coincidencias para la búsqueda actual.", "No matches for the current search."))}</p>
                </div>
              `
          }
        </main>

        <footer class="au-quick-open__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> ${escapeHTML(t("navegar", "navigate"))}</span>
          <span><kbd>Enter</kbd> ${escapeHTML(t("abrir", "open"))}</span>
          <span><kbd>Esc</kbd> ${escapeHTML(t("cerrar", "close"))}</span>
        </footer>
      </section>
    </div>
  `;
}