// src/components/context-menu/context-menu.js
import { t } from "../../app/i18n.js";

let cleanupTimer = null;
let activeActions = [];

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMenuRoot() {
  return document.getElementById("aurelius-context-menu-root");
}

function getMenuElement() {
  return document.querySelector("#aurelius-context-menu-root .au-context-menu");
}

function clampPosition(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSafeActions(actions = []) {
  return Array.isArray(actions)
    ? actions.filter((action) => action && typeof action === "object")
    : [];
}

function getActionIcon(action) {
  if (action.danger) {
    return action.icon || "trash-2";
  }

  return action.icon || "circle";
}

function getActionClass(action) {
  return [
    "au-context-menu__item",
    action.danger ? "is-danger" : "",
    action.disabled ? "is-disabled" : "",
    action.separatorBefore ? "has-separator-before" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function getShortcutHTML(shortcut) {
  if (!shortcut) {
    return "";
  }

  return `
    <span class="au-context-menu__shortcut" aria-hidden="true">
      ${String(shortcut)
        .split("+")
        .map((key) => `<kbd>${escapeHTML(key.trim())}</kbd>`)
        .join("")}
    </span>
  `;
}

function getActionButton(action) {
  const disabled = Boolean(action.disabled);
  const icon = getActionIcon(action);

  return `
    <button
      class="${getActionClass(action)}"
      type="button"
      role="menuitem"
      data-context-action-id="${escapeHTML(action.id)}"
      aria-disabled="${disabled ? "true" : "false"}"
      ${disabled ? "disabled" : ""}
    >
      <span class="au-context-menu__item-icon" aria-hidden="true">
        <i data-lucide="${escapeHTML(icon)}"></i>
      </span>

      <span class="au-context-menu__item-copy">
        <strong>${escapeHTML(action.label)}</strong>
        ${action.description ? `<small>${escapeHTML(action.description)}</small>` : ""}
      </span>

      ${getShortcutHTML(action.shortcut)}
    </button>
  `;
}

function getVisibleMenuButtons() {
  const menu = getMenuElement();

  if (!menu) {
    return [];
  }

  return Array.from(menu.querySelectorAll("[data-context-action-id]:not(:disabled)"));
}

function focusMenuItem(index) {
  const buttons = getVisibleMenuButtons();

  if (!buttons.length) {
    return;
  }

  const safeIndex = clampPosition(index, 0, buttons.length - 1);
  buttons[safeIndex]?.focus();
}

function getFocusedMenuItemIndex() {
  const buttons = getVisibleMenuButtons();

  return buttons.findIndex((button) => button === document.activeElement);
}

function removeOutsideListeners() {
  window.clearTimeout(cleanupTimer);

  document.removeEventListener("pointerdown", handleOutsidePointer, true);
  document.removeEventListener("scroll", hideContextMenu, true);
  document.removeEventListener("keydown", handleGlobalKeydown, true);

  window.removeEventListener("resize", hideContextMenu);
  window.removeEventListener("blur", hideContextMenu);
}

function scheduleOutsideListeners() {
  window.clearTimeout(cleanupTimer);

  cleanupTimer = window.setTimeout(() => {
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    document.addEventListener("scroll", hideContextMenu, true);
    document.addEventListener("keydown", handleGlobalKeydown, true);

    window.addEventListener("resize", hideContextMenu);
    window.addEventListener("blur", hideContextMenu);
  }, 0);
}

function removeMenu({ animated = false } = {}) {
  const root = getMenuRoot();

  if (!root) {
    return;
  }

  const menu = getMenuElement();

  if (!animated || !menu) {
    root.remove();
    return;
  }

  menu.classList.add("is-leaving");

  window.setTimeout(() => {
    root.remove();
  }, 110);
}

function hardResetMenu() {
  removeOutsideListeners();
  activeActions = [];

  removeMenu({
    animated: false
  });
}

function runAction(actionId) {
  const action = activeActions.find((item) => item.id === actionId);

  if (!action || action.disabled) {
    return;
  }

  hideContextMenu();

  window.setTimeout(() => {
    action.run?.();
  }, 0);
}

function handleOutsidePointer(event) {
  const menu = getMenuElement();

  if (menu?.contains(event.target)) {
    return;
  }

  hideContextMenu();
}

function handleGlobalKeydown(event) {
  const menu = getMenuElement();

  if (!menu) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    hideContextMenu();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();

    const currentIndex = getFocusedMenuItemIndex();
    const buttons = getVisibleMenuButtons();

    if (!buttons.length) {
      return;
    }

    focusMenuItem(currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    const currentIndex = getFocusedMenuItemIndex();
    const buttons = getVisibleMenuButtons();

    if (!buttons.length) {
      return;
    }

    focusMenuItem(
      currentIndex < 0
        ? buttons.length - 1
        : (currentIndex - 1 + buttons.length) % buttons.length
    );
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    focusMenuItem(0);
    return;
  }

  if (event.key === "End") {
    event.preventDefault();

    const buttons = getVisibleMenuButtons();
    focusMenuItem(buttons.length - 1);
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    const button = document.activeElement?.closest?.("[data-context-action-id]");

    if (!button || !menu.contains(button)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    runAction(button.dataset.contextActionId);
  }
}

function getViewportScale() {
  const rawScale = Number(
    document.documentElement.dataset.effectiveUiScale ||
      getComputedStyle(document.documentElement).getPropertyValue("--au-ui-scale") ||
      1
  );

  if (!Number.isFinite(rawScale)) {
    return 1;
  }

  return Math.min(1.25, Math.max(0.65, rawScale));
}

function positionMenu(menu, x, y) {
  const viewportPadding = 10;
  const scale = getViewportScale();

  menu.style.left = "0px";
  menu.style.top = "0px";

  const rect = menu.getBoundingClientRect();
  const visualWidth = rect.width;
  const visualHeight = rect.height;

  const safeX = clampPosition(
    Number(x) || 0,
    viewportPadding,
    Math.max(viewportPadding, window.innerWidth - visualWidth - viewportPadding)
  );

  const safeY = clampPosition(
    Number(y) || 0,
    viewportPadding,
    Math.max(viewportPadding, window.innerHeight - visualHeight - viewportPadding)
  );

  menu.style.left = `${safeX}px`;
  menu.style.top = `${safeY}px`;
  menu.style.setProperty("--au-context-menu-scale", String(scale));
}

export function hideContextMenu() {
  removeOutsideListeners();
  activeActions = [];

  removeMenu({
    animated: true
  });
}

export function showContextMenu({
  x,
  y,
  title,
  subtitle,
  actions = []
}) {
  hardResetMenu();

  const safeActions = getSafeActions(actions);
  activeActions = safeActions;

  const root = document.createElement("div");

  root.id = "aurelius-context-menu-root";
  root.className = "au-context-menu-root";

  root.innerHTML = `
    <div
      class="au-context-menu"
      role="menu"
      aria-label="${escapeHTML(title || t("Menú de Aurelius", "Aurelius menu"))}"
    >
      <div class="au-context-menu__header">
        <span class="au-context-menu__badge" aria-hidden="true">
          <i data-lucide="mouse-pointer-2"></i>
        </span>

        <span class="au-context-menu__header-copy">
          <strong>${escapeHTML(title || "Aurelius IDE")}</strong>
          ${
            subtitle
              ? `<small>${escapeHTML(subtitle)}</small>`
              : `<small>${escapeHTML(t("Acciones rápidas", "Quick actions"))}</small>`
          }
        </span>
      </div>

      <div class="au-context-menu__list">
        ${
          safeActions.length
            ? safeActions.map(getActionButton).join("")
            : `
              <div class="au-context-menu__empty">
                <i data-lucide="info"></i>
                <span>${escapeHTML(t("No hay acciones disponibles", "No actions available"))}</span>
              </div>
            `
        }
      </div>

      <div class="au-context-menu__footer">
        <span>
          <i data-lucide="keyboard"></i>
          ${escapeHTML(t("Esc para cerrar", "Esc to close"))}
        </span>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const menu = root.querySelector(".au-context-menu");

  if (menu) {
    positionMenu(menu, x, y);
  }

  root.querySelectorAll("[data-context-action-id]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      runAction(button.dataset.contextActionId);
    });
  });

  window.lucide?.createIcons?.();

  queueMicrotask(() => {
    menu?.classList.add("is-visible");
  });

  scheduleOutsideListeners();
}