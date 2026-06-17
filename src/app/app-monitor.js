// src/app/app-monitor.js
import {
  setMonitorLoading,
  setMonitorSnapshot
} from "./state.js";

import { t } from "./i18n.js";
import { getErrorMessage } from "./app-utils.js";
import { readMonitorSnapshot } from "../services/system.service.js";
import { toastSuccess, toastError } from "../components/ui/toast.js";

export async function refreshMonitorSnapshot({
  renderApp,
  silent = false
} = {}) {
  try {
    setMonitorLoading(true);
    renderApp();

    const snapshot = await readMonitorSnapshot();

    setMonitorSnapshot({
      isLoading: false,
      lastUpdatedAt: snapshot.last_updated_at,
      process: {
        pid: snapshot.process?.pid,
        cpuPercent: snapshot.process?.cpu_percent,
        memoryBytes: snapshot.process?.memory_bytes,
        virtualMemoryBytes: snapshot.process?.virtual_memory_bytes
      },
      system: {
        totalMemoryBytes: snapshot.system?.total_memory_bytes,
        usedMemoryBytes: snapshot.system?.used_memory_bytes,
        freeMemoryBytes: snapshot.system?.free_memory_bytes,
        cpuCount: snapshot.system?.cpu_count,
        loadAverage: snapshot.system?.load_average
      }
    });

    renderApp();

    if (!silent) {
      toastSuccess(
        t("Monitor actualizado correctamente.", "Monitor updated successfully."),
        "Monitor"
      );
    }
  } catch (error) {
    console.error(error);
    setMonitorLoading(false);
    renderApp();

    if (!silent) {
      toastError(
        getErrorMessage(error),
        t("No se pudo leer el monitor", "Could not read monitor")
      );
    }
  }
}