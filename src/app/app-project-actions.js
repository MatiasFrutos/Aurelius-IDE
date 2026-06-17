// src/app/app-project-actions.js
import {
  appState,
  setProject,
  setProjectTree,
  setRecentProjects,
  setActivityPanel,
  hasDirtyTabs,
  getDirtyTabs
} from "./state.js";

import { t } from "./i18n.js";
import { getErrorMessage } from "./app-utils.js";
import { persistLayoutPreferences } from "./app-session.js";

import {
  openProjectDialog,
  readProjectTree,
  readRecentProjects,
  addRecentProject,
  clearRecentProjects
} from "../services/fs.service.js";

import {
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

import { confirmModal } from "../components/ui/modal.js";
import { updateStatusbar } from "../components/statusbar/statusbar.js";

function normalizePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/g, "");
}

function getProjectNameFromPath(path = "") {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  return parts.pop() || normalized || t("Proyecto", "Project");
}

function isSameProjectPath(leftPath = "", rightPath = "") {
  return normalizePath(leftPath) === normalizePath(rightPath);
}

function getDirtyTabsCount() {
  if (typeof getDirtyTabs === "function") {
    return getDirtyTabs().length;
  }

  return appState.openTabs.filter((tab) => tab.isDirty).length;
}

function hasUnsavedProjectWork() {
  if (typeof hasDirtyTabs === "function") {
    return hasDirtyTabs();
  }

  return appState.openTabs.some((tab) => tab.isDirty);
}

async function loadProjectTree(projectPath) {
  const normalizedProjectPath = normalizePath(projectPath);

  if (!normalizedProjectPath) {
    throw new Error(t("La ruta del proyecto no es válida.", "The project path is not valid."));
  }

  return readProjectTree(normalizedProjectPath);
}

async function applyOpenedProject(
  projectPath,
  tree,
  {
    renderApp,
    showToast = true,
    updateRecent = true,
    forceExplorerPanel = true,
    persistSession = true
  } = {}
) {
  const normalizedProjectPath = normalizePath(projectPath);

  setProject({
    path: normalizedProjectPath,
    tree
  });

  if (updateRecent) {
    const recent = await addRecentProject(normalizedProjectPath);
    setRecentProjects(recent);
  }

  if (forceExplorerPanel) {
    setActivityPanel("explorer");
  }

  if (persistSession) {
    persistLayoutPreferences();
  }

  renderApp?.();
  updateStatusbar();

  if (showToast) {
    toastSuccess(
      `${t("Proyecto abierto", "Project opened")}: ${appState.projectName}`,
      t("Proyecto cargado", "Project loaded")
    );
  }
}

export async function loadRecentProjects() {
  try {
    const projects = await readRecentProjects();

    setRecentProjects(projects);
  } catch (error) {
    console.error(error);
    setRecentProjects([]);
  }
}

export async function refreshRecentProjects() {
  try {
    const projects = await readRecentProjects();

    setRecentProjects(projects);
  } catch (error) {
    console.error(error);
    setRecentProjects([]);

    toastWarning(
      getErrorMessage(error),
      t("No se pudo actualizar recientes", "Could not refresh recent projects")
    );
  }
}

export async function refreshProjectTree() {
  if (!appState.projectPath) {
    return;
  }

  const tree = await readProjectTree(appState.projectPath);

  setProjectTree(tree);
}

export async function confirmProjectChangeIfDirty() {
  if (!hasUnsavedProjectWork()) {
    return true;
  }

  const dirtyCount = getDirtyTabsCount();

  return confirmModal({
    title: t("Cambios sin guardar", "Unsaved changes"),
    message: t(
      `Tenés ${dirtyCount} archivo(s) con cambios sin guardar. Si abrís otro proyecto, esos cambios se pierden.`,
      `You have ${dirtyCount} file(s) with unsaved changes. If you open another project, those changes will be lost.`
    ),
    confirmText: t("Abrir proyecto", "Open project"),
    cancelText: t("Cancelar", "Cancel"),
    danger: true,
    variant: "delete"
  });
}

