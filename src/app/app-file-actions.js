// src/app/app-file-actions.js
import {
  appState,
  setActiveFile,
  setActiveTab,
  closeTab,
  markActiveTabSaved,
  removeTabsByPath,
  setActivityPanel,
  detectLanguage
} from "./state.js";

import { t } from "./i18n.js";

import {
  getBaseName,
  getErrorMessage
} from "./app-utils.js";

import { persistLayoutPreferences } from "./app-session.js";
import { renderTabs } from "./app-render.js";
import { refreshIcons } from "./app-icons.js";

import {
  readFile,
  writeFile,
  createFile,
  createFolder,
  renamePath,
  deletePath
} from "../services/fs.service.js";

import { refreshProjectTree } from "./app-project-actions.js";

import {
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

import {
  confirmModal,
  promptModal
} from "../components/ui/modal.js";

import {
  renderEditorShell,
  mountEditor
} from "../components/editor/editor.js";

import { updateStatusbar } from "../components/statusbar/statusbar.js";

function normalizePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/g, "");
}

function normalizeRelativePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/g, "")
    .replace(/\/+/g, "/")
    .trim();
}

function safeDecodePath(value = "") {
  try {
    return normalizePath(decodeURIComponent(value));
  } catch {
    return normalizePath(value);
  }
}

function getDirectoryPath(path = "") {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length <= 1) {
    return "";
  }

  const prefix = normalized.startsWith("/") ? "/" : "";

  return `${prefix}${parts.slice(0, -1).join("/")}`;
}

function getRelativePathFromProject(path = "") {
  if (!path || !appState.projectPath) {
    return "";
  }

  const normalizedProjectPath = normalizePath(appState.projectPath);
  const normalizedPath = normalizePath(path);

  if (normalizedPath === normalizedProjectPath) {
    return "";
  }

  if (!normalizedPath.startsWith(`${normalizedProjectPath}/`)) {
    return "";
  }

  return normalizedPath.slice(normalizedProjectPath.length + 1);
}

function getCreateBaseRelativePath(baseDirectoryPath = "") {
  if (!baseDirectoryPath) {
    return "";
  }

  return getRelativePathFromProject(baseDirectoryPath);
}

function joinRelativePath(baseRelativePath = "", name = "") {
  const cleanBase = normalizeRelativePath(baseRelativePath);
  const cleanName = normalizeRelativePath(name);

  if (!cleanBase) {
    return cleanName;
  }

  return `${cleanBase}/${cleanName}`;
}

function getEditorContent() {
  if (appState.editorView?.state?.doc) {
    return appState.editorView.state.doc.toString();
  }

  return appState.activeFileContent || "";
}

function isSamePath(leftPath = "", rightPath = "") {
  return normalizePath(leftPath) === normalizePath(rightPath);
}

function isPathInsideOrEqual(targetPath = "", parentPath = "") {
  const target = normalizePath(targetPath);
  const parent = normalizePath(parentPath);

  return target === parent || target.startsWith(`${parent}/`);
}

function renameOpenedTabs(currentPath, renamedPath) {
  const normalizedCurrentPath = normalizePath(currentPath);
  const normalizedRenamedPath = normalizePath(renamedPath);

  if (!normalizedCurrentPath || !normalizedRenamedPath) {
    return;
  }

  let nextActivePath = null;

  appState.openTabs.forEach((tab) => {
    if (!isPathInsideOrEqual(tab.path, normalizedCurrentPath)) {
      return;
    }

    const oldPath = normalizePath(tab.path);
    const suffix = oldPath.slice(normalizedCurrentPath.length).replace(/^\/+/, "");
    const nextPath = suffix ? `${normalizedRenamedPath}/${suffix}` : normalizedRenamedPath;

    tab.path = nextPath;
    tab.name = getBaseName(nextPath) || nextPath;
    tab.language = detectLanguage(nextPath);

    if (isSamePath(appState.activeFilePath, oldPath)) {
      nextActivePath = nextPath;
    }
  });

  if (nextActivePath) {
    setActiveTab(nextActivePath);
  }
}

