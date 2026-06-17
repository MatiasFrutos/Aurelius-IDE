// src/components/command-palette/command-palette.js
import { t } from "../../app/i18n.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filterCommandActions(actions = [], query = "") {
  const normalizedQuery = normalizeText(query).trim();

  if (!normalizedQuery) {
    return Array.isArray(actions) ? actions : [];
  }

  return (Array.isArray(actions) ? actions : []).filter((action) => {
    const haystack = normalizeText(
      [
        action.title,
        action.description,
        action.group,
        action.shortcut,
        ...(action.keywords || [])
      ]
        .filter(Boolean)
        .join(" ")
    );

    return haystack.includes(normalizedQuery);
  });
}

function normalizeShortcutKey(key) {
  const normalizedKey = String(key || "").trim();

  const labels = {
    ctrl: "Ctrl",
    control: "Ctrl",
    shift: "Shift",
    alt: "Alt",
    option: "Alt",
    meta: "Meta",
    cmd: "Cmd",
    command: "Cmd",
    enter: "Enter",
    escape: "Esc",
    esc: "Esc",
    tab: "Tab",
    space: "Space"
  };

  return labels[normalizedKey.toLowerCase()] || normalizedKey;
}

function renderShortcut(shortcut) {
  if (!shortcut) {
    return "";
  }

  return `
    <span class="au-command-palette__shortcut" aria-label="${escapeHTML(shortcut)}">
      ${String(shortcut)
        .split("+")
        .map((key) => key.trim())
        .filter(Boolean)
        .map((key) => `<kbd>${escapeHTML(normalizeShortcutKey(key))}</kbd>`)
        .join("")}
    </span>
  `;
}

function renderGroupLabel(group) {
  if (!group) {
    return "";
  }

  return `
    <span class="au-command-palette__group" title="${escapeHTML(group)}">
      ${escapeHTML(group)}
    </span>
  `;
}

function getActionIcon(action) {
  return action.icon || "circle";
}

function getResultLabel(count) {
  if (count === 1) {
    return t("1 comando disponible", "1 command available");
  }

  return `${count} ${t("comandos disponibles", "commands available")}`;
}

function getQueryLabel(query) {
  const normalizedQuery = String(query ?? "").trim();

  if (!normalizedQuery) {
    return t(
      "Filtrá por acción, panel, módulo, archivo o atajo.",
      "Filter by action, panel, module, file or shortcut."
    );
  }

  return `${t("Filtro activo", "Active filter")}: “${normalizedQuery}”`;
}

function getUniqueGroupCount(actions = []) {
  const groups = new Set();

  actions.forEach((action) => {
    if (action.group) {
      groups.add(action.group);
    }
  });

  return groups.size;
}

function getEmptyStateTitle() {
  return t("No encontramos ese comando", "We couldn't find that command");
}

function getEmptyStateDescription() {
  return t(
    "Probá buscar por nombre, panel, acción, atajo o palabra clave.",
    "Try searching by name, panel, action, shortcut or keyword."
  );
}

function getStatusLabel(count) {
  return count ? t("Listo", "Ready") : t("Vacío", "Empty");
}

function getSafeActiveIndex(activeIndex, visibleActions) {
  if (!visibleActions.length) {
    return 0;
  }

  return Math.max(0, Math.min(activeIndex, visibleActions.length - 1));
}

function renderCommandPaletteSummary(visibleActions) {
  const groupCount = getUniqueGroupCount(visibleActions);

  return `
    <article>
      <span>${escapeHTML(t("Resultados", "Results"))}</span>
      <strong>${visibleActions.length}</strong>
    </article>

    <article>
      <span>${escapeHTML(t("Grupos", "Groups"))}</span>
      <strong>${groupCount}</strong>
    </article>

    <article>
      <span>${escapeHTML(t("Estado", "Status"))}</span>
      <strong title="${escapeHTML(getStatusLabel(visibleActions.length))}">
        ${escapeHTML(getStatusLabel(visibleActions.length))}
      </strong>
    </article>
  `;
}

