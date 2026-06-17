// src/app/app-utils.js
export function encodePath(path) {
  return encodeURIComponent(path);
}

export function decodePath(path) {
  return decodeURIComponent(path);
}

export function getBaseName(path) {
  return String(path || "").split("/").filter(Boolean).pop() || path;
}

export function getErrorMessage(error) {
  if (typeof error === "string") {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  return "Error desconocido.";
}

export function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target?.isContentEditable
  );
}

export function isModalOpen() {
  return Boolean(document.querySelector(".au-modal-root"));
}

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function focusElementById(id, { selectAll = false } = {}) {
  queueMicrotask(() => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.focus();

    if (selectAll && typeof element.select === "function") {
      element.select();
      return;
    }

    if (
      typeof element.setSelectionRange === "function" &&
      typeof element.value === "string"
    ) {
      const valueLength = element.value.length;
      element.setSelectionRange(valueLength, valueLength);
    }
  });
}