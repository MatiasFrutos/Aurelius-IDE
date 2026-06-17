// src-tauri/src/commands/project_tools_commands.rs
use crate::core::project_tools::{
    read_project_tasks as read_project_tasks_core,
    read_toolchain_doctor as read_toolchain_doctor_core,
    run_project_task as run_project_task_core,
    ProjectTask,
    ProjectTaskRunResult,
    ToolchainItem,
};

#[tauri::command]
pub async fn read_project_tasks(project_path: String) -> Result<Vec<ProjectTask>, String> {
    tauri::async_runtime::spawn_blocking(move || read_project_tasks_core(project_path))
        .await
        .map_err(|error| format!("No se pudo leer comandos del proyecto: {error}"))?
}

#[tauri::command]
pub async fn run_project_task(
    command: String,
    cwd: String,
) -> Result<ProjectTaskRunResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_project_task_core(command, cwd))
        .await
        .map_err(|error| format!("No se pudo ejecutar comando del proyecto: {error}"))?
}

#[tauri::command]
pub async fn read_toolchain_doctor() -> Result<Vec<ToolchainItem>, String> {
    tauri::async_runtime::spawn_blocking(read_toolchain_doctor_core)
        .await
        .map_err(|error| format!("No se pudo revisar el entorno Linux: {error}"))?
}