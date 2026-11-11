// src/components/features/labs3.js — gestión de pestañas, comparación e historial de notificaciones
import { appState, closeTab } from "../../app/state.js";
import { t } from "../../app/i18n.js";
import { toastInfo, toastWarning, getToastHistory } from "../ui/toast.js";
import { openOverlay, openPicker, renderDiff } from "./features.js";

const rerender = () => window.dispatchEvent(new CustomEvent("au:rerender"));

function closeWhere(predicate, label) {
  const targets = appState.openTabs.filter(predicate).map((tab) => tab.path);

  if (!targets.length) {
    toastInfo(t("No hay pestañas para cerrar.", "No tabs to close."), t("Pestañas", "Tabs"));
    return;
  }

  targets.forEach((path) => closeTab(path));
  rerender();
  toastInfo(`${targets.length} ${label}`, t("Pestañas", "Tabs"));
}

export function reopenClosedTab() {
  const list = window.__auClosedTabs || [];
  const path = list.find((item) => !appState.openTabs.some((tab) => tab.path === item));

  if (!path) {
    toastInfo(t("No hay pestañas cerradas recientemente.", "No recently closed tabs."), t("Pestañas", "Tabs"));
    return;
  }

  window.__auClosedTabs = list.filter((item) => item !== path);
  window.dispatchEvent(new CustomEvent("au:open-file", { detail: { path } }));
}

export function compareWithTab() {
  const current = appState.openTabs.find((tab) => tab.path === appState.activeFilePath);
  const others = appState.openTabs.filter((tab) => tab.path !== appState.activeFilePath);

  if (!current || !others.length) {
    toastWarning(t("Necesitás al menos 2 pestañas abiertas.", "You need at least 2 open tabs."), t("Comparar", "Compare"));
    return;
  }

  openPicker({
    title: t("Comparar con…", "Compare with…"),
    icon: "git-compare",
    items: others.map((tab) => ({ kind: "tab", name: tab.name || tab.path, meta: tab.path, value: tab.path })),
    onPick: (item) => {
      const other = appState.openTabs.find((tab) => tab.path === item.value);
      const left = other?.content ?? "";
      const right = appState.editorView?.state.doc.toString() ?? current.content ?? "";

      openOverlay({
        title: `${other?.name} ⇄ ${current.name}`,
        icon: "git-compare",
        width: 900,
        body: `<div class="au-hist__view" style="max-height:64vh">${renderDiff(left, right)}</div>`
      });
    }
  });
}

export function openNotificationHistory() {
  const items = getToastHistory();

  if (!items.length) {
    toastInfo(t("Todavía no hay notificaciones.", "No notifications yet."), t("Notificaciones", "Notifications"));
    return;
  }

  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  openOverlay({
    title: t("Historial de notificaciones", "Notification history"),
    icon: "info",
    width: 640,
    body: `<ul class="au-notif">${items
      .map(
        (item) => `<li class="is-${esc(item.type)}"><i></i><div><strong>${esc(item.title)}</strong><span>${esc(item.message)}</span></div><time>${new Date(item.at).toLocaleTimeString()}</time></li>`
      )
      .join("")}</ul>`
  });
}

export function createLabs3Commands() {
  const group = t("Pestañas", "Tabs");

  return [
    { id: "tab-close-others", title: t("Cerrar otras pestañas", "Close other tabs"), description: t("Cierra todas menos la activa (omite las no guardadas).", "Closes all but the active one (skips unsaved)."), group, icon: "x", keywords: ["tabs", "pestañas", "cerrar", "otras"], run: () => closeWhere((tab) => tab.path !== appState.activeFilePath && !tab.isDirty, t("pestaña(s) cerrada(s)", "tab(s) closed")) },
    { id: "tab-close-saved", title: t("Cerrar pestañas guardadas", "Close saved tabs"), description: t("Cierra las pestañas sin cambios pendientes.", "Closes tabs without pending changes."), group, icon: "x", keywords: ["tabs", "pestañas", "guardadas"], run: () => closeWhere((tab) => !tab.isDirty, t("pestaña(s) cerrada(s)", "tab(s) closed")) },
    { id: "tab-reopen", title: t("Reabrir pestaña cerrada", "Reopen closed tab"), description: t("Vuelve a abrir la última pestaña cerrada.", "Reopens the last closed tab."), group, icon: "undo-2", keywords: ["reopen", "reabrir", "cerrada"], run: reopenClosedTab },
    { id: "tab-compare", title: t("Comparar con otra pestaña…", "Compare with another tab…"), description: t("Diff entre el archivo activo y otra pestaña abierta.", "Diff between the active file and another open tab."), group, icon: "git-compare", keywords: ["diff", "comparar", "compare"], run: compareWithTab },
    { id: "notif-history", title: t("Historial de notificaciones", "Notification history"), description: t("Revisa los avisos recientes que ya desaparecieron.", "Review recent notices that already disappeared."), group: "Aurelius Labs", icon: "info", keywords: ["notificaciones", "notifications", "toast", "avisos"], run: openNotificationHistory }
  ];
}

/* ====================================================================== */
/* Rama Git y cambios en la barra de estado                                */
/* ====================================================================== */

let branchTimer = null;
let lastProject = null;

async function refreshBranch() {
  const el = document.getElementById("status-branch");
  const project = appState.projectPath;

  if (!project) {
    if (el) el.hidden = true;
    return;
  }

  try {
    const { gitStatusProject } = await import("../../services/git.service.js");
    const status = await gitStatusProject(project);
    const target = document.getElementById("status-branch");

    if (!target) return;

    if (!status?.is_repo && !status?.isRepo && !status?.branch) {
      target.hidden = true;
      return;
    }

    const changes = Array.isArray(status.files) ? status.files.length : Array.isArray(status.changes) ? status.changes.length : 0;
    target.hidden = false;
    target.querySelector("span").textContent = `${status.branch || "HEAD"}${changes ? ` · ${changes}` : ""}`;
    target.title = `${t("Rama", "Branch")}: ${status.branch || "HEAD"}${changes ? ` — ${changes} ${t("cambio(s)", "change(s)")}` : ""}`;
  } catch {
    const target = document.getElementById("status-branch");
    if (target) target.hidden = true;
  }
}

export function initBranchWatcher() {
  if (branchTimer) return;

  document.addEventListener("click", (event) => {
    if (event.target.closest("#status-branch")) window.dispatchEvent(new CustomEvent("au:open-git-panel"));
  });

  branchTimer = setInterval(() => {
    if (document.hidden) return;
    refreshBranch();
  }, 15000);

  // Tras cada render, si el item aún no tiene texto o cambió el proyecto, refrescamos.
  new MutationObserver(() => {
    const el = document.getElementById("status-branch");
    if (el && (appState.projectPath !== lastProject || !el.dataset.ready)) {
      lastProject = appState.projectPath;
      el.dataset.ready = "1";
      refreshBranch();
    }
  }).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
}
