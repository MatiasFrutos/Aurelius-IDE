// src/app/app-command-actions.js
import { appState } from "./state.js";
import { t } from "./i18n.js";

export function createCommandActions({
  handleOpenProject,
  handleCreateFile,
  handleCreateFolder,
  handleSaveFile,
  handleCloseActiveTab,
  handleActivityPanel,
  handleOpenGitPanel,
  handleToggleTheme,
  handleToggleLanguage,
  handleToggleTopbar,
  handleToggleSidebar,
  handleToggleRightPanel,
  handleToggleBottomPanel,
  handleRunDiagnostics,
  handleOpenQuickOpen,
  handleStartLiveServer,
  handleStopLiveServer,
  handleToggleLiveServer,
  handleOpenLiveServerBrowser,
  handleRefreshLiveServerStatus,
  ensureBottomPanelOpen,
  renderApp
}) {
  return [
    {
      id: "open-project",
      title: t("Abrir proyecto", "Open project"),
      description: t("Seleccionar una carpeta para trabajar.", "Select a folder to work on."),
      group: t("Archivo", "File"),
      icon: "folder-open",
      shortcut: "Ctrl+O",
      keywords: ["folder", "workspace", "carpeta", "abrir", "proyecto", "open", "project"],
      run: handleOpenProject
    },
    {
      id: "quick-open",
      title: "Quick Open",
      description: t("Buscar y abrir archivos del proyecto rápidamente.", "Search and open project files quickly."),
      group: t("Archivo", "File"),
      icon: "search",
      shortcut: "Ctrl+P",
      keywords: ["quick", "open", "archivo", "buscar", "ctrl p"],
      run: handleOpenQuickOpen
    },
    {
      id: "new-file",
      title: t("Crear archivo", "New file"),
      description: t("Crear un archivo nuevo dentro del proyecto activo.", "Create a new file inside the active project."),
      group: t("Archivo", "File"),
      icon: "file-plus-2",
      shortcut: "Ctrl+N",
      keywords: ["file", "new", "archivo", "crear", "nuevo"],
      run: handleCreateFile
    },
    {
      id: "new-folder",
      title: t("Crear carpeta", "New folder"),
      description: t("Crear una carpeta nueva dentro del proyecto activo.", "Create a new folder inside the active project."),
      group: t("Archivo", "File"),
      icon: "folder-plus",
      shortcut: "Ctrl+Shift+N",
      keywords: ["folder", "directory", "carpeta", "directorio", "crear"],
      run: handleCreateFolder
    },
    {
      id: "save-file",
      title: t("Guardar archivo", "Save file"),
      description: t("Guardar el archivo activo.", "Save the active file."),
      group: t("Archivo", "File"),
      icon: "save",
      shortcut: "Ctrl+S",
      keywords: ["save", "guardar", "archivo"],
      run: handleSaveFile
    },
    {
      id: "close-tab",
      title: t("Cerrar pestaña activa", "Close active tab"),
      description: t("Cerrar el archivo actualmente abierto.", "Close the currently opened file."),
      group: "Editor",
      icon: "x",
      shortcut: "Ctrl+W",
      keywords: ["tab", "close", "cerrar", "pestaña", "archivo"],
      run: handleCloseActiveTab
    },
    {
      id: "show-explorer",
      title: t("Abrir Explorer", "Open Explorer"),
      description: t("Mostrar el árbol de archivos del proyecto.", "Show the project file tree."),
      group: t("Vista", "View"),
      icon: "files",
      shortcut: "Ctrl+B",
      keywords: ["sidebar", "tree", "archivos", "explorer", "explorador"],
      run: () => handleActivityPanel("explorer")
    },
    {
      id: "show-search",
      title: t("Buscar en proyecto", "Search in project"),
      description: t("Abrir el panel de búsqueda.", "Open the search panel."),
      group: t("Vista", "View"),
      icon: "search",
      keywords: ["find", "search", "buscar", "proyecto"],
      run: () => handleActivityPanel("search")
    },
    {
      id: "show-git",
      title: t("Abrir Source Control", "Open Source Control"),
      description: t("Mostrar estado Git real del proyecto.", "Show the real Git status of the project."),
      group: t("Vista", "View"),
      icon: "git-branch",
      keywords: ["git", "source", "control", "branch", "changes", "cambios"],
      run: handleOpenGitPanel
    },
    {
      id: "show-monitor",
      title: t("Abrir Monitor", "Open Monitor"),
      description: t("Mostrar consumo del programa y métricas del sistema.", "Show app usage and system metrics."),
      group: t("Vista", "View"),
      icon: "activity",
      keywords: ["monitor", "system", "sistema", "cpu", "ram", "memoria", "consumo"],
      run: () => handleActivityPanel("monitor")
    },
    {
      id: "show-tasks",
      title: t("Abrir Project Commands", "Open Project Commands"),
      description: t("Mostrar comandos detectados y Live Server.", "Show detected commands and Live Server."),
      group: t("Vista", "View"),
      icon: "rocket",
      keywords: ["tasks", "commands", "project", "live", "server", "comandos"],
      run: () => handleActivityPanel("tasks")
    },
    {
      id: "show-ai",
      title: t("Abrir IA lateral", "Open side AI"),
      description: t("Mostrar el chat IA al costado derecho.", "Show the AI chat on the right side."),
      group: t("Vista", "View"),
      icon: "bot",
      shortcut: "Ctrl+I",
      keywords: ["ai", "ia", "chat", "asistente"],
      run: () => handleActivityPanel("ai")
    },
    {
      id: "show-settings",
      title: t("Abrir Settings", "Open Settings"),
      description: t("Abrir ajustes de Aurelius IDE.", "Open Aurelius IDE settings."),
      group: t("Vista", "View"),
      icon: "settings",
      keywords: ["settings", "config", "ajustes", "configuración"],
      run: () => handleActivityPanel("settings")
    },
    {
      id: "toggle-theme",
      title: appState.settings.theme === "light"
        ? t("Cambiar a tema oscuro", "Switch to dark theme")
        : t("Cambiar a tema claro", "Switch to light theme"),
      description: t("Alternar entre modo oscuro y claro.", "Toggle between dark and light mode."),
      group: t("Apariencia", "Appearance"),
      icon: "palette",
      keywords: ["theme", "tema", "dark", "light", "oscuro", "claro", "apariencia"],
      run: handleToggleTheme
    },
    {
      id: "toggle-language",
      title: appState.settings.language === "en"
        ? "Cambiar a Español"
        : "Switch to English",
      description: appState.settings.language === "en"
        ? "Cambiar la interfaz principal a español."
        : "Switch the main interface to English.",
      group: t("Apariencia", "Appearance"),
      icon: "languages",
      keywords: ["language", "idioma", "english", "ingles", "spanish", "español"],
      run: handleToggleLanguage
    },
    {
      id: "toggle-topbar",
      title: appState.layout.topbarVisible
        ? t("Ocultar topbar", "Hide topbar")
        : t("Mostrar topbar", "Show topbar"),
      description: t("Alternar visibilidad de la barra superior completa.", "Toggle the full topbar visibility."),
      group: "Layout",
      icon: "settings-2",
      shortcut: "Ctrl+Shift+T",
      keywords: ["topbar", "barra superior", "layout", "ocultar", "mostrar"],
      run: handleToggleTopbar
    },
    {
      id: "toggle-sidebar",
      title: appState.layout.sidebarVisible
        ? t("Ocultar Explorer", "Hide Explorer")
        : t("Mostrar Explorer", "Show Explorer"),
      description: t("Alternar visibilidad del panel izquierdo.", "Toggle the left panel visibility."),
      group: "Layout",
      icon: "files",
      shortcut: "Ctrl+B",
      keywords: ["sidebar", "explorer", "panel", "izquierdo"],
      run: handleToggleSidebar
    },
    {
      id: "toggle-right-panel",
      title: appState.layout.rightPanelVisible
        ? t("Ocultar IA lateral", "Hide side AI")
        : t("Mostrar IA lateral", "Show side AI"),
      description: t("Alternar visibilidad del panel derecho.", "Toggle the right panel visibility."),
      group: "Layout",
      icon: "bot",
      shortcut: "Ctrl+I",
      keywords: ["right", "ia", "chat", "panel", "derecho"],
      run: handleToggleRightPanel
    },
    {
      id: "toggle-bottom-panel",
      title: appState.layout.bottomPanelVisible
        ? t("Ocultar terminal", "Hide terminal")
        : t("Mostrar terminal", "Show terminal"),
      description: t("Alternar visibilidad del panel inferior.", "Toggle the bottom panel visibility."),
      group: "Layout",
      icon: "terminal",
      shortcut: "Ctrl+J",
      keywords: ["terminal", "bottom", "panel", "inferior"],
      run: handleToggleBottomPanel
    },
    {
      id: "live-server-toggle",
      title: appState.liveServer.running
        ? t("Detener Live Server", "Stop Live Server")
        : t("Iniciar Live Server", "Start Live Server"),
      description: t(
        "Levantar o detener servidor HTTP nativo para HTML/CSS/JS.",
        "Start or stop the native HTTP server for HTML/CSS/JS."
      ),
      group: "Live Server",
      icon: appState.liveServer.running ? "square" : "play",
      keywords: ["live", "server", "html", "css", "js", "static", "servidor"],
      run: handleToggleLiveServer
    },
    {
      id: "live-server-start",
      title: t("Iniciar Live Server", "Start Live Server"),
      description: t(
        "Servir el proyecto actual en http://127.0.0.1:4587.",
        "Serve the current project at http://127.0.0.1:4587."
      ),
      group: "Live Server",
      icon: "radio-tower",
      keywords: ["live", "server", "start", "iniciar", "html"],
      run: handleStartLiveServer
    },
    {
      id: "live-server-stop",
      title: t("Detener Live Server", "Stop Live Server"),
      description: t("Detener el servidor local activo.", "Stop the active local server."),
      group: "Live Server",
      icon: "square",
      keywords: ["live", "server", "stop", "detener"],
      run: handleStopLiveServer
    },
    {
      id: "live-server-open",
      title: t("Abrir Live Server en navegador", "Open Live Server in browser"),
      description: t("Abrir la URL local activa en el navegador.", "Open the active local URL in the browser."),
      group: "Live Server",
      icon: "external-link",
      keywords: ["live", "server", "browser", "navegador", "abrir"],
      run: handleOpenLiveServerBrowser
    },
    {
      id: "live-server-status",
      title: t("Actualizar estado de Live Server", "Refresh Live Server status"),
      description: t("Consultar si el servidor local está activo.", "Check whether the local server is running."),
      group: "Live Server",
      icon: "refresh-cw",
      keywords: ["live", "server", "status", "estado", "refresh"],
      run: handleRefreshLiveServerStatus
    },
    {
      id: "run-diagnostics",
      title: "Run diagnostics",
      description: t("Ejecutar cargo check y llenar Problems / Output.", "Run cargo check and populate Problems / Output."),
      group: "Diagnostics",
      icon: "circle-alert",
      keywords: ["diagnostics", "problems", "cargo", "check", "rust", "errores"],
      run: handleRunDiagnostics
    },
    {
      id: "new-terminal",
      title: t("Nueva terminal", "New terminal"),
      description: t("Crear una nueva terminal en el panel inferior.", "Create a new terminal in the bottom panel."),
      group: "Terminal",
      icon: "terminal",
      keywords: ["terminal", "shell", "nueva", "consola"],
      run: () => {
        ensureBottomPanelOpen();
        renderApp();

        queueMicrotask(() => {
          document.getElementById("terminal-new-btn")?.click();
        });
      }
    },
    {
      id: "restart-terminal",
      title: t("Reiniciar terminal activa", "Restart active terminal"),
      description: t("Reiniciar la terminal seleccionada.", "Restart the selected terminal."),
      group: "Terminal",
      icon: "refresh-cw",
      keywords: ["terminal", "restart", "reiniciar", "shell"],
      run: () => {
        ensureBottomPanelOpen();
        renderApp();

        queueMicrotask(() => {
          document.getElementById("terminal-restart-btn")?.click();
        });
      }
    },
    {
      id: "clear-bottom-panel",
      title: t("Limpiar panel inferior", "Clear bottom panel"),
      description: t(
        "Limpiar terminal, output, problems o logs según la pestaña activa.",
        "Clear terminal, output, problems or logs depending on the active tab."
      ),
      group: "Terminal",
      icon: "trash-2",
      keywords: ["clear", "limpiar", "terminal", "output", "logs", "problems"],
      run: () => {
        ensureBottomPanelOpen();
        renderApp();

        queueMicrotask(() => {
          document.getElementById("bottom-clear-btn")?.click();
        });
      }
    },
    {
      id: "git-status",
      title: "Git status",
      description: t("Abrir Source Control y refrescar estado Git.", "Open Source Control and refresh Git status."),
      group: "Git",
      icon: "git-branch",
      keywords: ["git", "branch", "status", "estado"],
      run: handleOpenGitPanel
    }
  ];
}