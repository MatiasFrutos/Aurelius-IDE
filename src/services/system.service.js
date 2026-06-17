// src/services/system.service.js
import { invoke } from "@tauri-apps/api/core";

export function readMonitorSnapshot() {
  return invoke("read_monitor_snapshot");
}