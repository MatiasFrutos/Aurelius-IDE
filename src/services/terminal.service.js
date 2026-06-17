// src/services/terminal.service.js
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MIN_COLS = 20;
const MIN_ROWS = 5;
const MAX_COLS = 300;
const MAX_ROWS = 120;

function normalizePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/g, "")
    .trim();
}

function normalizeTerminalId(id = "") {
  return String(id || "").trim();
}

function normalizeTerminalData(data = "") {
  return typeof data === "string" ? data : String(data ?? "");
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(numericValue)));
}

function normalizeCols(cols) {
  return clampNumber(cols, MIN_COLS, MAX_COLS, DEFAULT_COLS);
}

function normalizeRows(rows) {
  return clampNumber(rows, MIN_ROWS, MAX_ROWS, DEFAULT_ROWS);
}

function assertTerminalId(id) {
  const terminalId = normalizeTerminalId(id);

  if (!terminalId) {
    throw new Error("El ID de terminal no puede estar vacío.");
  }

  return terminalId;
}

function normalizeTerminalPayload(payload = {}) {
  const safePayload = payload || {};

  return {
    id: normalizeTerminalId(safePayload.id),
    data: normalizeTerminalData(safePayload.data),
    message: normalizeTerminalData(safePayload.message)
  };
}

export function spawnTerminal({ cwd = null, cols = DEFAULT_COLS, rows = DEFAULT_ROWS } = {}) {
  const normalizedCwd = cwd ? normalizePath(cwd) : null;

  return invoke("terminal_spawn", {
    cwd: normalizedCwd || null,
    cols: normalizeCols(cols),
    rows: normalizeRows(rows)
  });
}

export function writeTerminal(id, data) {
  const terminalId = assertTerminalId(id);
  const terminalData = normalizeTerminalData(data);

  if (!terminalData) {
    return Promise.resolve();
  }

  return invoke("terminal_write", {
    id: terminalId,
    data: terminalData
  });
}

export function resizeTerminal(id, cols, rows) {
  return invoke("terminal_resize", {
    id: assertTerminalId(id),
    cols: normalizeCols(cols),
    rows: normalizeRows(rows)
  });
}

export function killTerminal(id) {
  return invoke("terminal_kill", {
    id: assertTerminalId(id)
  });
}

export function onTerminalOutput(callback) {
  return listen("terminal:output", (event) => {
    if (typeof callback !== "function") {
      return;
    }

    const payload = normalizeTerminalPayload(event.payload);

    if (!payload.id) {
      return;
    }

    callback({
      id: payload.id,
      data: payload.data
    });
  });
}

export function onTerminalExit(callback) {
  return listen("terminal:exit", (event) => {
    if (typeof callback !== "function") {
      return;
    }

    const payload = normalizeTerminalPayload(event.payload);

    if (!payload.id) {
      return;
    }

    callback({
      id: payload.id,
      message: payload.message || "Terminal cerrada."
    });
  });
}