function getAffectedDirtyTabs(targetPath) {
  const normalizedTargetPath = normalizePath(targetPath);

  return appState.openTabs.filter((tab) => {
    return tab.isDirty && isPathInsideOrEqual(tab.path, normalizedTargetPath);
  });
}

function getOpenedTab(path) {
  const normalizedPath = normalizePath(path);

  return appState.openTabs.find((tab) => isSamePath(tab.path, normalizedPath)) || null;
}

function getDirtyOpenTabs() {
  return appState.openTabs.filter((tab) => tab.isDirty);
}

function notifyNothingCreated(kind) {
  const isFolder = kind === "folder";

  toastInfo(
    isFolder
      ? t("No se creó ninguna carpeta.", "No folder was created.")
      : t("No se creó ningún archivo.", "No file was created."),
    t("Creación cancelada", "Creation cancelled")
  );
}

function getEditorTabsElement() {
  return document.getElementById("editor-tabs");
}

function getEditorAreaElement() {
  return document.getElementById("editor-area");
}

function getExplorerTreeElement() {
  return document.getElementById("explorer-tree");
}

function updateTabsDom() {
  const tabs = getEditorTabsElement();

  if (!tabs) {
    return false;
  }

  tabs.innerHTML = renderTabs();
  refreshIcons();

  return true;
}

function updateEditorShellDom() {
  if (!appState.activeFilePath) {
    return false;
  }

  const editorArea = getEditorAreaElement();

  if (editorArea) {
    editorArea.innerHTML = renderEditorShell();
    refreshIcons();

    return true;
  }

  const editor = document.querySelector(".au-editor");

  if (!editor) {
    return false;
  }

  editor.outerHTML = renderEditorShell();
  refreshIcons();

  return true;
}

function updateExplorerActiveFileDom() {
  const tree = getExplorerTreeElement();

  if (!tree) {
    return;
  }

  const activePath = normalizePath(appState.activeFilePath);

  tree.querySelectorAll("[data-active-file-row='true']").forEach((element) => {
    element.removeAttribute("data-active-file-row");
  });

  tree.querySelectorAll(".au-tree__row.is-file.is-active").forEach((element) => {
    element.classList.remove("is-active");
  });

  if (!activePath) {
    return;
  }

  tree.querySelectorAll("[data-file-path]").forEach((button) => {
    const buttonPath = safeDecodePath(button.getAttribute("data-file-path") || "");

    if (!isSamePath(buttonPath, activePath)) {
      return;
    }

    button.classList.add("is-active");
    button.setAttribute("data-active-file-row", "true");
  });
}

function focusEditorSoon() {
  queueMicrotask(() => {
    appState.editorView?.focus?.();
  });
}

function patchEditorWorkspace({ focusEditor = true } = {}) {
  const tabsUpdated = updateTabsDom();
  const editorUpdated = updateEditorShellDom();

  if (!tabsUpdated && !editorUpdated) {
    return false;
  }

  mountEditor();
  updateExplorerActiveFileDom();
  updateStatusbar();

  if (focusEditor) {
    focusEditorSoon();
  }

  return true;
}

function renderFileWorkspace({ renderApp }, options = {}) {
  const patched = patchEditorWorkspace(options);

  if (patched) {
    return;
  }

  renderApp?.();
  updateStatusbar();
}

function renderFull({ renderApp }) {
  renderApp?.();
  updateStatusbar();
}

export async function confirmDiscardTab(tab) {
  if (!tab?.isDirty) {
    return true;
  }

  return confirmModal({
    title: t("Cerrar archivo con cambios", "Close file with changes"),
    message: t(
      `El archivo "${tab.name}" tiene cambios sin guardar. Si cerrás la pestaña, esos cambios se pierden.`,
      `The file "${tab.name}" has unsaved changes. If you close the tab, those changes will be lost.`
    ),
    confirmText: t("Cerrar sin guardar", "Close without saving"),
    cancelText: t("Cancelar", "Cancel"),
    danger: true,
    variant: "delete"
  });
}

