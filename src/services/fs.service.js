// src/services/fs.service.js
import { invoke } from "@tauri-apps/api/core";

function normalizePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/g, "")
    .trim();
}

function normalizeRelativePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/g, "")
    .replace(/\/+/g, "/")
    .trim();
}

function normalizeText(value = "") {
  return typeof value === "string" ? value : String(value ?? "");
}

function assertPath(value, label) {
  const path = normalizePath(value);

  if (!path) {
    throw new Error(`${label} no puede estar vacío.`);
  }

  return path;
}

function assertRelativePath(value, label) {
  const path = normalizeRelativePath(value);

  if (!path) {
    throw new Error(`${label} no puede estar vacío.`);
  }

  return path;
}

function assertSimpleName(value, label) {
  const name = String(value || "").trim();

  if (!name) {
    throw new Error(`${label} no puede estar vacío.`);
  }

  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`${label} no puede contener separadores de ruta.`);
  }

  if (name === "." || name === "..") {
    throw new Error(`${label} no es válido.`);
  }

  return name;
}

function normalizeSettingsForBackend(settings = {}) {
  const safeSettings = settings || {};

  return {
    theme: safeSettings.theme === "light" ? "light" : "dark",
    language: safeSettings.language === "en" ? "en" : "es",
    sidebar_width: Number(safeSettings.sidebarWidth ?? safeSettings.sidebar_width ?? 286),
    editor_font_size: Number(safeSettings.editorFontSize ?? safeSettings.editor_font_size ?? 14),
    editor_font_family: normalizeText(
      safeSettings.editorFontFamily ?? safeSettings.editor_font_family ?? "JetBrains Mono"
    ).trim() || "JetBrains Mono",
    ai_provider: normalizeText(safeSettings.aiProvider ?? safeSettings.ai_provider ?? "ollama").trim() || "ollama",
    ai_base_url: normalizeText(safeSettings.aiBaseUrl ?? safeSettings.ai_base_url ?? "http://localhost:11434").trim(),
    ai_api_key: normalizeText(safeSettings.aiApiKey ?? safeSettings.ai_api_key ?? "").trim(),
    ai_model: normalizeText(safeSettings.aiModel ?? safeSettings.ai_model ?? "llama3.2").trim() || "llama3.2"
  };
}

function normalizeAiMessage(message = {}) {
  const role = normalizeText(message.role || "user").trim() || "user";
  const content = normalizeText(message.content);

  return {
    role,
    content
  };
}

function normalizeAiRequest(request = {}) {
  const safeRequest = request || {};

  return {
    provider: normalizeText(safeRequest.provider || "ollama").trim() || "ollama",
    base_url: normalizeText(safeRequest.baseUrl ?? safeRequest.base_url ?? "http://localhost:11434").trim(),
    api_key: normalizeText(safeRequest.apiKey ?? safeRequest.api_key ?? "").trim(),
    model: normalizeText(safeRequest.model || "llama3.2").trim() || "llama3.2",
    messages: Array.isArray(safeRequest.messages)
      ? safeRequest.messages.map(normalizeAiMessage)
      : []
  };
}

export function openProjectDialog() {
  return invoke("open_project_dialog");
}

export function readProjectTree(projectPath) {
  return invoke("read_project_tree", {
    projectPath: assertPath(projectPath, "La ruta del proyecto")
  });
}

export function readFile(filePath) {
  return invoke("read_file", {
    filePath: assertPath(filePath, "La ruta del archivo")
  });
}

export function writeFile(filePath, content) {
  return invoke("write_file", {
    filePath: assertPath(filePath, "La ruta del archivo"),
    content: normalizeText(content)
  });
}

export function createFile(projectPath, relativePath) {
  return invoke("create_file", {
    projectPath: assertPath(projectPath, "La ruta del proyecto"),
    relativePath: assertRelativePath(relativePath, "La ruta relativa del archivo")
  });
}

export function createFolder(projectPath, relativePath) {
  return invoke("create_folder", {
    projectPath: assertPath(projectPath, "La ruta del proyecto"),
    relativePath: assertRelativePath(relativePath, "La ruta relativa de la carpeta")
  });
}

export function renamePath(currentPath, newName) {
  return invoke("rename_path", {
    currentPath: assertPath(currentPath, "La ruta actual"),
    newName: assertSimpleName(newName, "El nuevo nombre")
  });
}

export function deletePath(targetPath) {
  return invoke("delete_path", {
    targetPath: assertPath(targetPath, "La ruta a eliminar")
  });
}

export function movePath(sourcePath, targetDirectoryPath) {
  return invoke("move_path", {
    sourcePath: assertPath(sourcePath, "La ruta origen"),
    targetDirectoryPath: assertPath(targetDirectoryPath, "La carpeta destino")
  });
}

export function readRecentProjects() {
  return invoke("read_recent_projects");
}

export function addRecentProject(projectPath) {
  return invoke("add_recent_project", {
    projectPath: assertPath(projectPath, "La ruta del proyecto")
  });
}

export function clearRecentProjects() {
  return invoke("clear_recent_projects");
}

export function readSettings() {
  return invoke("read_settings");
}

export function writeSettings(settings) {
  return invoke("write_settings", {
    settings: normalizeSettingsForBackend(settings)
  });
}

export function searchProject(projectPath, query) {
  return invoke("search_project", {
    projectPath: assertPath(projectPath, "La ruta del proyecto"),
    query: normalizeText(query).trim()
  });
}

export function chatWithAi(request) {
  return invoke("chat_with_ai", {
    request: normalizeAiRequest(request)
  });
}