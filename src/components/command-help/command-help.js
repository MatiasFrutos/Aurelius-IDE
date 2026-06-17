// src/components/command-help/command-help.js
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

function getCommandText(command) {
  return [
    command.title,
    command.description,
    command.group,
    command.shortcut,
    ...(command.keywords || [])
  ]
    .filter(Boolean)
    .join(" ");
}

function getFilteredCommands(actions = [], query = "") {
  const cleanQuery = normalizeText(query).trim();
  const safeActions = Array.isArray(actions) ? actions : [];

  if (!cleanQuery) {
    return safeActions;
  }

  return safeActions.filter((action) => {
    return normalizeText(getCommandText(action)).includes(cleanQuery);
  });
}

function groupCommands(commands = []) {
  return commands.reduce((groups, command) => {
    const groupName = command.group || t("General", "General");

    if (!groups[groupName]) {
      groups[groupName] = [];
    }

    groups[groupName].push(command);

    return groups;
  }, {});
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

  const parts = String(shortcut)
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  return `
    <span class="au-command-help__shortcut" aria-label="${escapeHTML(shortcut)}">
      ${parts
        .map((part) => `<kbd>${escapeHTML(normalizeShortcutKey(part))}</kbd>`)
        .join("")}
    </span>
  `;
}

function renderCommand(command) {
  const icon = command.icon || "circle";
  const disabled = command.disabled ? "disabled" : "";
  const disabledClass = command.disabled ? "is-disabled" : "";
  const title = command.title || t("Comando", "Command");
  const description = command.description || t("Sin descripción disponible.", "No description available.");

  return `
    <button
      class="au-command-help__command ${disabledClass}"
      type="button"
      data-command-help-action-id="${escapeHTML(command.id)}"
      title="${escapeHTML(title)}"
      ${disabled}
    >
      <span class="au-command-help__command-icon">
        <i data-lucide="${escapeHTML(icon)}"></i>
      </span>

      <span class="au-command-help__command-copy">
        <strong title="${escapeHTML(title)}">${escapeHTML(title)}</strong>
        <small title="${escapeHTML(description)}">${escapeHTML(description)}</small>
      </span>

      ${renderShortcut(command.shortcut)}
    </button>
  `;
}