export async function handleCreateFile({ renderApp, baseDirectoryPath = "" }) {
  try {
    if (!appState.projectPath) {
      toastWarning(
        t("Primero abrí un proyecto.", "Open a project first."),
        t("Sin proyecto activo", "No active project")
      );
      return;
    }

    const baseRelativePath = getCreateBaseRelativePath(baseDirectoryPath);
    const defaultValue = joinRelativePath(baseRelativePath, "nuevo-archivo.js");

    const relativePath = await promptModal({
      title: t("Crear archivo", "Create file"),
      message: t(
        "Indicá la ruta relativa dentro del proyecto.",
        "Enter the relative path inside the project."
      ),
      defaultValue,
      placeholder: baseRelativePath ? `${baseRelativePath}/componente.js` : "src/nuevo-archivo.js",
      confirmText: t("Crear archivo", "Create file"),
      cancelText: t("Cancelar", "Cancel"),
      fieldLabel: t("Ruta del archivo", "File path"),
      variant: "file"
    });

    const cleanRelativePath = normalizeRelativePath(relativePath);

    if (!cleanRelativePath) {
      notifyNothingCreated("file");
      return;
    }

    const createdPath = await createFile(appState.projectPath, cleanRelativePath);

    await refreshProjectTree();

    const content = await readFile(createdPath);

    setActiveFile({
      path: createdPath,
      content
    });

    setActivityPanel("explorer");
    persistLayoutPreferences();
    renderFull({ renderApp });

    toastSuccess(
      `${t("Archivo creado", "File created")}: ${getBaseName(createdPath)}`,
      t("Archivo creado", "File created")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo crear el archivo", "Could not create file")
    );
  }
}

export async function handleCreateFolder({ renderApp, baseDirectoryPath = "" }) {
  try {
    if (!appState.projectPath) {
      toastWarning(
        t("Primero abrí un proyecto.", "Open a project first."),
        t("Sin proyecto activo", "No active project")
      );
      return;
    }

    const baseRelativePath = getCreateBaseRelativePath(baseDirectoryPath);
    const defaultValue = joinRelativePath(baseRelativePath, "nueva-carpeta");

    const relativePath = await promptModal({
      title: t("Crear carpeta", "Create folder"),
      message: t(
        "Indicá la ruta relativa dentro del proyecto.",
        "Enter the relative path inside the project."
      ),
      defaultValue,
      placeholder: baseRelativePath ? `${baseRelativePath}/features` : "src/features",
      confirmText: t("Crear carpeta", "Create folder"),
      cancelText: t("Cancelar", "Cancel"),
      fieldLabel: t("Ruta de la carpeta", "Folder path"),
      variant: "folder"
    });

    const cleanRelativePath = normalizeRelativePath(relativePath);

    if (!cleanRelativePath) {
      notifyNothingCreated("folder");
      return;
    }

    const createdPath = await createFolder(appState.projectPath, cleanRelativePath);

    await refreshProjectTree();

    setActivityPanel("explorer");
    persistLayoutPreferences();
    renderFull({ renderApp });

    toastSuccess(
      `${t("Carpeta creada", "Folder created")}: ${getBaseName(createdPath)}`,
      t("Carpeta creada", "Folder created")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo crear la carpeta", "Could not create folder")
    );
  }
}

