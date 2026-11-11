// src-tauri/src/commands/ai_commands.rs
use crate::core::ai_stream::{stream_chat, AiStreamEvent};
use crate::core::fs::AiChatRequest;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct AiStreams {
    handles: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
}

/// Inicia una respuesta en streaming y devuelve de inmediato. Los fragmentos llegan por el evento `ai:stream`.
#[tauri::command]
pub async fn chat_with_ai_stream(
    app: AppHandle,
    state: State<'_, AiStreams>,
    stream_id: String,
    request: AiChatRequest,
) -> Result<(), String> {
    let id = stream_id.trim().to_string();

    if id.is_empty() {
        return Err("El ID de streaming no puede estar vacío.".to_string());
    }

    let task_app = app.clone();
    let task_id = id.clone();

    let handle = tauri::async_runtime::spawn(async move {
        let emit_app = task_app.clone();

        stream_chat(&task_id, request, move |event: AiStreamEvent| {
            let _ = emit_app.emit("ai:stream", event);
        })
        .await;

        if let Some(streams) = task_app.try_state::<AiStreams>() {
            if let Ok(mut handles) = streams.handles.lock() {
                handles.remove(&task_id);
            }
        }
    });

    state
        .handles
        .lock()
        .map_err(|_| "No se pudo bloquear los streams de IA.".to_string())?
        .insert(id, handle);

    Ok(())
}

/// Cancela una respuesta en curso y notifica el cierre al frontend.
#[tauri::command]
pub async fn ai_cancel(
    app: AppHandle,
    state: State<'_, AiStreams>,
    stream_id: String,
) -> Result<(), String> {
    let handle = state
        .handles
        .lock()
        .map_err(|_| "No se pudo bloquear los streams de IA.".to_string())?
        .remove(stream_id.trim());

    if let Some(handle) = handle {
        handle.abort();
    }

    let _ = app.emit(
        "ai:stream",
        AiStreamEvent {
            id: stream_id,
            kind: "done".to_string(),
            text: String::new(),
        },
    );

    Ok(())
}