function renderCommandPaletteBody(visibleActions, safeActiveIndex) {
  if (!visibleActions.length) {
    return `
      <div class="au-command-palette__empty">
        <span class="au-command-palette__empty-icon">
          <i data-lucide="search-check"></i>
        </span>

        <small>${escapeHTML(t("Sin coincidencias", "No matches"))}</small>
        <strong>${escapeHTML(getEmptyStateTitle())}</strong>
        <p>${escapeHTML(getEmptyStateDescription())}</p>
      </div>
    `;
  }

  return `
    <div
      class="au-command-palette__list"
      role="listbox"
      aria-label="${escapeHTML(t("Comandos disponibles", "Available commands"))}"
    >
      ${visibleActions
        .map((action, index) => {
          const isActive = index === safeActiveIndex;
          const isDisabled = Boolean(action.disabled);
          const title = action.title || t("Comando", "Command");
          const description = action.description || t("Sin descripción disponible.", "No description available.");

          return `
            <button
              class="au-command-palette__item ${isActive ? "is-active" : ""} ${isDisabled ? "is-disabled" : ""}"
              type="button"
              role="option"
              aria-selected="${isActive ? "true" : "false"}"
              data-command-index="${index}"
              data-command-action-id="${escapeHTML(action.id)}"
              title="${escapeHTML(title)}"
              ${isDisabled ? "disabled" : ""}
            >
              <span class="au-command-palette__item-icon" aria-hidden="true">
                <i data-lucide="${escapeHTML(getActionIcon(action))}"></i>
              </span>

              <span class="au-command-palette__item-copy">
                <span class="au-command-palette__item-top">
                  <strong title="${escapeHTML(title)}">${escapeHTML(title)}</strong>
                  ${renderGroupLabel(action.group)}
                </span>

                <small title="${escapeHTML(description)}">${escapeHTML(description)}</small>
              </span>

              ${renderShortcut(action.shortcut)}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCommandPaletteFooter(visibleActions) {
  return `
    <span>${escapeHTML(getResultLabel(visibleActions.length))}</span>

    <div>
      <span><kbd>↑</kbd><kbd>↓</kbd> ${escapeHTML(t("navegar", "navigate"))}</span>
      <span><kbd>Enter</kbd> ${escapeHTML(t("ejecutar", "run"))}</span>
      <span><kbd>Esc</kbd> ${escapeHTML(t("cerrar", "close"))}</span>
    </div>
  `;
}

export function renderCommandPalette({
  isOpen,
  query,
  actions,
  activeIndex = 0
}) {
  if (!isOpen) {
    return "";
  }

  const visibleActions = filterCommandActions(actions, query);
  const safeActiveIndex = getSafeActiveIndex(activeIndex, visibleActions);

  return `
    <div class="au-command-palette-root">
      <div class="au-command-palette-backdrop" data-command-palette-close></div>

      <section
        class="au-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <header class="au-command-palette__header">
          <div class="au-command-palette__brand">
            <span class="au-command-palette__icon" aria-hidden="true">
              <i data-lucide="sparkles"></i>
            </span>

            <span class="au-command-palette__brand-copy">
              <small>Aurelius IDE</small>
              <strong title="Command Center">Command Center</strong>
            </span>
          </div>

          <button
            class="au-command-palette__close"
            type="button"
            data-command-palette-close
            title="${escapeHTML(t("Cerrar", "Close"))}"
            aria-label="${escapeHTML(t("Cerrar command palette", "Close command palette"))}"
          >
            <i data-lucide="x"></i>
          </button>
        </header>

        <section class="au-command-palette__search-row">
          <label class="au-command-palette__search" for="command-palette-input">
            <i data-lucide="search"></i>

            <input
              id="command-palette-input"
              type="text"
              value="${escapeHTML(query)}"
              placeholder="${escapeHTML(t("Buscar comando, panel o acción...", "Search command, panel or action..."))}"
              autocomplete="off"
              spellcheck="false"
              aria-label="${escapeHTML(t("Buscar comando", "Search command"))}"
            />

            <span class="au-command-palette__search-key">
              Ctrl Shift P
            </span>
          </label>

          <span class="au-command-palette__hint" id="command-palette-hint" title="${escapeHTML(getQueryLabel(query))}">
            ${escapeHTML(getQueryLabel(query))}
          </span>
        </section>

        <section
          class="au-command-palette__summary"
          id="command-palette-summary"
          aria-label="${escapeHTML(t("Resumen de comandos", "Command summary"))}"
        >
          ${renderCommandPaletteSummary(visibleActions)}
        </section>

        <main class="au-command-palette__body" id="command-palette-body">
          ${renderCommandPaletteBody(visibleActions, safeActiveIndex)}
        </main>

        <footer class="au-command-palette__footer" id="command-palette-footer">
          ${renderCommandPaletteFooter(visibleActions)}
        </footer>
      </section>
    </div>
  `;
}

export function updateCommandPaletteResults({
  query = "",
  actions = [],
  activeIndex = 0,
  onHover,
  onExecute
} = {}) {
  const visibleActions = filterCommandActions(actions, query);
  const safeActiveIndex = getSafeActiveIndex(activeIndex, visibleActions);
  const queryLabel = getQueryLabel(query);

  const hint = document.getElementById("command-palette-hint");
  const summary = document.getElementById("command-palette-summary");
  const body = document.getElementById("command-palette-body");
  const footer = document.getElementById("command-palette-footer");

  if (hint) {
    hint.textContent = queryLabel;
    hint.title = queryLabel;
  }

  if (summary) {
    summary.innerHTML = renderCommandPaletteSummary(visibleActions);
  }

  if (body) {
    body.innerHTML = renderCommandPaletteBody(visibleActions, safeActiveIndex);
  }

  if (footer) {
    footer.innerHTML = renderCommandPaletteFooter(visibleActions);
  }

  body?.querySelectorAll("[data-command-action-id]").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      const index = Number(button.dataset.commandIndex);

      if (Number.isFinite(index)) {
        onHover?.(index);
      }
    });

    button.addEventListener("click", () => {
      onExecute?.(button.dataset.commandActionId);
    });
  });

  window.lucide?.createIcons?.();
}