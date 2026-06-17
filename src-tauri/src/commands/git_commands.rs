// src-tauri/src/commands/git_commands.rs
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub original_path: Option<String>,
    pub index_status: String,
    pub worktree_status: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub ok: bool,
    pub is_repo: bool,
    pub root: Option<String>,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u64,
    pub behind: u64,
    pub files: Vec<GitFileStatus>,
    pub commits: Vec<GitCommit>,
    pub message: String,
}

#[tauri::command]
pub async fn git_status_project(project_path: String) -> Result<GitStatusResult, String> {
    tauri::async_runtime::spawn_blocking(move || read_git_status(project_path))
        .await
        .map_err(|error| format!("No se pudo leer estado Git: {error}"))?
}

#[tauri::command]
pub async fn git_refresh_project(project_path: String) -> Result<GitStatusResult, String> {
    git_status_project(project_path).await
}

fn read_git_status(project_path: String) -> Result<GitStatusResult, String> {
    let root = match find_git_root(&project_path) {
        Ok(value) => value,
        Err(message) => {
            return Ok(GitStatusResult {
                ok: true,
                is_repo: false,
                root: None,
                branch: None,
                upstream: None,
                ahead: 0,
                behind: 0,
                files: Vec::new(),
                commits: Vec::new(),
                message,
            });
        }
    };

    let status_output = command_output_bytes(
        Command::new("git")
            .arg("status")
            .arg("--porcelain=v1")
            .arg("--branch")
            .arg("-z")
            .current_dir(&root),
    )?;

    let (branch, upstream, ahead, behind, files) = parse_status_output(&status_output);

    let commits_output = Command::new("git")
        .arg("log")
        .arg("--oneline")
        .arg("-n")
        .arg("12")
        .current_dir(&root)
        .output();

    let commits = match commits_output {
        Ok(output) if output.status.success() => {
            parse_commits(&String::from_utf8_lossy(&output.stdout))
        }
        _ => Vec::new(),
    };

    Ok(GitStatusResult {
        ok: true,
        is_repo: true,
        root: Some(normalize_path(&root)),
        branch,
        upstream,
        ahead,
        behind,
        files,
        commits,
        message: "Git status cargado correctamente.".to_string(),
    })
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn command_output(command: &mut Command) -> Result<String, String> {
    let output = command
        .output()
        .map_err(|error| format!("No se pudo ejecutar comando git: {error}"))?;

    if !output.status.success() {
        return Err(read_command_error(&output.stdout, &output.stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn command_output_bytes(command: &mut Command) -> Result<Vec<u8>, String> {
    let output = command
        .output()
        .map_err(|error| format!("No se pudo ejecutar comando git: {error}"))?;

    if !output.status.success() {
        return Err(read_command_error(&output.stdout, &output.stderr));
    }

    Ok(output.stdout)
}

fn read_command_error(stdout: &[u8], stderr: &[u8]) -> String {
    let stderr_text = String::from_utf8_lossy(stderr).trim().to_string();
    let stdout_text = String::from_utf8_lossy(stdout).trim().to_string();

    if !stderr_text.is_empty() {
        return stderr_text;
    }

    if !stdout_text.is_empty() {
        return stdout_text;
    }

    "Git devolvió un error desconocido.".to_string()
}

fn resolve_existing_dir(project_path: &str) -> Result<PathBuf, String> {
    let clean = project_path.trim();

    if clean.is_empty() {
        return Err("La ruta del proyecto está vacía.".to_string());
    }

    let path = PathBuf::from(clean);

    if !path.exists() {
        return Err("La ruta del proyecto no existe.".to_string());
    }

    if path.is_file() {
        return path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "No se pudo resolver la carpeta del archivo.".to_string());
    }

    Ok(path)
}

fn find_git_root(project_path: &str) -> Result<PathBuf, String> {
    let cwd = resolve_existing_dir(project_path)?;

    let root = command_output(
        Command::new("git")
            .arg("rev-parse")
            .arg("--show-toplevel")
            .current_dir(&cwd),
    )
    .map_err(|_| "La carpeta abierta no parece ser un repositorio Git.".to_string())?;

    let clean_root = root.trim();

    if clean_root.is_empty() {
        return Err("Git no devolvió la raíz del repositorio.".to_string());
    }

    Ok(PathBuf::from(clean_root))
}

fn parse_status_output(output: &[u8]) -> (Option<String>, Option<String>, u64, u64, Vec<GitFileStatus>) {
    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0_u64;
    let mut behind = 0_u64;
    let mut files = Vec::new();

    let entries: Vec<String> = output
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(|part| String::from_utf8_lossy(part).to_string())
        .collect();

    let mut index = 0;

    while index < entries.len() {
        let entry = entries[index].as_str();

        if entry.starts_with("##") {
            let parsed = parse_branch_line(entry);
            branch = parsed.0;
            upstream = parsed.1;
            ahead = parsed.2;
            behind = parsed.3;
            index += 1;
            continue;
        }

        if let Some(file) = parse_status_entry(entry, entries.get(index + 1)) {
            let is_rename_or_copy =
                file.index_status == "R" ||
                file.worktree_status == "R" ||
                file.index_status == "C" ||
                file.worktree_status == "C";

            files.push(file);

            if is_rename_or_copy {
                index += 2;
            } else {
                index += 1;
            }

            continue;
        }

        index += 1;
    }

    (branch, upstream, ahead, behind, files)
}

fn parse_branch_line(line: &str) -> (Option<String>, Option<String>, u64, u64) {
    let clean = line.trim_start_matches("##").trim();

    if clean.starts_with("No commits yet on ") {
        let branch_name = clean
            .trim_start_matches("No commits yet on ")
            .trim()
            .to_string();

        return (Some(branch_name), None, 0, 0);
    }

    if clean.starts_with("HEAD detached") {
        return (Some("HEAD detached".to_string()), None, 0, 0);
    }

    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0_u64;
    let mut behind = 0_u64;

    let mut branch_part = clean;
    let mut meta_part = "";

    if let Some((left, meta)) = clean.split_once('[') {
        branch_part = left.trim();
        meta_part = meta.trim_end_matches(']').trim();
    }

    if let Some((local, remote)) = branch_part.split_once("...") {
        let local_branch = local.trim();
        let remote_branch = remote.trim();

        if !local_branch.is_empty() {
            branch = Some(local_branch.to_string());
        }

        if !remote_branch.is_empty() {
            upstream = Some(remote_branch.to_string());
        }
    } else if !branch_part.trim().is_empty() {
        branch = Some(branch_part.trim().to_string());
    }

    for piece in meta_part.split(',') {
        let item = piece.trim();

        if let Some(value) = item.strip_prefix("ahead ") {
            ahead = value.parse::<u64>().unwrap_or(0);
        }

        if let Some(value) = item.strip_prefix("behind ") {
            behind = value.parse::<u64>().unwrap_or(0);
        }
    }

    (branch, upstream, ahead, behind)
}

fn parse_status_entry(entry: &str, next_entry: Option<&String>) -> Option<GitFileStatus> {
    if entry.len() < 4 {
        return None;
    }

    let index_status = entry.chars().nth(0).unwrap_or(' ').to_string();
    let worktree_status = entry.chars().nth(1).unwrap_or(' ').to_string();

    let raw_path = entry.get(3..)?.trim();

    if raw_path.is_empty() {
        return None;
    }

    let is_rename_or_copy =
        index_status == "R" ||
        worktree_status == "R" ||
        index_status == "C" ||
        worktree_status == "C";

    let (original_path, path) = if is_rename_or_copy {
        (
            next_entry.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
            raw_path.to_string(),
        )
    } else {
        (None, raw_path.to_string())
    };

    Some(GitFileStatus {
        path,
        original_path,
        index_status: index_status.clone(),
        worktree_status: worktree_status.clone(),
        status: friendly_status(&index_status, &worktree_status),
    })
}

fn friendly_status(index_status: &str, worktree_status: &str) -> String {
    let pair = format!("{index_status}{worktree_status}");

    if pair == "??" {
        return "untracked".to_string();
    }

    if pair.contains('U') {
        return "conflict".to_string();
    }

    if pair.contains('D') {
        return "deleted".to_string();
    }

    if pair.contains('R') {
        return "renamed".to_string();
    }

    if pair.contains('C') {
        return "copied".to_string();
    }

    if pair.contains('A') {
        return "added".to_string();
    }

    if pair.contains('M') {
        return "modified".to_string();
    }

    "changed".to_string()
}

fn parse_commits(stdout: &str) -> Vec<GitCommit> {
    stdout
        .lines()
        .filter_map(|line| {
            let clean = line.trim();

            if clean.is_empty() {
                return None;
            }

            let mut parts = clean.splitn(2, ' ');
            let hash = parts.next().unwrap_or("").trim().to_string();
            let message = parts.next().unwrap_or("").trim().to_string();

            if hash.is_empty() {
                return None;
            }

            Some(GitCommit { hash, message })
        })
        .collect()
}