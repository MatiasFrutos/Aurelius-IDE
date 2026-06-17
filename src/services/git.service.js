// src/services/git.service.js
import { invoke } from "@tauri-apps/api/core";

function normalizePath(path = "") {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/\/+$/g, "")
    .trim();
}

function assertProjectPath(projectPath) {
  const path = normalizePath(projectPath);

  if (!path) {
    throw new Error("La ruta del proyecto no puede estar vacía.");
  }

  return path;
}

function normalizeGitFileStatus(file = {}) {
  const safeFile = file || {};

  return {
    path: normalizePath(safeFile.path || ""),
    original_path: safeFile.original_path ? normalizePath(safeFile.original_path) : null,
    originalPath: safeFile.original_path ? normalizePath(safeFile.original_path) : null,
    index_status: String(safeFile.index_status || " ").slice(0, 1),
    indexStatus: String(safeFile.index_status || " ").slice(0, 1),
    worktree_status: String(safeFile.worktree_status || " ").slice(0, 1),
    worktreeStatus: String(safeFile.worktree_status || " ").slice(0, 1),
    status: String(safeFile.status || "changed").trim() || "changed"
  };
}

function normalizeGitCommit(commit = {}) {
  const safeCommit = commit || {};

  return {
    hash: String(safeCommit.hash || "").trim(),
    message: String(safeCommit.message || "").trim()
  };
}

function normalizeGitStatusResult(result = {}) {
  const safeResult = result || {};

  return {
    ok: Boolean(safeResult.ok),
    is_repo: Boolean(safeResult.is_repo),
    isRepo: Boolean(safeResult.is_repo),
    root: safeResult.root ? normalizePath(safeResult.root) : null,
    branch: safeResult.branch ? String(safeResult.branch).trim() : null,
    upstream: safeResult.upstream ? String(safeResult.upstream).trim() : null,
    ahead: Number.isFinite(Number(safeResult.ahead)) ? Number(safeResult.ahead) : 0,
    behind: Number.isFinite(Number(safeResult.behind)) ? Number(safeResult.behind) : 0,
    files: Array.isArray(safeResult.files)
      ? safeResult.files.map(normalizeGitFileStatus).filter((file) => file.path)
      : [],
    commits: Array.isArray(safeResult.commits)
      ? safeResult.commits.map(normalizeGitCommit).filter((commit) => commit.hash)
      : [],
    message: String(safeResult.message || "").trim()
  };
}

export async function gitStatusProject(projectPath) {
  const result = await invoke("git_status_project", {
    projectPath: assertProjectPath(projectPath)
  });

  return normalizeGitStatusResult(result);
}

export async function gitRefreshProject(projectPath) {
  const result = await invoke("git_refresh_project", {
    projectPath: assertProjectPath(projectPath)
  });

  return normalizeGitStatusResult(result);
}