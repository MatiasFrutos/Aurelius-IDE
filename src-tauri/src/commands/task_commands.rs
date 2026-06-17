// src-tauri/src/commands/task_commands.rs
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskProblem {
    pub file: String,
    pub line: Option<u64>,
    pub column: Option<u64>,
    pub severity: String,
    pub message: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    pub ok: bool,
    pub task: String,
    pub command: String,
    pub cwd: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub problems: Vec<TaskProblem>,
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn has_cargo_toml(path: &Path) -> bool {
    path.join("Cargo.toml").is_file()
}

fn is_tauri_rust_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name == "src-tauri")
        .unwrap_or(false)
        && has_cargo_toml(path)
}

fn find_in_parents(start: &Path) -> Option<PathBuf> {
    let mut current = Some(start);

    while let Some(path) = current {
        let src_tauri = path.join("src-tauri");

        if has_cargo_toml(&src_tauri) {
            return Some(src_tauri);
        }

        if has_cargo_toml(path) {
            return Some(path.to_path_buf());
        }

        current = path.parent();
    }

    None
}

fn find_in_children(start: &Path, max_depth: usize) -> Option<PathBuf> {
    let mut queue = VecDeque::new();

    queue.push_back((start.to_path_buf(), 0usize));

    while let Some((path, depth)) = queue.pop_front() {
        if depth > max_depth {
            continue;
        }

        let src_tauri = path.join("src-tauri");

        if has_cargo_toml(&src_tauri) {
            return Some(src_tauri);
        }

        if is_tauri_rust_dir(&path) {
            return Some(path);
        }

        if has_cargo_toml(&path) {
            return Some(path);
        }

        if depth == max_depth {
            continue;
        }

        let Ok(entries) = std::fs::read_dir(&path) else {
            continue;
        };

        for entry in entries.flatten() {
            let child = entry.path();

            if !child.is_dir() {
                continue;
            }

            let name = child
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("");

            if matches!(
                name,
                "node_modules"
                    | "target"
                    | ".git"
                    | ".idea"
                    | ".vscode"
                    | "dist"
                    | "build"
                    | ".next"
                    | ".turbo"
            ) {
                continue;
            }

            queue.push_back((child, depth + 1));
        }
    }

    None
}

fn find_cargo_workdir(project_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path);

    if !root.exists() {
        return Err("La ruta del proyecto no existe.".to_string());
    }

    let root = if root.is_file() {
        root.parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "No se pudo resolver la carpeta del archivo.".to_string())?
    } else {
        root
    };

    if let Some(workdir) = find_in_parents(&root) {
        return Ok(workdir);
    }

    if let Some(workdir) = find_in_children(&root, 4) {
        return Ok(workdir);
    }

    Err(format!(
        "No encontré Cargo.toml cerca de '{}'. Abrí la carpeta raíz del proyecto o una carpeta que contenga src-tauri/Cargo.toml.",
        normalize_path(&root)
    ))
}

fn parse_rust_problem(line: &str, cwd: &Path) -> Option<TaskProblem> {
    let value: Value = serde_json::from_str(line).ok()?;

    if value.get("reason")?.as_str()? != "compiler-message" {
        return None;
    }

    let message = value.get("message")?;

    let level = message
        .get("level")
        .and_then(Value::as_str)
        .unwrap_or("info")
        .to_string();

    let text = message
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Diagnóstico Rust")
        .to_string();

    let spans = message.get("spans").and_then(Value::as_array);

    let primary_span = spans.and_then(|items| {
        items
            .iter()
            .find(|span| span.get("is_primary").and_then(Value::as_bool).unwrap_or(false))
            .or_else(|| items.first())
    });

    let Some(span) = primary_span else {
        return Some(TaskProblem {
            file: normalize_path(cwd),
            line: None,
            column: None,
            severity: level,
            message: text,
            source: "rustc".to_string(),
        });
    };

    let file_name = span
        .get("file_name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let line_start = span.get("line_start").and_then(Value::as_u64);
    let column_start = span.get("column_start").and_then(Value::as_u64);

    let mut file_path = PathBuf::from(&file_name);

    if file_path.is_relative() {
        file_path = cwd.join(file_path);
    }

    Some(TaskProblem {
        file: normalize_path(&file_path),
        line: line_start,
        column: column_start,
        severity: level,
        message: text,
        source: "rustc".to_string(),
    })
}

fn parse_rust_problems(stdout: &str, cwd: &Path) -> Vec<TaskProblem> {
    stdout
        .lines()
        .filter_map(|line| parse_rust_problem(line, cwd))
        .collect()
}

#[tauri::command]
pub async fn cargo_check_project(project_path: String) -> Result<TaskResult, String> {
    let cwd = find_cargo_workdir(&project_path)?;

    let output = Command::new("cargo")
        .arg("check")
        .arg("--message-format=json")
        .current_dir(&cwd)
        .output()
        .map_err(|error| format!("No se pudo ejecutar cargo check: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let problems = parse_rust_problems(&stdout, &cwd);

    Ok(TaskResult {
        ok: output.status.success(),
        task: "cargo-check".to_string(),
        command: "cargo check --message-format=json".to_string(),
        cwd: normalize_path(&cwd),
        exit_code: output.status.code(),
        stdout,
        stderr,
        problems,
    })
}

#[tauri::command]
pub async fn run_project_diagnostics(project_path: String) -> Result<TaskResult, String> {
    cargo_check_project(project_path).await
}