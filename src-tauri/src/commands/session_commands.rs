// src-tauri/src/commands/session_commands.rs
use crate::core::session::{
    get_ui_session,
    save_ui_session,
    UiSession,
};

#[tauri::command]
pub async fn read_ui_session() -> Result<UiSession, String> {
    tauri::async_runtime::spawn_blocking(get_ui_session)
        .await
        .map_err(|error| format!("No se pudo leer la sesión UI: {error}"))?
}

#[tauri::command]
pub async fn write_ui_session(session: UiSession) -> Result<UiSession, String> {
    tauri::async_runtime::spawn_blocking(move || save_ui_session(session))
        .await
        .map_err(|error| format!("No se pudo guardar la sesión UI: {error}"))?
}