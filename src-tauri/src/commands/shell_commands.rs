// src-tauri/src/commands/shell_commands.rs
use crate::core::shell::{
    probe_tools, read_system_details, run_git, CommandOutput, SystemDetails, ToolProbe,
};

/// Ejecuta un subcomando de Git permitido en la carpeta del proyecto (diff, add, commit, branch…).
#[tauri::command]
pub async fn git_run(project_path: String, args: Vec<String>) -> Result<CommandOutput, String> {
    tauri::async_runtime::spawn_blocking(move || run_git(&project_path, &args))
        .await
        .map_err(|error| format!("No se pudo ejecutar Git: {error}"))?
}

/// Comprueba si herramientas conocidas están instaladas y devuelve su versión.
#[tauri::command]
pub async fn probe_tool_versions(names: Vec<String>) -> Result<Vec<ToolProbe>, String> {
    tauri::async_runtime::spawn_blocking(move || probe_tools(&names))
        .await
        .map_err(|error| format!("No se pudo sondear herramientas: {error}"))
}

/// Procesos principales, discos, red, batería y uptime.
#[tauri::command]
pub async fn read_system_details_snapshot() -> Result<SystemDetails, String> {
    tauri::async_runtime::spawn_blocking(read_system_details)
        .await
        .map_err(|error| format!("No se pudo leer el sistema: {error}"))?
}
