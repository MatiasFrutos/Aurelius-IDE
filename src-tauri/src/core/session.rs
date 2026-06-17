// src-tauri/src/core/session.rs
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UiSessionTab {
    pub path: String,
    pub cursor_line: u32,
    pub cursor_column: u32,
    pub is_dirty: bool,
}

impl Default for UiSessionTab {
    fn default() -> Self {
        Self {
            path: String::new(),
            cursor_line: 1,
            cursor_column: 1,
            is_dirty: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UiSession {
    pub activity_panel: String,
    pub topbar_visible: bool,
    pub sidebar_visible: bool,
    pub right_panel_visible: bool,
    pub bottom_panel_visible: bool,
    pub sidebar_width: u16,
    pub right_panel_width: u16,
    pub bottom_panel_height: u16,
    pub active_right_panel: String,
    pub active_bottom_panel: String,

    pub project_path: Option<String>,
    pub active_file_path: Option<String>,
    pub open_tabs: Vec<UiSessionTab>,
    pub expanded_folders: Vec<String>,
}

impl Default for UiSession {
    fn default() -> Self {
        Self {
            activity_panel: "explorer".to_string(),
            topbar_visible: true,
            sidebar_visible: true,
            right_panel_visible: true,
            bottom_panel_visible: true,
            sidebar_width: 286,
            right_panel_width: 360,
            bottom_panel_height: 220,
            active_right_panel: "ai".to_string(),
            active_bottom_panel: "terminal".to_string(),

            project_path: None,
            active_file_path: None,
            open_tabs: Vec::new(),
            expanded_folders: Vec::new(),
        }
    }
}

pub fn get_ui_session() -> Result<UiSession, String> {
    let path = session_path()?;

    if !path.exists() {
        let session = UiSession::default();
        save_ui_session(session.clone())?;
        return Ok(session);
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("No se pudo leer session.json. Detalle: {}", error))?;

    if content.trim().is_empty() {
        let session = UiSession::default();
        save_ui_session(session.clone())?;
        return Ok(session);
    }

    let session: UiSession = serde_json::from_str(&content).unwrap_or_default();
    let normalized = normalize_ui_session(session);

    save_ui_session(normalized.clone())?;

    Ok(normalized)
}

pub fn save_ui_session(session: UiSession) -> Result<UiSession, String> {
    let normalized = normalize_ui_session(session);
    let path = session_path()?;

    let content = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("No se pudo serializar session.json. Detalle: {}", error))?;

    fs::write(&path, content)
        .map_err(|error| format!("No se pudo escribir session.json. Detalle: {}", error))?;

    Ok(normalized)
}

fn normalize_ui_session(session: UiSession) -> UiSession {
    let activity_panel = match session.activity_panel.as_str() {
        "explorer" => "explorer",
        "search" => "search",
        "git" => "git",
        "monitor" => "monitor",
        "tasks" => "tasks",
        "toolchain" => "toolchain",
        "ai" => "ai",
        "settings" => "settings",
        _ => "explorer",
    }
    .to_string();

    let active_right_panel = match session.active_right_panel.as_str() {
        "ai" => "ai",
        _ => "ai",
    }
    .to_string();

    let active_bottom_panel = match session.active_bottom_panel.as_str() {
        "terminal" => "terminal",
        "problems" => "problems",
        "output" => "output",
        "logs" => "logs",
        _ => "terminal",
    }
    .to_string();

    let project_path = normalize_optional_path(session.project_path);
    let active_file_path = normalize_optional_path(session.active_file_path);

    let open_tabs = session
        .open_tabs
        .into_iter()
        .filter_map(normalize_session_tab)
        .take(24)
        .collect();

    let expanded_folders = session
        .expanded_folders
        .into_iter()
        .map(normalize_path_string)
        .filter(|path| !path.is_empty())
        .take(300)
        .collect();

    UiSession {
        activity_panel,
        topbar_visible: session.topbar_visible,
        sidebar_visible: session.sidebar_visible,
        right_panel_visible: session.right_panel_visible,
        bottom_panel_visible: session.bottom_panel_visible,
        sidebar_width: session.sidebar_width.clamp(220, 460),
        right_panel_width: session.right_panel_width.clamp(280, 620),
        bottom_panel_height: session.bottom_panel_height.clamp(140, 420),
        active_right_panel,
        active_bottom_panel,
        project_path,
        active_file_path,
        open_tabs,
        expanded_folders,
    }
}

fn normalize_session_tab(tab: UiSessionTab) -> Option<UiSessionTab> {
    let path = normalize_path_string(tab.path);

    if path.is_empty() {
        return None;
    }

    Some(UiSessionTab {
        path,
        cursor_line: tab.cursor_line.max(1),
        cursor_column: tab.cursor_column.max(1),
        is_dirty: tab.is_dirty,
    })
}

fn normalize_optional_path(path: Option<String>) -> Option<String> {
    path.map(normalize_path_string)
        .filter(|value| !value.is_empty())
}

fn normalize_path_string(path: String) -> String {
    path.trim().replace('\\', "/")
}

fn config_dir() -> Result<PathBuf, String> {
    let home = env::var("HOME")
        .map_err(|_| "No se pudo detectar HOME para guardar configuración.".to_string())?;

    let dir = PathBuf::from(home).join(".config").join("aurelius-ide");

    fs::create_dir_all(&dir)
        .map_err(|error| format!("No se pudo crear ~/.config/aurelius-ide. Detalle: {}", error))?;

    Ok(dir)
}

fn session_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("session.json"))
}