// src/services/shell.service.js — Git acotado, sondeo de herramientas y detalles del sistema
import { invoke } from "@tauri-apps/api/core";

export function gitRun(projectPath, args) {
  return invoke("git_run", { projectPath, args });
}

export function probeToolVersions(names) {
  return invoke("probe_tool_versions", { names });
}

export function readSystemDetails() {
  return invoke("read_system_details_snapshot");
}
