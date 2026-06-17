// src/app/app-live-server.js
import {
  appState,
  setLiveServerLoading,
  setLiveServerStatus,
  resetLiveServerStatus
} from "./state.js";

import { t } from "./i18n.js";
import { getErrorMessage } from "./app-utils.js";

import {
  liveServerStatus,
  liveServerStart,
  liveServerStop,
  liveServerOpenBrowser
} from "../services/live-server.service.js";

import {
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

export async function refreshLiveServerStatus({
  renderApp,
  silent = true
} = {}) {
  try {
    const status = await liveServerStatus();

    setLiveServerStatus(status);

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (!silent) {
      toastSuccess(
        status.running
          ? t("Live Server está activo.", "Live Server is running.")
          : t("Live Server está detenido.", "Live Server is stopped."),
        "Live Server"
      );
    }

    return status;
  } catch (error) {
    console.error(error);
    resetLiveServerStatus();

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (!silent) {
      toastError(
        getErrorMessage(error),
        t("No se pudo leer el estado de Live Server", "Could not read Live Server status")
      );
    }

    return null;
  }
}

export async function startLiveServer({
  renderApp
} = {}) {
  try {
    if (!appState.projectPath) {
      toastWarning(
        t("Abrí un proyecto antes de iniciar Live Server.", "Open a project before starting Live Server."),
        "Live Server"
      );
      return null;
    }

    setLiveServerLoading(true);

    if (typeof renderApp === "function") {
      renderApp();
    }

    const status = await liveServerStart(appState.projectPath);

    setLiveServerStatus(status);

    if (typeof renderApp === "function") {
      renderApp();
    }

    toastSuccess(
      status.url
        ? `${t("Live Server iniciado en", "Live Server started at")} ${status.url}`
        : t("Live Server iniciado.", "Live Server started."),
      "Live Server"
    );

    return status;
  } catch (error) {
    console.error(error);
    setLiveServerLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    toastError(
      getErrorMessage(error),
      t("No se pudo iniciar Live Server", "Could not start Live Server")
    );

    return null;
  }
}

export async function stopLiveServer({
  renderApp
} = {}) {
  try {
    setLiveServerLoading(true);

    if (typeof renderApp === "function") {
      renderApp();
    }

    const status = await liveServerStop();

    setLiveServerStatus(status);

    if (typeof renderApp === "function") {
      renderApp();
    }

    toastSuccess(
      t("Live Server detenido.", "Live Server stopped."),
      "Live Server"
    );

    return status;
  } catch (error) {
    console.error(error);
    setLiveServerLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    toastError(
      getErrorMessage(error),
      t("No se pudo detener Live Server", "Could not stop Live Server")
    );

    return null;
  }
}

export async function openLiveServerBrowser({
  renderApp
} = {}) {
  try {
    if (!appState.liveServer.running) {
      const status = await refreshLiveServerStatus({
        renderApp,
        silent: true
      });

      if (!status?.running) {
        toastWarning(
          t("Primero iniciá Live Server.", "Start Live Server first."),
          "Live Server"
        );
        return null;
      }
    }

    const url = await liveServerOpenBrowser();

    toastInfo(
      `${t("Abriendo navegador", "Opening browser")}: ${url}`,
      "Live Server"
    );

    return url;
  } catch (error) {
    console.error(error);

    toastError(
      getErrorMessage(error),
      t("No se pudo abrir el navegador", "Could not open browser")
    );

    return null;
  }
}

export async function toggleLiveServer({
  renderApp
} = {}) {
  if (appState.liveServer.running) {
    return stopLiveServer({
      renderApp
    });
  }

  return startLiveServer({
    renderApp
  });
}