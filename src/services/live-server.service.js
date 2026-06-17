// src/services/live-server.service.js
import { invoke } from "@tauri-apps/api/core";

export function liveServerStatus() {
  return invoke("live_server_status");
}

export function liveServerStart(projectPath) {
  return invoke("live_server_start", {
    projectPath
  });
}

export function liveServerStop() {
  return invoke("live_server_stop");
}

export function liveServerOpenBrowser() {
  return invoke("live_server_open_browser");
}