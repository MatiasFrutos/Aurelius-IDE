// src-tauri/src/commands/voice_commands.rs
use crate::core::voice::{
    cancel_recording, detect_tools, speak, start_recording, stop_recording, stop_speaking,
    transcribe, VoiceState, VoiceTools,
};
use tauri::State;

/// Qué herramientas de voz hay instaladas (grabador, sintetizador, transcriptor).
#[tauri::command]
pub async fn voice_tools() -> Result<VoiceTools, String> {
    tauri::async_runtime::spawn_blocking(detect_tools)
        .await
        .map_err(|error| format!("No se pudo detectar la voz: {error}"))
}

#[tauri::command]
pub async fn voice_record_start(state: State<'_, VoiceState>) -> Result<(), String> {
    start_recording(&state)
}

/// Detiene la grabación y devuelve el texto transcrito.
#[tauri::command]
pub async fn voice_record_stop(
    state: State<'_, VoiceState>,
    lang: String,
    model: Option<String>,
) -> Result<String, String> {
    let wav = stop_recording(&state)?;
    let model = model.unwrap_or_default();

    tauri::async_runtime::spawn_blocking(move || transcribe(&wav, &lang, &model))
        .await
        .map_err(|error| format!("Falló la transcripción: {error}"))?
}

#[tauri::command]
pub async fn voice_record_cancel(state: State<'_, VoiceState>) -> Result<(), String> {
    cancel_recording(&state);
    Ok(())
}

#[tauri::command]
pub async fn voice_speak(
    state: State<'_, VoiceState>,
    text: String,
    lang: String,
    rate: Option<f32>,
) -> Result<(), String> {
    speak(&state, &text, &lang, rate.unwrap_or(1.0))
}

#[tauri::command]
pub async fn voice_stop_speaking(state: State<'_, VoiceState>) -> Result<(), String> {
    stop_speaking(&state);
    Ok(())
}
