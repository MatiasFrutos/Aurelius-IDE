// src/components/ui/modal.js
import { t } from "../../app/i18n.js";

let activeModal = null;
let previousFocusedElement = null;

function ensureModalRoot() {
  let root = document.querySelector(".au-modal-root");

  if (root) {
    return root;
  }

  root = document.createElement("div");
  root.className = "au-modal-root";
  document.body.appendChild(root);

  return root;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(value) {
  const safeValue = String(value ?? "");

  if (window.CSS?.escape) {
    return window.CSS.escape(safeValue);
  }

  return safeValue.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function createSafeId(prefix = "au-modal") {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFocusableElements(modal) {
  return Array.from(
    modal.querySelectorAll(
      [
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "a[href]",
        "[tabindex]:not([tabindex='-1'])"
      ].join(",")
    )
  );
}

function restoreFocus() {
  if (previousFocusedElement && typeof previousFocusedElement.focus === "function") {
    previousFocusedElement.focus();
  }

  previousFocusedElement = null;
}

function removeModalRootIfEmpty() {
  const root = document.querySelector(".au-modal-root");

  if (root && !root.children.length) {
    root.remove();
  }
}

function closeModal(modal, resolve, value) {
  if (!modal || modal.dataset.closing === "true") {
    return;
  }

  modal.dataset.closing = "true";
  modal.classList.remove("is-visible");
  modal.classList.add("is-leaving");

  window.setTimeout(() => {
    modal.remove();

    if (activeModal === modal) {
      activeModal = null;
    }

    removeModalRootIfEmpty();
    restoreFocus();
    resolve(value);
  }, 170);
}

function trapFocus(event, modal) {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getFocusableElements(modal);

  if (!focusableElements.length) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function getModalIcon({ danger = false, variant = "default" } = {}) {
  if (danger) {
    return "triangle-alert";
  }

  const iconMap = {
    default: "sparkles",
    info: "badge-info",
    success: "check-circle-2",
    warning: "triangle-alert",
    danger: "triangle-alert",
    input: "text-cursor-input",
    file: "file-plus-2",
    folder: "folder-plus",
    rename: "pencil",
    delete: "trash-2"
  };

  return iconMap[variant] || iconMap.default;
}

function renderModal({
  title,
  message,
  body,
  confirmText,
  cancelText,
  danger = false,
  variant = "default"
}) {
  const root = ensureModalRoot();

  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }

  previousFocusedElement = document.activeElement;

  const modalId = createSafeId("au-modal-dialog");
  const titleId = `${modalId}-title`;
  const descriptionId = `${modalId}-description`;

  const modal = document.createElement("div");
  modal.className = "au-modal-backdrop";
  modal.dataset.closing = "false";

  modal.innerHTML = `
    <section
      class="au-modal ${danger ? "au-modal--danger" : ""} au-modal--${escapeHTML(variant)}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${escapeHTML(titleId)}"
      ${message ? `aria-describedby="${escapeHTML(descriptionId)}"` : ""}
    >
      <div class="au-modal__glow" aria-hidden="true"></div>

      <header class="au-modal__header">
        <div class="au-modal__title-group">
          <span class="au-modal__icon" aria-hidden="true">
            <i data-lucide="${escapeHTML(getModalIcon({ danger, variant }))}"></i>
          </span>

          <div class="au-modal__copy">
            <strong id="${escapeHTML(titleId)}" title="${escapeHTML(title)}">
              ${escapeHTML(title)}
            </strong>

            ${message ? `<p id="${escapeHTML(descriptionId)}">${escapeHTML(message)}</p>` : ""}
          </div>
        </div>

        <button
          class="au-modal__close"
          type="button"
          data-modal-cancel
          aria-label="${escapeHTML(t("Cerrar", "Close"))}"
          title="${escapeHTML(t("Cerrar", "Close"))}"
        >
          <i data-lucide="x"></i>
        </button>
      </header>

      ${body ? `<div class="au-modal__body">${body}</div>` : ""}

      <footer class="au-modal__footer">
        <button class="au-modal__button" type="button" data-modal-cancel>
          <span>${escapeHTML(cancelText)}</span>
        </button>

        <button
          class="au-modal__button au-modal__button--primary ${danger ? "is-danger" : ""}"
          type="button"
          data-modal-confirm
        >
          <span>${escapeHTML(confirmText)}</span>
        </button>
      </footer>
    </section>
  `;

  root.appendChild(modal);
  activeModal = modal;

  queueMicrotask(() => {
    modal.classList.add("is-visible");

    if (window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
  });

  return modal;
}

export function confirmModal({
  title = t("Confirmar acción", "Confirm action"),
  message = "",
  confirmText = t("Confirmar", "Confirm"),
  cancelText = t("Cancelar", "Cancel"),
  danger = false,
  variant = danger ? "danger" : "default"
} = {}) {
  return new Promise((resolve) => {
    const modal = renderModal({
      title,
      message,
      confirmText,
      cancelText,
      danger,
      variant
    });

    const dialog = modal.querySelector(".au-modal");
    const confirmButton = modal.querySelector("[data-modal-confirm]");
    const cancelButtons = modal.querySelectorAll("[data-modal-cancel]");

    queueMicrotask(() => {
      confirmButton?.focus();
    });

    const cleanup = () => {
      document.removeEventListener("keydown", onKeydown);
    };

    const confirm = () => {
      cleanup();
      closeModal(modal, resolve, true);
    };

    const cancel = () => {
      cleanup();
      closeModal(modal, resolve, false);
    };

    const onKeydown = (event) => {
      trapFocus(event, modal);

      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }

      if (event.key === "Enter" && document.activeElement === confirmButton) {
        event.preventDefault();
        confirm();
      }
    };

    confirmButton?.addEventListener("click", confirm);

    cancelButtons.forEach((button) => {
      button.addEventListener("click", cancel);
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        cancel();
      }
    });

    dialog?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("keydown", onKeydown);
  });
}

export function promptModal({
  title = t("Ingresar valor", "Enter value"),
  message = "",
  defaultValue = "",
  placeholder = "",
  confirmText = t("Aceptar", "Accept"),
  cancelText = t("Cancelar", "Cancel"),
  fieldLabel = t("Valor", "Value"),
  variant = "input"
} = {}) {
  return new Promise((resolve) => {
    const inputId = createSafeId("au-modal-input");

    const modal = renderModal({
      title,
      message,
      confirmText,
      cancelText,
      variant,
      body: `
        <label class="au-modal__field" for="${escapeHTML(inputId)}">
          <span>${escapeHTML(fieldLabel)}</span>

          <div class="au-modal__input-wrap">
            <i data-lucide="text-cursor-input" aria-hidden="true"></i>

            <input
              id="${escapeHTML(inputId)}"
              class="au-modal__input"
              type="text"
              value="${escapeHTML(defaultValue)}"
              placeholder="${escapeHTML(placeholder)}"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
        </label>
      `
    });

    const dialog = modal.querySelector(".au-modal");
    const input = modal.querySelector(`#${cssEscape(inputId)}`);
    const confirmButton = modal.querySelector("[data-modal-confirm]");
    const cancelButtons = modal.querySelectorAll("[data-modal-cancel]");

    queueMicrotask(() => {
      if (window.lucide?.createIcons) {
        window.lucide.createIcons();
      }

      input?.focus();
      input?.select();
    });

    const cleanup = () => {
      document.removeEventListener("keydown", onKeydown);
    };

    const confirm = () => {
      const value = input?.value?.trim() ?? "";

      cleanup();
      closeModal(modal, resolve, value || null);
    };

    const cancel = () => {
      cleanup();
      closeModal(modal, resolve, null);
    };

    const onKeydown = (event) => {
      trapFocus(event, modal);

      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };

    confirmButton?.addEventListener("click", confirm);

    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirm();
      }
    });

    cancelButtons.forEach((button) => {
      button.addEventListener("click", cancel);
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        cancel();
      }
    });

    dialog?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("keydown", onKeydown);
  });
}