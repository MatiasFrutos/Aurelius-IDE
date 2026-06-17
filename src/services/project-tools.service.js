// src/services/project-tools.service.js
import { invoke } from "@tauri-apps/api/core";

function normalizePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/g, "")
    .trim();
}

function normalizeCommand(command = "") {
  return String(command || "").trim();
}

function assertProjectPath(projectPath) {
  const path = normalizePath(projectPath);

  if (!path) {
    throw new Error("La ruta del proyecto no puede estar vacía.");
  }

  return path;
}

function assertCommand(command) {
  const cleanCommand = normalizeCommand(command);

  if (!cleanCommand) {
    throw new Error("El comando no puede estar vacío.");
  }

  return cleanCommand;
}

function assertCwd(cwd) {
  const path = normalizePath(cwd);

  if (!path) {
    throw new Error("La carpeta de ejecución no puede estar vacía.");
  }

  return path;
}

function normalizeTask(task = {}) {
  const safeTask = task || {};

  return {
    id: String(safeTask.id || "").trim(),
    group: String(safeTask.group || "Other").trim(),
    label: String(safeTask.label || safeTask.command || "Command").trim(),
    command: String(safeTask.command || "").trim(),
    cwd: normalizePath(safeTask.cwd || ""),
    icon: String(safeTask.icon || "terminal").trim(),
    long_running: Boolean(safeTask.long_running ?? safeTask.longRunning)
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

function normalizeRunResult(result = {}) {
  const safeResult = result || {};

  return {
    ok: Boolean(safeResult.ok),
    code: Number.isFinite(Number(safeResult.code)) ? Number(safeResult.code) : null,
    stdout: String(safeResult.stdout || ""),
    stderr: String(safeResult.stderr || "")
  };
}

function normalizeToolchainItem(item = {}) {
  const safeItem = item || {};

  return {
    id: String(safeItem.id || "").trim(),
    label: String(safeItem.label || "Tool").trim(),
    status: String(safeItem.status || "Unknown").trim(),
    version: String(safeItem.version || "").trim(),
    detail: String(safeItem.detail || "").trim(),
    ok: Boolean(safeItem.ok),
    icon: String(safeItem.icon || "terminal").trim()
  };
}

function normalizeToolchainItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeToolchainItem);
}

export async function readProjectTasks(projectPath) {
  const tasks = await invoke("read_project_tasks", {
    projectPath: assertProjectPath(projectPath)
  });

  return normalizeTasks(tasks);
}

export async function runProjectTask(command, cwd) {
  const result = await invoke("run_project_task", {
    command: assertCommand(command),
    cwd: assertCwd(cwd)
  });

  return normalizeRunResult(result);
}

export async function readToolchainDoctor() {
  const items = await invoke("read_toolchain_doctor");

  return normalizeToolchainItems(items);
}