export async function handleRenamePath(currentPath, { renderApp }) {
  try {
    const normalizedCurrentPath = normalizePath(currentPath);
    const currentName = getBaseName(normalizedCurrentPath);

    if (!normalizedCurrentPath || !currentName) {
      toastWarning(
        t("La ruta seleccionada no es válida.", "The selected path is not valid."),
        t("No se pudo renombrar", "Could not rename")
      );
      return;
    }

    const affectedDirtyTabs = getAffectedDirtyTabs(normalizedCurrentPath);

    if (affectedDirtyTabs.length) {
      const confirmed = await confirmModal({
        title: t("Renombrar con cambios abiertos", "Rename with open changes"),
        message: t(
          `Hay ${affectedDirtyTabs.length} archivo(s) abiertos con cambios sin guardar dentro de esta ruta. Se conservarán abiertos, pero conviene guardar antes.`,
          `There are ${affectedDirtyTabs.length} open file(s) with unsaved changes inside this path. They will remain open, but saving first is recommended.`
        ),
        confirmText: t("Renombrar igual", "Rename anyway"),
        cancelText: t("Cancelar", "Cancel"),
        variant: "warning"
      });

      if (!confirmed) {
        toastInfo(
          t("No se aplicaron cambios.", "No changes were applied."),
          t("Renombrado cancelado", "Rename cancelled")
        );
        return;
      }
    }

    const newName = await promptModal({
      title: t("Renombrar elemento", "Rename item"),
      message: t(
        "Ingresá el nuevo nombre. No uses rutas, solo el nombre final.",
        "Enter the new name. Do not use paths, only the final name."
      ),
      defaultValue: currentName,
      placeholder: currentName,
      confirmText: t("Renombrar", "Rename"),
      cancelText: t("Cancelar", "Cancel"),
      fieldLabel: t("Nuevo nombre", "New name"),
      variant: "rename"
    });

    const cleanNewName = String(newName || "").trim();

    if (!cleanNewName || cleanNewName === currentName) {
      toastInfo(
        t("No se aplicaron cambios.", "No changes were applied."),
        t("Renombrado cancelado", "Rename cancelled")
      );
      return;
    }

    const renamedPath = await renamePath(normalizedCurrentPath, cleanNewName);

    renameOpenedTabs(normalizedCurrentPath, renamedPath);

    await refreshProjectTree();

    renderFull({ renderApp });

    toastSuccess(
      `${t("Nuevo nombre", "New name")}: ${getBaseName(renamedPath)}`,
      t("Elemento renombrado", "Item renamed")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo renombrar", "Could not rename")
    );
  }
}

