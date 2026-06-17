// src/services/tasks.service.js
import { invoke } from "@tauri-apps/api/core";

export async function cargoCheckProject(projectPath) {
  return invoke("cargo_check_project", {
    projectPath
  });
}

export async function runProjectDiagnostics(projectPath) {
  return invoke("run_project_diagnostics", {
    projectPath
  });
}