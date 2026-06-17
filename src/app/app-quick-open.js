// src/app/app-quick-open.js
import { appState } from "./state.js";
import { focusElementById } from "./app-utils.js";

import {
  flattenQuickOpenFiles,
  filterQuickOpenItems
} from "../components/quick-open/quick-open.js";

let quickOpenOpen = false;
let quickOpenQuery = "";
let quickOpenActiveIndex = 0;

export function isQuickOpenOpen() {
  return quickOpenOpen;
}

export function getQuickOpenItems() {
  const files = flattenQuickOpenFiles(appState.fileTree, appState.projectPath);
  return filterQuickOpenItems(files, quickOpenQuery);
}

export function getQuickOpenRenderState() {
  return {
    quickOpenOpen,
    quickOpenQuery,
    quickOpenItems: getQuickOpenItems(),
    quickOpenActiveIndex
  };
}

export function focusQuickOpenInput(selectAll = false) {
  focusElementById("quick-open-input", { selectAll });
}

export function openQuickOpen(renderApp) {
  quickOpenOpen = true;
  quickOpenQuery = "";
  quickOpenActiveIndex = 0;

  renderApp();
  focusQuickOpenInput(true);
}

export function closeQuickOpen(renderApp) {
  quickOpenOpen = false;
  quickOpenQuery = "";
  quickOpenActiveIndex = 0;

  renderApp();
}

function syncQuickOpenActiveItem(nextIndex) {
  const items = Array.from(document.querySelectorAll("[data-quick-open-path]"));

  if (!items.length) {
    quickOpenActiveIndex = 0;
    return;
  }

  const safeIndex = Math.max(0, Math.min(nextIndex, items.length - 1));

  quickOpenActiveIndex = safeIndex;

  items.forEach((item, index) => {
    const isActive = index === safeIndex;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", isActive ? "true" : "false");

    if (isActive) {
      item.scrollIntoView({
        block: "nearest"
      });
    }
  });
}

function executeQuickOpenItem(path, { renderApp, openFile }) {
  if (!path) {
    return;
  }

  quickOpenOpen = false;
  quickOpenQuery = "";
  quickOpenActiveIndex = 0;

  openFile(path);
}

function handleQuickOpenInput(event, renderApp) {
  quickOpenQuery = event.target.value || "";
  quickOpenActiveIndex = 0;

  renderApp();
  focusQuickOpenInput();
}

function handleQuickOpenKeydown(event, { renderApp, openFile }) {
  const visibleItems = getQuickOpenItems();

  if (event.key === "Escape") {
    event.preventDefault();
    closeQuickOpen(renderApp);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();

    if (!visibleItems.length) {
      return;
    }

    syncQuickOpenActiveItem(
      (quickOpenActiveIndex + 1 + visibleItems.length) % visibleItems.length
    );

    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    if (!visibleItems.length) {
      return;
    }

    syncQuickOpenActiveItem(
      (quickOpenActiveIndex - 1 + visibleItems.length) % visibleItems.length
    );

    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    const item = visibleItems[quickOpenActiveIndex];

    if (item) {
      executeQuickOpenItem(item.path, {
        renderApp,
        openFile
      });
    }
  }
}

export function bindQuickOpenEvents({ renderApp, openFile }) {
  const quickOpenInput = document.getElementById("quick-open-input");

  quickOpenInput?.addEventListener("input", (event) => {
    handleQuickOpenInput(event, renderApp);
  });

  quickOpenInput?.addEventListener("keydown", (event) => {
    handleQuickOpenKeydown(event, {
      renderApp,
      openFile
    });
  });

  document.querySelectorAll("[data-quick-open-path]").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      const index = Number(button.dataset.quickOpenIndex);

      if (Number.isFinite(index)) {
        syncQuickOpenActiveItem(index);
      }
    });

    button.addEventListener("click", () => {
      executeQuickOpenItem(decodeURIComponent(button.dataset.quickOpenPath || ""), {
        renderApp,
        openFile
      });
    });
  });

  document.querySelectorAll("[data-quick-open-close]").forEach((element) => {
    element.addEventListener("click", () => {
      closeQuickOpen(renderApp);
    });
  });
}