export async function handleDeletePath(targetPath, { renderApp }) {
  try {
    const normalizedTargetPath = normalizePath(targetPath);
    const name = getBaseName(normalizedTargetPath);

    if (!normalizedTargetPath || !name) {
      toastWarning(
        t("La ruta seleccionada no es válida.", "The selected path is not valid."),
        t("No se pudo eliminar", "Could not delete")
      );
      return;
    }

    const affectedDirtyTabs = getAffectedDirtyTabs(normalizedTargetPath);

    let message = t(
      `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      `Delete "${name}"? This action cannot be undone.`
    );

    if (affectedDirtyTabs.length) {
      message += ` ${t(
        `Además, hay ${affectedDirtyTabs.length} archivo(s) abiertos con cambios sin guardar dentro de esta ruta.`,
        `Also, there are ${affectedDirtyTabs.length} open file(s) with unsaved changes inside this path.`
      )}`;
    }

    const confirmed = await confirmModal({
      title: t("Eliminar elemento", "Delete item"),
      message,
      confirmText: t("Eliminar", "Delete"),
      cancelText: t("Cancelar", "Cancel"),
      danger: true,
      variant: "delete"
    });

    if (!confirmed) {
      toastInfo(
        t("No se eliminó ningún elemento.", "No item was deleted."),
        t("Eliminación cancelada", "Deletion cancelled")
      );
      return;
    }

    await deletePath(normalizedTargetPath);
    removeTabsByPath(normalizedTargetPath);

    await refreshProjectTree();

    renderFull({ renderApp });

    toastSuccess(
      `${t("Eliminado", "Deleted")}: ${name}`,
      t("Elemento eliminado", "Item deleted")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo eliminar", "Could not delete")
    );
  }
}

export async function handleOpenFile(filePath, { renderApp }) {
  try {
    const normalizedFilePath = normalizePath(filePath);

    if (!normalizedFilePath) {
      toastWarning(
        t("La ruta del archivo no es válida.", "The file path is not valid."),
        t("No se pudo abrir el archivo", "Could not open file")
      );
      return;
    }

    const existingTab = getOpenedTab(normalizedFilePath);

    if (existingTab) {
      setActiveTab(existingTab.path);
      setActivityPanel("explorer");
      persistLayoutPreferences();
      renderFileWorkspace({ renderApp });
      return;
    }

    const content = await readFile(normalizedFilePath);

    setActiveFile({
      path: normalizedFilePath,
      content
    });

    setActivityPanel("explorer");
    persistLayoutPreferences();
    renderFileWorkspace({ renderApp });

    toastSuccess(
      `${t("Archivo abierto", "File opened")}: ${getBaseName(normalizedFilePath)}`,
      t("Archivo cargado", "File loaded")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo abrir el archivo", "Could not open file")
    );
  }
}

export async function handleOpenGitFile(filePath, status = "", { renderApp }) {
  try {
    const normalizedFilePath = normalizePath(filePath);

    if (!normalizedFilePath) {
      toastWarning(
        t("El cambio Git no tiene archivo asociado.", "The Git change has no associated file."),
        "Source Control"
      );
      return;
    }

    if (String(status).toLowerCase() === "deleted") {
      toastWarning(
        t(
          "Este archivo figura como eliminado. En esta etapa todavía no abrimos contenido eliminado ni diff.",
          "This file is marked as deleted. At this stage we do not open deleted content or diffs yet."
        ),
        t("Archivo eliminado", "Deleted file")
      );
      return;
    }

    const existingTab = getOpenedTab(normalizedFilePath);

    if (existingTab) {
      setActiveTab(existingTab.path);
      renderFileWorkspace({ renderApp });

      toastInfo(
        `${t("Archivo Git activo", "Active Git file")}: ${getBaseName(normalizedFilePath)}`,
        "Source Control"
      );
      return;
    }

    const content = await readFile(normalizedFilePath);

    setActiveFile({
      path: normalizedFilePath,
      content
    });

    renderFileWorkspace({ renderApp });

    toastSuccess(
      `${t("Archivo Git abierto", "Git file opened")}: ${getBaseName(normalizedFilePath)}`,
      "Source Control"
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo abrir el archivo Git", "Could not open Git file")
    );
  }
}

export async function handleSaveFile({ renderApp }) {
  try {
    if (!appState.activeFilePath) {
      toastInfo(
        t("No hay archivo activo para guardar.", "No active file to save."),
        t("Nada para guardar", "Nothing to save")
      );
      return;
    }

    const content = getEditorContent();

    await writeFile(appState.activeFilePath, content);

    markActiveTabSaved(content);

    renderFileWorkspace({ renderApp }, { focusEditor: false });

    toastSuccess(
      `${t("Guardado", "Saved")}: ${appState.activeFileName}`,
      t("Archivo guardado", "File saved")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo guardar el archivo", "Could not save file")
    );
  }
}

export async function handleTabClick(path, { renderApp }) {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return;
  }

  setActiveTab(normalizedPath);
  setActivityPanel("explorer");
  persistLayoutPreferences();
  renderFileWorkspace({ renderApp });
}

export async function handleCloseTab(path, { renderApp }) {
  const normalizedPath = normalizePath(path);
  const tab = getOpenedTab(normalizedPath);

  if (!tab) {
    return;
  }

  const canClose = await confirmDiscardTab(tab);

  if (!canClose) {
    toastInfo(
      t("La pestaña sigue abierta.", "The tab remains open."),
      t("Cierre cancelado", "Close cancelled")
    );
    return;
  }

  closeTab(tab.path);

  if (!appState.openTabs.length) {
    persistLayoutPreferences();
    renderFull({ renderApp });
    return;
  }

  persistLayoutPreferences();
  renderFileWorkspace({ renderApp });
}

export async function handleCloseAllTabs({ renderApp }) {
  try {
    if (!appState.openTabs.length) {
      toastInfo(
        t("No hay archivos abiertos para cerrar.", "There are no open files to close."),
        t("Nada para cerrar", "Nothing to close")
      );
      return;
    }

    const dirtyTabs = getDirtyOpenTabs();

    if (dirtyTabs.length) {
      const confirmed = await confirmModal({
        title: t("Cerrar todos los archivos", "Close all files"),
        message: t(
          `Tenés ${dirtyTabs.length} archivo(s) con cambios sin guardar. Si cerrás todos, esos cambios se pierden.`,
          `You have ${dirtyTabs.length} file(s) with unsaved changes. If you close all, those changes will be lost.`
        ),
        confirmText: t("Cerrar todos", "Close all"),
        cancelText: t("Cancelar", "Cancel"),
        danger: true,
        variant: "delete"
      });

      if (!confirmed) {
        toastInfo(
          t("Los archivos siguen abiertos.", "The files remain open."),
          t("Cierre cancelado", "Close cancelled")
        );
        return;
      }
    }

    const totalTabs = appState.openTabs.length;
    const paths = appState.openTabs.map((tab) => tab.path);

    paths.forEach((path) => {
      closeTab(path);
    });

    persistLayoutPreferences();
    renderFull({ renderApp });

    toastSuccess(
      `${totalTabs} ${t("archivo(s) cerrado(s).", "file(s) closed.")}`,
      t("Editor limpio", "Editor cleared")
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudieron cerrar los archivos", "Could not close files")
    );
  }
}

export async function handleCloseActiveTab({ renderApp }) {
  if (!appState.activeFilePath) {
    toastInfo(
      t("No hay una pestaña activa para cerrar.", "There is no active tab to close."),
      t("Nada para cerrar", "Nothing to close")
    );
    return;
  }

  await handleCloseTab(appState.activeFilePath, { renderApp });
}

export function moveTab(step, { renderApp }) {
  if (!appState.openTabs.length || !appState.activeFilePath) {
    return;
  }

  const currentIndex = appState.openTabs.findIndex((tab) => tab.path === appState.activeFilePath);

  if (currentIndex === -1) {
    return;
  }

  const nextIndex =
    (currentIndex + step + appState.openTabs.length) % appState.openTabs.length;

  const nextTab = appState.openTabs[nextIndex];

  setActiveTab(nextTab.path);
  setActivityPanel("explorer");
  persistLayoutPreferences();
  renderFileWorkspace({ renderApp });
}

export function jumpEditorToPosition(line, column) {
  queueMicrotask(() => {
    const view = appState.editorView;

    if (!view || !line) {
      return;
    }

    try {
      const safeLineNumber = Math.min(Math.max(Number(line) || 1, 1), view.state.doc.lines);
      const lineInfo = view.state.doc.line(safeLineNumber);
      const safeColumn = Math.max(Number(column) || 1, 1);
      const position = Math.min(lineInfo.to, lineInfo.from + safeColumn - 1);

      view.dispatch({
        selection: {
          anchor: position
        },
        scrollIntoView: true
      });

      view.focus();
      updateStatusbar();
    } catch (error) {
      console.error(error);
    }
  });
}

export async function handleOpenProblemFile(event, { renderApp }) {
  try {
    const detail = event.detail || {};
    const filePath = normalizePath(detail.file);

    if (!filePath) {
      toastWarning(
        t("El problema no tiene archivo asociado.", "The problem has no associated file."),
        "Problems"
      );
      return;
    }

    const existingTab = getOpenedTab(filePath);

    if (existingTab) {
      setActiveTab(existingTab.path);
    } else {
      const content = await readFile(filePath);

      setActiveFile({
        path: filePath,
        content
      });
    }

    setActivityPanel("explorer");
    persistLayoutPreferences();
    renderFileWorkspace({ renderApp });

    jumpEditorToPosition(detail.line, detail.column);

    toastInfo(
      `${getBaseName(filePath)}${detail.line ? ` · ${t("línea", "line")} ${detail.line}` : ""}`,
      t("Problem abierto", "Problem opened")
    );
  } catch (error) {
    console.error(error);
    toastError(
      getErrorMessage(error),
      t("No se pudo abrir el problema", "Could not open problem")
    );
  }
}