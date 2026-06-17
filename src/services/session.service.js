// src/services/session.service.js
import { invoke } from "@tauri-apps/api/core";

export function readUiSession() {
  return invoke("read_ui_session");
}

export function writeUiSession(session) {
  return invoke("write_ui_session", {
    session
  });
}