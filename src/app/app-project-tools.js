// src/app/app-project-tools.js
import {
  appState,
  setProjectToolsLoading,
  setProjectTasks,
  setProjectTaskRunResult,
  setToolchainDoctorLoading,
  setToolchainDoctorItems
} from "./state.js";

import { t } from "./i18n.js";
import { getErrorMessage } from "./app-utils.js";

import {
  readProjectTasks,
  runProjectTask,
  readToolchainDoctor
} from "../services/project-tools.service.js";

import {
  runCommandInTerminal,
  appendBottomPanelOutput
} from "../components/bottom-panel/bottom-panel.js";

import {
  toastSuccess,
  toastError,
  toastInfo,
  toastWarning
} from "../components/ui/toast.js";

function normalizeTask(task = {}) {
  return {
    id: String(task.id || "").trim(),
    group: String(task.group || "Project").trim(),
    label: String(task.label || task.command || "Command").trim(),
    command: String(task.command || "").trim(),
    cwd: String(task.cwd || appState.projectPath || "").trim(),
    icon: String(task.icon || "terminal").trim(),
    long_running: Boolean(task.long_running ?? task.longRunning)
  };
}

function normalizeTasks(tasks = []) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .map(normalizeTask)
    .filter((task) => task.command && task.cwd);
}

function getTaskTitle(task) {
  return `${task.group || "Project"} · ${task.label || task.command}`;
}

function getTerminalTitle(task) {
  const label = String(task.label || task.command || "Command").trim();

  if (label.length <= 34) {
    return label;
  }

  return `${label.slice(0, 34)}…`;
}

function shouldRunInTerminal(task) {
  if (task.long_running) {
    return true;
  }

  const command = String(task.command || "").toLowerCase();

  return (
    command.includes("npm run dev") ||
    command.includes("npm run start") ||
    command.includes("npm start") ||
    command.includes("pnpm dev") ||
    command.includes("yarn dev") ||
    command.includes("vite") ||
    command.includes("watch") ||
    command.includes("serve") ||
    command.includes("cargo run") ||
    command.includes("docker compose up") ||
    command.includes("docker-compose up")
  );
}

export async function loadProjectTasks({ renderApp, silent = false } = {}) {
  try {
    if (!appState.projectPath) {
      setProjectTasks([]);

      if (typeof renderApp === "function") {
        renderApp();
      }

      if (!silent) {
        toastWarning(
          t("Abrí un proyecto para detectar comandos.", "Open a project to detect commands."),
          "Project Commands"
        );
      }

      return;
    }

    setProjectToolsLoading(true);

    if (typeof renderApp === "function") {
      renderApp();
    }

    const tasks = normalizeTasks(await readProjectTasks(appState.projectPath));

    setProjectTasks(tasks);
    setProjectToolsLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (!silent) {
      toastSuccess(
        `${tasks.length} ${t("comando(s) detectado(s).", "command(s) detected.")}`,
        "Project Commands"
      );
    }
  } catch (error) {
    console.error(error);

    setProjectToolsLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (!silent) {
      toastError(
        getErrorMessage(error),
        t("No se pudieron leer los comandos", "Could not read commands")
      );
    }
  }
}

export async function executeProjectTask(task, { renderApp } = {}) {
  const normalizedTask = normalizeTask(task);

  try {
    if (!normalizedTask.command || !normalizedTask.cwd) {
      toastWarning(
        t("El comando no está completo.", "The command is incomplete."),
        "Project Commands"
      );
      return;
    }

    if (shouldRunInTerminal(normalizedTask)) {
      runCommandInTerminal(normalizedTask.command, {
        cwd: normalizedTask.cwd,
        title: getTerminalTitle(normalizedTask)
      });

      setProjectTaskRunResult({
        task: normalizedTask,
        result: {
          ok: true,
          code: null,
          stdout: "",
          stderr: "",
          terminal: true
        },
        ranAt: new Date().toISOString()
      });

      if (typeof renderApp === "function") {
        renderApp();
      }

      toastSuccess(
        `${t("Ejecutando en terminal", "Running in terminal")}: ${normalizedTask.label}`,
        "Project Commands"
      );

      return;
    }

    setProjectToolsLoading(true);
    setProjectTaskRunResult(null);

    if (typeof renderApp === "function") {
      renderApp();
    }

    const result = await runProjectTask(normalizedTask.command, normalizedTask.cwd);

    setProjectToolsLoading(false);
    setProjectTaskRunResult({
      task: normalizedTask,
      result,
      ranAt: new Date().toISOString()
    });

    appendBottomPanelOutput(
      result.ok ? "success" : "warning",
      getTaskTitle(normalizedTask),
      buildTaskOutputMessage(normalizedTask, result)
    );

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (result.ok) {
      toastSuccess(
        `${t("Ejecutado", "Executed")}: ${normalizedTask.label}`,
        "Project Commands"
      );
    } else {
      toastWarning(
        `${t("Terminó con error", "Finished with error")}: ${normalizedTask.label}`,
        "Project Commands"
      );
    }
  } catch (error) {
    console.error(error);

    setProjectToolsLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    toastError(
      getErrorMessage(error),
      t("No se pudo ejecutar el comando", "Could not run command")
    );
  }
}

export async function copyProjectTaskCommand(task) {
  const normalizedTask = normalizeTask(task);
  const command = buildShellCommand(normalizedTask);

  try {
    await navigator.clipboard.writeText(command);

    toastSuccess(
      t("Comando copiado al portapapeles.", "Command copied to clipboard."),
      "Project Commands"
    );
  } catch {
    toastInfo(
      command,
      t("Copiá este comando", "Copy this command")
    );
  }
}

export async function loadToolchainDoctor({ renderApp, silent = false } = {}) {
  try {
    setToolchainDoctorLoading(true);

    if (typeof renderApp === "function") {
      renderApp();
    }

    const items = await readToolchainDoctor();

    setToolchainDoctorItems(items);
    setToolchainDoctorLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (!silent) {
      toastSuccess(
        t("Toolchain Doctor actualizado.", "Toolchain Doctor updated."),
        "Linux Doctor"
      );
    }
  } catch (error) {
    console.error(error);

    setToolchainDoctorLoading(false);

    if (typeof renderApp === "function") {
      renderApp();
    }

    if (!silent) {
      toastError(
        getErrorMessage(error),
        t("No se pudo revisar el entorno", "Could not check the environment")
      );
    }
  }
}

function buildTaskOutputMessage(task, result) {
  const parts = [];

  parts.push(`${t("Comando", "Command")}: ${task.command}`);
  parts.push(`${t("Carpeta", "Folder")}: ${task.cwd}`);

  if (result.code !== undefined && result.code !== null) {
    parts.push(`${t("Código de salida", "Exit code")}: ${result.code}`);
  }

  if (result.stdout?.trim()) {
    parts.push(`stdout:\n${result.stdout.trim().slice(-1800)}`);
  }

  if (result.stderr?.trim()) {
    parts.push(`stderr:\n${result.stderr.trim().slice(-1800)}`);
  }

  return parts.join("\n\n");
}

function buildShellCommand(task) {
  const cwd = String(task.cwd || "").replaceAll('"', '\\"');
  const command = String(task.command || "");

  if (!cwd) {
    return command;
  }

  return `cd "${cwd}" && ${command}`;
}