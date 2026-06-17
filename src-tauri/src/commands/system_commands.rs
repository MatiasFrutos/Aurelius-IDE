// src-tauri/src/commands/system_commands.rs
use crate::core::system::{get_monitor_snapshot, MonitorSnapshot};

#[tauri::command]
pub async fn read_monitor_snapshot() -> Result<MonitorSnapshot, String> {
    get_monitor_snapshot()
}