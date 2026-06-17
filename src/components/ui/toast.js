// src/components/ui/toast.js
import { t } from "../../app/i18n.js";

let toastContainer = null;

const MAX_VISIBLE_TOASTS = 4;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }

  toastContainer = document.createElement("div");
  toastContainer.className = "au-toast-container";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-relevant", "additions removals");

  document.body.appendChild(toastContainer);

  return toastContainer;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getToastIcon(type = "info") {
  const iconMap = {
    success: "check-circle-2",
    error: "circle-alert",
    info: "badge-info",
    warning: "triangle-alert"
  };

  return iconMap[type] || iconMap.info;
}

function getToastRole(type = "info") {
  if (type === "error" || type === "warning") {
    return "alert";
  }

  return "status";
}

function normalizeToastType(type = "info") {
  const safeType = String(type || "info").trim().toLowerCase();

  if (["success", "error", "info", "warning"].includes(safeType)) {
    return safeType;
  }

  return "info";
}

function normalizeTimeout(timeout, fallback = 3200) {
  const value = Number(timeout);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function removeToastElement(toast, container) {
  toast.remove();

  if (!container.children.length) {
    container.remove();
    toastContainer = null;
  }
}

function trimOldToasts(container) {
  const toasts = Array.from(container.querySelectorAll(".au-toast"));

  if (toasts.length < MAX_VISIBLE_TOASTS) {
    return;
  }

  const extraToasts = toasts.slice(0, toasts.length - MAX_VISIBLE_TOASTS + 1);

  extraToasts.forEach((toast) => {
    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");

    window.setTimeout(() => {
      if (toast.isConnected) {
        removeToastElement(toast, container);
      }
    }, 190);
  });
}

function createToast({
  type = "info",
  title = "Aurelius",
  message = "",
  timeout = 3200
}) {
  const safeType = normalizeToastType(type);
  const safeTimeout = normalizeTimeout(timeout);
  const hasTimer = safeTimeout > 0;
  const container = ensureToastContainer();

  trimOldToasts(container);

  const toast = document.createElement("div");
  toast.className = `au-toast au-toast--${safeType}`;
  toast.setAttribute("role", getToastRole(safeType));

  if (safeType === "error" || safeType === "warning") {
    toast.setAttribute("aria-live", "assertive");
  }

  toast.style.setProperty("--au-toast-duration", `${hasTimer ? safeTimeout : 0}ms`);

  toast.innerHTML = `
    <div class="au-toast__accent"></div>

    <div class="au-toast__icon" aria-hidden="true">
      <i data-lucide="${escapeHTML(getToastIcon(safeType))}"></i>
    </div>

    <div class="au-toast__body">
      <strong title="${escapeHTML(title)}">${escapeHTML(title)}</strong>
      ${message ? `<p title="${escapeHTML(message)}">${escapeHTML(message)}</p>` : ""}
    </div>

    <button
      class="au-toast__close"
      type="button"
      aria-label="${escapeHTML(t("Cerrar notificación", "Close notification"))}"
      title="${escapeHTML(t("Cerrar", "Close"))}"
    >
      <i data-lucide="x"></i>
    </button>

    ${hasTimer ? `<div class="au-toast__progress" aria-hidden="true"></div>` : ""}
  `;

  container.appendChild(toast);

  let closeTimer = null;
  let isClosed = false;

  const close = () => {
    if (isClosed) {
      return;
    }

    isClosed = true;

    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }

    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");

    window.setTimeout(() => {
      if (toast.isConnected) {
        removeToastElement(toast, container);
      }
    }, 210);
  };

  toast.querySelector(".au-toast__close")?.addEventListener("click", close);

  queueMicrotask(() => {
    toast.classList.add("is-visible");

    if (window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
  });

  if (hasTimer) {
    closeTimer = window.setTimeout(close, safeTimeout);
  }

  toast.addEventListener("mouseenter", () => {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
      toast.classList.add("is-paused");
    }
  });

  toast.addEventListener("mouseleave", () => {
    if (!hasTimer || isClosed) {
      return;
    }

    toast.classList.remove("is-paused");
    closeTimer = window.setTimeout(close, 1300);
  });

  return toast;
}

export function toastSuccess(message, title = t("Operación completada", "Operation completed")) {
  return createToast({
    type: "success",
    title,
    message,
    timeout: 3200
  });
}

export function toastError(message, title = t("Algo salió mal", "Something went wrong")) {
  return createToast({
    type: "error",
    title,
    message,
    timeout: 5600
  });
}

export function toastInfo(message, title = t("Información", "Information")) {
  return createToast({
    type: "info",
    title,
    message,
    timeout: 3400
  });
}

export function toastWarning(message, title = t("Atención", "Attention")) {
  return createToast({
    type: "warning",
    title,
    message,
    timeout: 4600
  });
}