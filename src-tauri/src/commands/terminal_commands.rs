// src-tauri/src/commands/terminal_commands.rs
use portable_pty::{
    native_pty_system,
    Child,
    CommandBuilder,
    MasterPty,
    PtySize,
};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

type PtyWriter = Box<dyn Write + Send>;
type PtyChild = Box<dyn Child + Send>;
type PtyMaster = Box<dyn MasterPty + Send>;

#[derive(Default)]
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

pub struct TerminalSession {
    writer: Arc<Mutex<PtyWriter>>,
    child: Arc<Mutex<PtyChild>>,
    master: Arc<Mutex<PtyMaster>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminalOutputPayload {
    id: String,
    data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminalExitPayload {
    id: String,
    message: String,
}

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const MIN_COLS: u16 = 20;
const MIN_ROWS: u16 = 5;
const MAX_COLS: u16 = 300;
const MAX_ROWS: u16 = 120;

#[tauri::command]
pub async fn terminal_spawn(
    app: AppHandle,
    state: State<'_, TerminalManager>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let shell = resolve_shell();
    let working_dir = resolve_cwd(cwd)?;

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: normalize_rows(rows),
            cols: normalize_cols(cols),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("No se pudo abrir PTY: {error}"))?;

    let mut command = CommandBuilder::new(shell);

    if let Some(cwd_path) = working_dir {
        command.cwd(cwd_path);
    }

    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("AURELIUS_IDE", "1");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("No se pudo iniciar shell: {error}"))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("No se pudo clonar reader PTY: {error}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("No se pudo crear writer PTY: {error}"))?;

    let session = TerminalSession {
        writer: Arc::new(Mutex::new(writer)),
        child: Arc::new(Mutex::new(child)),
        master: Arc::new(Mutex::new(pair.master)),
    };

    {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "No se pudo bloquear sesiones de terminal.".to_string())?;

        sessions.insert(id.clone(), session);
    }

    let app_reader = app.clone();
    let reader_id = id.clone();

    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    let _ = app_reader.emit(
                        "terminal:exit",
                        TerminalExitPayload {
                            id: reader_id.clone(),
                            message: "Terminal cerrada.".to_string(),
                        },
                    );

                    break;
                }
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();

                    let _ = app_reader.emit(
                        "terminal:output",
                        TerminalOutputPayload {
                            id: reader_id.clone(),
                            data,
                        },
                    );
                }
                Err(error) => {
                    let _ = app_reader.emit(
                        "terminal:exit",
                        TerminalExitPayload {
                            id: reader_id.clone(),
                            message: format!("Terminal finalizada: {error}"),
                        },
                    );

                    break;
                }
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn terminal_write(
    state: State<'_, TerminalManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    let terminal_id = validate_terminal_id(id)?;

    if data.is_empty() {
        return Ok(());
    }

    let writer = {
        let sessions = state
            .sessions
            .lock()
            .map_err(|_| "No se pudo bloquear sesiones de terminal.".to_string())?;

        let session = sessions
            .get(&terminal_id)
            .ok_or_else(|| "No existe la sesión de terminal.".to_string())?;

        session.writer.clone()
    };

    let mut writer = writer
        .lock()
        .map_err(|_| "No se pudo bloquear writer de terminal.".to_string())?;

    writer
        .write_all(data.as_bytes())
        .map_err(|error| format!("No se pudo escribir en terminal: {error}"))?;

    writer
        .flush()
        .map_err(|error| format!("No se pudo refrescar terminal: {error}"))?;

    Ok(())
}

#[tauri::command]
pub async fn terminal_resize(
    state: State<'_, TerminalManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let terminal_id = validate_terminal_id(id)?;

    let master = {
        let sessions = state
            .sessions
            .lock()
            .map_err(|_| "No se pudo bloquear sesiones de terminal.".to_string())?;

        let session = sessions
            .get(&terminal_id)
            .ok_or_else(|| "No existe la sesión de terminal.".to_string())?;

        session.master.clone()
    };

    let master = master
        .lock()
        .map_err(|_| "No se pudo bloquear master PTY.".to_string())?;

    master
        .resize(PtySize {
            rows: normalize_rows(Some(rows)),
            cols: normalize_cols(Some(cols)),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("No se pudo redimensionar terminal: {error}"))?;

    Ok(())
}

#[tauri::command]
pub async fn terminal_kill(
    state: State<'_, TerminalManager>,
    id: String,
) -> Result<(), String> {
    let terminal_id = validate_terminal_id(id)?;

    let session = {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "No se pudo bloquear sesiones de terminal.".to_string())?;

        sessions.remove(&terminal_id)
    };

    if let Some(session) = session {
        let mut child = session
            .child
            .lock()
            .map_err(|_| "No se pudo bloquear proceso de terminal.".to_string())?;

        child
            .kill()
            .map_err(|error| format!("No se pudo cerrar terminal: {error}"))?;
    }

    Ok(())
}

fn resolve_shell() -> String {
    let shell = std::env::var("SHELL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "/bin/bash".to_string());

    let shell_path = PathBuf::from(&shell);

    if shell_path.exists() && shell_path.is_file() {
        return shell;
    }

    if PathBuf::from("/bin/bash").exists() {
        return "/bin/bash".to_string();
    }

    if PathBuf::from("/usr/bin/bash").exists() {
        return "/usr/bin/bash".to_string();
    }

    if PathBuf::from("/bin/sh").exists() {
        return "/bin/sh".to_string();
    }

    shell
}

fn resolve_cwd(cwd: Option<String>) -> Result<Option<PathBuf>, String> {
    let Some(cwd_value) = cwd else {
        return Ok(None);
    };

    let clean = cwd_value.trim();

    if clean.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(clean);

    if !path.exists() {
        return Err("La carpeta de la terminal no existe.".to_string());
    }

    if !path.is_dir() {
        return Err("La ruta de la terminal no es una carpeta.".to_string());
    }

    path.canonicalize()
        .map(Some)
        .map_err(|error| format!("No se pudo resolver la carpeta de terminal: {error}"))
}

fn validate_terminal_id(id: String) -> Result<String, String> {
    let clean = id.trim().to_string();

    if clean.is_empty() {
        return Err("El ID de terminal no puede estar vacío.".to_string());
    }

    Ok(clean)
}

fn normalize_cols(cols: Option<u16>) -> u16 {
    cols.unwrap_or(DEFAULT_COLS).clamp(MIN_COLS, MAX_COLS)
}

fn normalize_rows(rows: Option<u16>) -> u16 {
    rows.unwrap_or(DEFAULT_ROWS).clamp(MIN_ROWS, MAX_ROWS)
}