export async function openProjectByPath(
  projectPath,
  {
    renderApp,
    confirmDirty = true,
    showToast = true,
    updateRecent = true,
    forceExplorerPanel = true,
    persistSession = true,
    showAlreadyOpenToast = true
  } = {}
) {
  const normalizedProjectPath = normalizePath(projectPath);

  if (!normalizedProjectPath) {
    if (showToast) {
      toastWarning(
        t("La ruta del proyecto no es válida.", "The project path is not valid."),
        t("No se pudo abrir el proyecto", "Could not open project")
      );
    }

    return false;
  }

  if (appState.projectPath && isSameProjectPath(appState.projectPath, normalizedProjectPath)) {
    try {
      const tree = await loadProjectTree(normalizedProjectPath);

      setProjectTree(tree);

      if (forceExplorerPanel) {
        setActivityPanel("explorer");
      }

      if (persistSession) {
        persistLayoutPreferences();
      }

      renderApp?.();
      updateStatusbar();

      if (showAlreadyOpenToast) {
        toastInfo(
          `${t("Proyecto activo", "Active project")}: ${getProjectNameFromPath(normalizedProjectPath)}`,
          t("Proyecto ya abierto", "Project already open")
        );
      }

      return true;
    } catch (error) {
      console.error(error);

      if (showToast) {
        toastError(
          getErrorMessage(error),
          t("No se pudo refrescar el proyecto", "Could not refresh project")
        );
      }

      return false;
    }
  }

  if (confirmDirty) {
    const canContinue = await confirmProjectChangeIfDirty();

    if (!canContinue) {
      if (showToast) {
        toastWarning(
          t(
            "Guardá tus cambios antes de cambiar de proyecto.",
            "Save your changes before switching projects."
          ),
          t("Cambios sin guardar", "Unsaved changes")
        );
      }

      return false;
    }
  }

  try {
    const tree = await loadProjectTree(normalizedProjectPath);

    await applyOpenedProject(normalizedProjectPath, tree, {
      renderApp,
      showToast,
      updateRecent,
      forceExplorerPanel,
      persistSession
    });

    return true;
  } catch (error) {
    console.error(error);

    if (showToast) {
      toastError(
        getErrorMessage(error),
        t("No se pudo abrir el proyecto", "Could not open project")
      );
    }

    return false;
  }
}

export async function openProjectForSessionRestore(projectPath, { renderApp } = {}) {
  return openProjectByPath(projectPath, {
    renderApp,
    confirmDirty: false,
    showToast: false,
    updateRecent: true,
    forceExplorerPanel: false,
    persistSession: false,
    showAlreadyOpenToast: false
  });
}

export async function handleOpenProject({ renderApp }) {
  try {
    const canContinue = await confirmProjectChangeIfDirty();

    if (!canContinue) {
      toastWarning(
        t(
          "Guardá tus cambios antes de cambiar de proyecto.",
          "Save your changes before switching projects."
        ),
        t("Cambios sin guardar", "Unsaved changes")
      );
      return;
    }

    const projectPath = await openProjectDialog();

    if (!projectPath) {
      toastInfo(
        t("No se seleccionó ninguna carpeta.", "No folder was selected."),
        t("Apertura cancelada", "Open cancelled")
      );
      return;
    }

    await openProjectByPath(projectPath, {
      renderApp,
      confirmDirty: false,
      showToast: true,
      updateRecent: true,
      forceExplorerPanel: true,
      persistSession: true,
      showAlreadyOpenToast: true
    });
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo abrir el proyecto", "Could not open project")
    );
  }
}

export async function handleOpenRecentProject(projectPath, { renderApp }) {
  try {
    const normalizedProjectPath = normalizePath(projectPath);

    if (!normalizedProjectPath) {
      toastWarning(
        t("El proyecto reciente no tiene una ruta válida.", "The recent project has no valid path."),
        t("Proyecto reciente inválido", "Invalid recent project")
      );
      await refreshRecentProjects();
      renderApp?.();
      return;
    }

    await openProjectByPath(normalizedProjectPath, {
      renderApp,
      confirmDirty: true,
      showToast: true,
      updateRecent: true,
      forceExplorerPanel: true,
      persistSession: true,
      showAlreadyOpenToast: true
    });
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo abrir el proyecto reciente", "Could not open recent project")
    );

    try {
      await refreshRecentProjects();
      renderApp?.();
    } catch {
      // noop
    }
  }
}

export async function handleClearRecentProjects({ renderApp }) {
  try {
    if (!appState.recentProjects.length) {
      toastInfo(
        t("No hay proyectos recientes para limpiar.", "There are no recent projects to clear."),
        t("Historial vacío", "Empty history")
      );
      return;
    }

    const confirmed = await confirmModal({
      title: t("Limpiar proyectos recientes", "Clear recent projects"),
      message: t(
        "Esto solo limpia el historial. No elimina carpetas ni archivos del disco.",
        "This only clears the history. It does not delete folders or files from disk."
      ),
      confirmText: t("Limpiar historial", "Clear history"),
      cancelText: t("Cancelar", "Cancel"),
      danger: true,
      variant: "delete"
    });

    if (!confirmed) {
      toastInfo(
        t("El historial se mantiene igual.", "The history remains unchanged."),
        t("Acción cancelada", "Action cancelled")
      );
      return;
    }

    const projects = await clearRecentProjects();

    setRecentProjects(projects);
    renderApp?.();

    toastSuccess(
      t(
        "Historial de proyectos recientes limpio.",
        "Recent project history cleared."
      ),
      t("Historial actualizado", "History updated")
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo limpiar el historial", "Could not clear history")
    );
  }
}

export async function handleRefreshProject({ renderApp }) {
  try {
    if (!appState.projectPath) {
      toastWarning(
        t("Primero abrí un proyecto.", "Open a project first."),
        t("Sin proyecto activo", "No active project")
      );
      return;
    }

    await refreshProjectTree();

    renderApp?.();
    updateStatusbar();

    toastSuccess(
      t("El árbol de archivos fue actualizado.", "The file tree was updated."),
      t("Proyecto refrescado", "Project refreshed")
    );
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo refrescar el proyecto", "Could not refresh project")
    );
  }
}