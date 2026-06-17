// src/app/app-context-menu.js
import {
  appState,
  collapseFolder,
  setBottomPanelVisible
} from "./state.js";

import { t } from "./i18n.js";
import { persistLayoutPreferences } from "./app-session.js";
import { decodePath, getBaseName, isModalOpen } from "./app-utils.js";

import { showContextMenu } from "../components/context-menu/context-menu.js";
import { openTerminalHere } from "../components/bottom-panel/bottom-panel.js";

import {
  toastSuccess,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

function getDirectoryPath(path = "") {
  const normalized = String(path || "").replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length <= 1) {
    return "";
  }

  const prefix = normalized.startsWith("/") ? "/" : "";

  return `${prefix}${parts.slice(0, -1).join("/")}`;
}

function getContextTarget(event) {
  const fileButton = event.target.closest("[data-file-path]");

  if (fileButton) {
    const path = decodePath(fileButton.dataset.filePath);

    return {
      kind: "file",
      path,
      createBasePath: getDirectoryPath(path),
      terminalBasePath: getDirectoryPath(path),
      title: getBaseName(path),
      subtitle: t("Archivo", "File")
    };
  }

  const folderButton = event.target.closest("[data-folder-path]");

  if (folderButton) {
    const path = decodePath(folderButton.dataset.folderPath);

    return {
      kind: "folder",
      path,
      createBasePath: path,
      terminalBasePath: path,
      title: getBaseName(path),
      subtitle: t("Carpeta", "Folder")
    };
  }

  if (appState.projectPath) {
    return {
      kind: "project",
      path: appState.projectPath,
      createBasePath: appState.projectPath,
      terminalBasePath: appState.projectPath,
      title: appState.projectName || t("Proyecto", "Project"),
      subtitle: appState.projectPath
    };
  }

  return {
    kind: "empty",
    path: "",
    createBasePath: "",
    terminalBasePath: "",
    title: "Aurelius IDE",
    subtitle: t("Sin proyecto activo", "No active project")
  };
}

function handleContextCreateFile(target, handlers) {
  handlers.handleCreateFile(target.createBasePath || appState.projectPath || "");
}

function handleContextCreateFolder(target, handlers) {
  handlers.handleCreateFolder(target.createBasePath || appState.projectPath || "");
}

function handleContextDelete(target, handlers) {
  if (!target.path || target.kind === "project" || target.kind === "empty") {
    toastWarning(
      t(
        "Seleccioná un archivo o carpeta del Explorer para eliminar.",
        "Select a file or folder from the Explorer to delete."
      ),
      t("Eliminar", "Delete")
    );

    return;
  }

  handlers.handleDeletePath(target.path);
}

function handleContextCloseFolder(target, handlers) {
  if (target.kind !== "folder" || !target.path) {
    toastInfo(
      t(
        "Esta acción se aplica solo sobre carpetas del Explorer.",
        "This action only applies to Explorer folders."
      ),
      t("Cerrar carpeta", "Close folder")
    );

    return;
  }

  collapseFolder(target.path);
  handlers.renderApp();
}

function handleContextOpenTerminalHere(target, handlers) {
  if (!appState.projectPath) {
    toastWarning(
      t(
        "Primero abrí un proyecto para usar la terminal.",
        "Open a project first to use the terminal."
      ),
      "Terminal"
    );

    return;
  }

  const cwd = target.terminalBasePath || appState.projectPath;

  if (!cwd) {
    toastWarning(
      t(
        "No se pudo detectar la carpeta destino.",
        "Could not detect the target folder."
      ),
      "Terminal"
    );

    return;
  }

  setBottomPanelVisible(true);
  persistLayoutPreferences();

  handlers.renderApp();

  queueMicrotask(() => {
    openTerminalHere(cwd, {
      title: `${t("Terminal", "Terminal")} · ${getBaseName(cwd)}`
    });

    toastSuccess(
      `${t("Terminal abierta en", "Terminal opened in")} ${cwd}`,
      "Terminal"
    );
  });
}

export function handleAppContextMenu(event, handlers) {
  const app = document.getElementById("app");

  if (!app?.contains(event.target)) {
    return;
  }

  if (
    isModalOpen() ||
    handlers.commandPaletteOpen ||
    handlers.commandHelpOpen ||
    handlers.isQuickOpenOpen()
  ) {
    return;
  }

  event.preventDefault();

  const target = getContextTarget(event);
  const canUseProjectActions = Boolean(appState.projectPath);
  const canDelete = Boolean(target.path && target.kind !== "project" && target.kind !== "empty");
  const canCloseFolder = Boolean(
    target.kind === "folder" &&
    appState.expandedFolders.has(target.path)
  );
  const liveServerRunning = Boolean(appState.liveServer.running);

  showContextMenu({
    x: event.clientX,
    y: event.clientY,
    title: target.title,
    subtitle: target.subtitle,
    actions: [
      {
        id: "create-file",
        label: t("Crear archivo", "Create file"),
        description:
          target.kind === "folder"
            ? t("Crear dentro de esta carpeta", "Create inside this folder")
            : t("Crear dentro del proyecto", "Create inside the project"),
        icon: "file-plus-2",
        disabled: !canUseProjectActions,
        run: () => handleContextCreateFile(target, handlers)
      },
      {
        id: "create-folder",
        label: t("Crear carpeta", "Create folder"),
        description:
          target.kind === "folder"
            ? t("Crear subcarpeta", "Create subfolder")
            : t("Crear carpeta en el proyecto", "Create folder in the project"),
        icon: "folder-plus",
        disabled: !canUseProjectActions,
        run: () => handleContextCreateFolder(target, handlers)
      },
      {
        id: "open-terminal-here",
        label:
          target.kind === "project"
            ? t("Terminal en raíz", "Terminal at root")
            : t("Abrir terminal aquí", "Open terminal here"),
        description:
          target.kind === "file"
            ? t(
                "Abrir terminal en la carpeta del archivo",
                "Open terminal in this file folder"
              )
            : t(
                "Abrir terminal usando esta carpeta",
                "Open terminal using this folder"
              ),
        icon: "terminal",
        disabled: !canUseProjectActions,
        separatorBefore: true,
        run: () => handleContextOpenTerminalHere(target, handlers)
      },
      {
        id: "close-folder",
        label: t("Cerrar carpeta", "Close folder"),
        description: t(
          "Colapsar esta carpeta del Explorer",
          "Collapse this Explorer folder"
        ),
        icon: "folder-open",
        disabled: !canCloseFolder,
        run: () => handleContextCloseFolder(target, handlers)
      },
      {
        id: "live-server",
        label: liveServerRunning
          ? t("Detener Live Server", "Stop Live Server")
          : t("Iniciar Live Server", "Start Live Server"),
        description: liveServerRunning
          ? appState.liveServer.url || t("Servidor activo", "Server running")
          : t(
              "Buscar index.html y levantar servidor",
              "Find index.html and start server"
            ),
        icon: liveServerRunning ? "square" : "radio-tower",
        disabled: !canUseProjectActions,
        run: handlers.handleToggleLiveServer
      },
      {
        id: "delete",
        label: t("Eliminar", "Delete"),
        description: t("Eliminar archivo o carpeta", "Delete file or folder"),
        icon: "trash-2",
        danger: true,
        disabled: !canDelete,
        run: () => handleContextDelete(target, handlers)
      }
    ]
  });
}