function renderCommandGroups(commands = []) {
  const groups = groupCommands(commands);
  const groupEntries = Object.entries(groups);

  if (!groupEntries.length) {
    return `
      <div class="au-command-help__empty">
        <i data-lucide="search-check"></i>
        <strong>${escapeHTML(t("No hay comandos para esa búsqueda", "No commands found for that search"))}</strong>
        <span>${escapeHTML(t("Probá con otra palabra clave.", "Try another keyword."))}</span>
      </div>
    `;
  }

  return groupEntries
    .map(([groupName, groupCommandsList]) => {
      return `
        <section class="au-command-help__group">
          <header class="au-command-help__group-header">
            <span title="${escapeHTML(groupName)}">${escapeHTML(groupName)}</span>
            <small>${groupCommandsList.length}</small>
          </header>

          <div class="au-command-help__commands">
            ${groupCommandsList.map(renderCommand).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderExtraShortcut(shortcut) {
  const label = shortcut.label || t("Atajo", "Shortcut");
  const description = shortcut.description || "";

  return `
    <article class="au-command-help__shortcut-card">
      <span class="au-command-help__shortcut-card-icon">
        <i data-lucide="${escapeHTML(shortcut.icon || "keyboard")}"></i>
      </span>

      <span class="au-command-help__shortcut-card-copy">
        <strong title="${escapeHTML(label)}">${escapeHTML(label)}</strong>
        ${description ? `<small title="${escapeHTML(description)}">${escapeHTML(description)}</small>` : ""}
      </span>

      ${renderShortcut(shortcut.shortcut)}
    </article>
  `;
}

function renderExtraShortcuts(shortcuts = []) {
  if (!Array.isArray(shortcuts) || !shortcuts.length) {
    return "";
  }

  return `
    <section class="au-command-help__quick">
      <header class="au-command-help__section-title">
        <span>${escapeHTML(t("Atajos base", "Base shortcuts"))}</span>
        <small>${escapeHTML(t("Referencia rápida", "Quick reference"))}</small>
      </header>

      <div class="au-command-help__shortcut-grid">
        ${shortcuts.map(renderExtraShortcut).join("")}
      </div>
    </section>
  `;
}

function renderCommandHelpBody({ query = "", actions = [], shortcuts = [] } = {}) {
  const filteredCommands = getFilteredCommands(actions, query);

  return `
    ${renderExtraShortcuts(shortcuts)}
    ${renderCommandGroups(filteredCommands)}
  `;
}

function getCounterLabel(filteredCommands, actions) {
  const total = Array.isArray(actions) ? actions.length : 0;

  return `${filteredCommands.length} / ${total}`;
}

export function renderCommandHelp({
  isOpen = false,
  query = "",
  actions = [],
  shortcuts = []
} = {}) {
  if (!isOpen) {
    return "";
  }

  const filteredCommands = getFilteredCommands(actions, query);

  return `
    <div class="au-command-help-root" role="presentation">
      <div class="au-command-help__backdrop" data-command-help-close></div>

      <section
        class="au-command-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-help-title"
      >
        <header class="au-command-help__hero">
          <div class="au-command-help__hero-icon">
            <i data-lucide="keyboard"></i>
          </div>

          <div class="au-command-help__hero-copy">
            <span class="au-command-help__eyebrow">Aurelius IDE</span>

            <h2 id="command-help-title" title="${escapeHTML(t("Comandos de Aurelius", "Aurelius Commands"))}">
              ${escapeHTML(t("Comandos de Aurelius", "Aurelius Commands"))}
            </h2>

            <p>
              ${escapeHTML(
                t(
                  "Buscá acciones, atajos y módulos disponibles. También podés ejecutar comandos desde esta ventana.",
                  "Search available actions, shortcuts and modules. You can also run commands from this window."
                )
              )}
            </p>
          </div>

          <button
            class="au-command-help__close"
            type="button"
            title="${escapeHTML(t("Cerrar", "Close"))}"
            aria-label="${escapeHTML(t("Cerrar ayuda de comandos", "Close command help"))}"
            data-command-help-close
          >
            <i data-lucide="x"></i>
          </button>
        </header>

        <div class="au-command-help__toolbar">
          <label class="au-command-help__search">
            <i data-lucide="search"></i>

            <input
              id="command-help-input"
              type="search"
              value="${escapeHTML(query)}"
              placeholder="${escapeHTML(t("Buscar comando, módulo o atajo...", "Search command, module or shortcut..."))}"
              autocomplete="off"
              spellcheck="false"
              aria-label="${escapeHTML(t("Buscar comando", "Search command"))}"
            />
          </label>

          <span class="au-command-help__counter" id="command-help-counter">
            ${escapeHTML(getCounterLabel(filteredCommands, actions))}
          </span>
        </div>

        <div class="au-command-help__body" id="command-help-body">
          ${renderCommandHelpBody({ query, actions, shortcuts })}
        </div>

        <footer class="au-command-help__footer">
          <span>
            <i data-lucide="badge-info"></i>
            ${escapeHTML(t("Ctrl + K abre esta referencia.", "Ctrl + K opens this reference."))}
          </span>

          <span>
            <i data-lucide="sparkles"></i>
            ${escapeHTML(t("Ctrl + Shift + P abre la Command Palette.", "Ctrl + Shift + P opens the Command Palette."))}
          </span>
        </footer>
      </section>
    </div>
  `;
}

export function updateCommandHelpResults({
  query = "",
  actions = [],
  shortcuts = [],
  onExecute
} = {}) {
  const body = document.getElementById("command-help-body");
  const counter = document.getElementById("command-help-counter");

  if (!body) {
    return;
  }

  const filteredCommands = getFilteredCommands(actions, query);

  body.innerHTML = renderCommandHelpBody({
    query,
    actions,
    shortcuts
  });

  if (counter) {
    counter.textContent = getCounterLabel(filteredCommands, actions);
  }

  body.querySelectorAll("[data-command-help-action-id]").forEach((button) => {
    button.addEventListener("click", () => {
      onExecute?.(button.dataset.commandHelpActionId);
    });
  });

  window.lucide?.createIcons?.();
}