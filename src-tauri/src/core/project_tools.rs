// src-tauri/src/core/project_tools.rs
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct ProjectTask {
    pub id: String,
    pub group: String,
    pub label: String,
    pub command: String,
    pub cwd: String,
    pub icon: String,
    pub long_running: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectTaskRunResult {
    pub ok: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolchainItem {
    pub id: String,
    pub label: String,
    pub status: String,
    pub version: String,
    pub detail: String,
    pub ok: bool,
    pub icon: String,
}

pub fn read_project_tasks(project_path: String) -> Result<Vec<ProjectTask>, String> {
    let root = resolve_project_root(&project_path)?;
    let mut tasks = Vec::new();

    for workspace in find_candidate_workspaces(&root) {
        tasks.extend(read_node_tasks(&workspace, &root));
        tasks.extend(read_rust_tasks(&workspace, &root));
        tasks.extend(read_docker_tasks(&workspace, &root));
        tasks.extend(read_make_tasks(&workspace, &root));
    }

    Ok(dedupe_tasks(tasks))
}

pub fn run_project_task(command: String, cwd: String) -> Result<ProjectTaskRunResult, String> {
    let clean_command = command.trim();

    if clean_command.is_empty() {
        return Err("El comando está vacío.".to_string());
    }

    let cwd_path = resolve_command_cwd(&cwd)?;

    let output = Command::new("sh")
        .arg("-lc")
        .arg(clean_command)
        .current_dir(cwd_path)
        .env("TERM", "xterm-256color")
        .env("AURELIUS_IDE", "1")
        .output()
        .map_err(|error| format!("No se pudo ejecutar el comando. Detalle: {error}"))?;

    Ok(ProjectTaskRunResult {
        ok: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub fn read_toolchain_doctor() -> Result<Vec<ToolchainItem>, String> {
    let mut items = Vec::new();

    items.push(check_version_command(
        "node",
        "Node.js",
        "node",
        &["--version"],
        "Runtime para proyectos JavaScript.",
        "terminal",
    ));

    items.push(check_version_command(
        "npm",
        "npm",
        "npm",
        &["--version"],
        "Gestor de paquetes Node.",
        "terminal",
    ));

    items.push(check_version_command(
        "pnpm",
        "pnpm",
        "pnpm",
        &["--version"],
        "Gestor de paquetes Node rápido.",
        "terminal",
    ));

    items.push(check_version_command(
        "yarn",
        "Yarn",
        "yarn",
        &["--version"],
        "Gestor de paquetes Node alternativo.",
        "terminal",
    ));

    items.push(check_version_command(
        "rustc",
        "Rust",
        "rustc",
        &["--version"],
        "Compilador Rust.",
        "cpu",
    ));

    items.push(check_version_command(
        "cargo",
        "Cargo",
        "cargo",
        &["--version"],
        "Gestor de proyectos Rust.",
        "cpu",
    ));

    items.push(check_version_command(
        "git",
        "Git",
        "git",
        &["--version"],
        "Control de versiones.",
        "git-branch",
    ));

    items.push(check_version_command(
        "make",
        "Make",
        "make",
        &["--version"],
        "Runner clásico de comandos Makefile.",
        "terminal",
    ));

    items.push(check_version_command(
        "docker-compose",
        "Docker Compose legacy",
        "docker-compose",
        &["--version"],
        "Docker Compose con binario docker-compose.",
        "database",
    ));

    items.push(check_docker());
    items.push(check_docker_compose_plugin());
    items.push(check_git_config("git-user-name", "Git user.name", "user.name"));
    items.push(check_git_config("git-user-email", "Git user.email", "user.email"));

    Ok(items)
}

fn resolve_project_root(project_path: &str) -> Result<PathBuf, String> {
    let clean = project_path.trim();

    if clean.is_empty() {
        return Err("La ruta del proyecto está vacía.".to_string());
    }

    let root = PathBuf::from(clean);

    if !root.exists() {
        return Err("El proyecto no existe o no está disponible.".to_string());
    }

    if !root.is_dir() {
        return Err("La ruta seleccionada no es una carpeta de proyecto.".to_string());
    }

    root.canonicalize()
        .map_err(|error| format!("No se pudo resolver el proyecto: {error}"))
}

fn resolve_command_cwd(cwd: &str) -> Result<PathBuf, String> {
    let clean = cwd.trim();

    if clean.is_empty() {
        return Err("La carpeta de ejecución está vacía.".to_string());
    }

    let cwd_path = PathBuf::from(clean);

    if !cwd_path.exists() {
        return Err("La carpeta de ejecución no existe.".to_string());
    }

    if !cwd_path.is_dir() {
        return Err("La ruta de ejecución no es una carpeta.".to_string());
    }

    cwd_path
        .canonicalize()
        .map_err(|error| format!("No se pudo resolver la carpeta de ejecución: {error}"))
}

fn find_candidate_workspaces(root: &Path) -> Vec<PathBuf> {
    let mut workspaces = Vec::new();
    let mut seen = HashSet::new();

    push_workspace(&mut workspaces, &mut seen, root.to_path_buf());

    let common_dirs = [
        "backend",
        "frontend",
        "front",
        "client",
        "server",
        "api",
        "app",
        "apps",
        "web",
        "site",
        "admin",
        "dashboard",
        "src-tauri",
    ];

    for dir in common_dirs {
        let candidate = root.join(dir);

        if candidate.exists() && candidate.is_dir() {
            push_workspace(&mut workspaces, &mut seen, candidate.clone());

            if dir == "apps" {
                if let Ok(entries) = fs::read_dir(candidate) {
                    for entry in entries.flatten() {
                        let path = entry.path();

                        if path.is_dir() {
                            push_workspace(&mut workspaces, &mut seen, path);
                        }
                    }
                }
            }
        }
    }

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            if should_ignore_workspace_dir(&path) {
                continue;
            }

            if path.join("package.json").exists()
                || path.join("Cargo.toml").exists()
                || path.join("Makefile").exists()
                || has_compose_file(&path)
            {
                push_workspace(&mut workspaces, &mut seen, path);
            }
        }
    }

    workspaces
}

fn push_workspace(workspaces: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    let Ok(canonical) = path.canonicalize() else {
        return;
    };

    let key = canonical.to_string_lossy().to_string();

    if seen.insert(key) {
        workspaces.push(canonical);
    }
}

fn should_ignore_workspace_dir(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    matches!(
        name.as_str(),
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".svelte-kit"
            | "coverage"
            | ".cache"
            | ".vite"
    )
}

fn dedupe_tasks(tasks: Vec<ProjectTask>) -> Vec<ProjectTask> {
    let mut seen = HashSet::new();
    let mut output = Vec::new();

    for task in tasks {
        let key = format!("{}::{}::{}", task.cwd, task.group, task.command);

        if seen.insert(key) {
            output.push(task);
        }
    }

    output
}

fn read_node_tasks(workspace: &Path, root: &Path) -> Vec<ProjectTask> {
    let package_path = workspace.join("package.json");

    if !package_path.exists() {
        return Vec::new();
    }

    let Ok(content) = fs::read_to_string(package_path) else {
        return Vec::new();
    };

    let Ok(json) = serde_json::from_str::<Value>(&content) else {
        return Vec::new();
    };

    let Some(scripts) = json.get("scripts").and_then(|value| value.as_object()) else {
        return Vec::new();
    };

    let package_manager = detect_package_manager(workspace);
    let workspace_label = get_workspace_label(workspace, root);
    let mut tasks = Vec::new();

    for (script_name, script_value) in scripts {
        if !script_value.is_string() {
            continue;
        }

        let command = build_node_script_command(&package_manager, script_name);
        let script_body = script_value.as_str().unwrap_or("");
        let is_long_running = is_long_running_script(script_name) || is_long_running_command(script_body);

        tasks.push(ProjectTask {
            id: format!(
                "node-{}-{}-{}",
                sanitize_id(&workspace_label),
                sanitize_id(&package_manager),
                sanitize_id(script_name)
            ),
            group: format!("Node · {workspace_label}"),
            label: command.clone(),
            command,
            cwd: workspace.to_string_lossy().to_string(),
            icon: "terminal".to_string(),
            long_running: is_long_running,
        });
    }

    tasks.sort_by(|left, right| left.label.cmp(&right.label));
    tasks
}

fn detect_package_manager(workspace: &Path) -> String {
    if workspace.join("pnpm-lock.yaml").exists() {
        return "pnpm".to_string();
    }

    if workspace.join("yarn.lock").exists() {
        return "yarn".to_string();
    }

    "npm".to_string()
}

fn build_node_script_command(package_manager: &str, script_name: &str) -> String {
    match package_manager {
        "pnpm" => format!("pnpm run {script_name}"),
        "yarn" => format!("yarn {script_name}"),
        _ => format!("npm run {script_name}"),
    }
}

fn read_rust_tasks(workspace: &Path, root: &Path) -> Vec<ProjectTask> {
    if !workspace.join("Cargo.toml").exists() {
        return Vec::new();
    }

    let workspace_label = get_workspace_label(workspace, root);

    vec![
        ProjectTask {
            id: format!("rust-{}-cargo-check", sanitize_id(&workspace_label)),
            group: format!("Rust · {workspace_label}"),
            label: "cargo check".to_string(),
            command: "cargo check".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "cpu".to_string(),
            long_running: false,
        },
        ProjectTask {
            id: format!("rust-{}-cargo-test", sanitize_id(&workspace_label)),
            group: format!("Rust · {workspace_label}"),
            label: "cargo test".to_string(),
            command: "cargo test".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "cpu".to_string(),
            long_running: false,
        },
        ProjectTask {
            id: format!("rust-{}-cargo-run", sanitize_id(&workspace_label)),
            group: format!("Rust · {workspace_label}"),
            label: "cargo run".to_string(),
            command: "cargo run".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "cpu".to_string(),
            long_running: true,
        },
    ]
}

fn read_docker_tasks(workspace: &Path, root: &Path) -> Vec<ProjectTask> {
    if !has_compose_file(workspace) {
        return Vec::new();
    }

    let workspace_label = get_workspace_label(workspace, root);

    vec![
        ProjectTask {
            id: format!("docker-{}-compose-up", sanitize_id(&workspace_label)),
            group: format!("Docker · {workspace_label}"),
            label: "docker compose up".to_string(),
            command: "docker compose up".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "database".to_string(),
            long_running: true,
        },
        ProjectTask {
            id: format!("docker-{}-compose-up-detached", sanitize_id(&workspace_label)),
            group: format!("Docker · {workspace_label}"),
            label: "docker compose up -d".to_string(),
            command: "docker compose up -d".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "database".to_string(),
            long_running: false,
        },
        ProjectTask {
            id: format!("docker-{}-compose-down", sanitize_id(&workspace_label)),
            group: format!("Docker · {workspace_label}"),
            label: "docker compose down".to_string(),
            command: "docker compose down".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "database".to_string(),
            long_running: false,
        },
        ProjectTask {
            id: format!("docker-{}-compose-ps", sanitize_id(&workspace_label)),
            group: format!("Docker · {workspace_label}"),
            label: "docker compose ps".to_string(),
            command: "docker compose ps".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "database".to_string(),
            long_running: false,
        },
        ProjectTask {
            id: format!("docker-{}-compose-logs", sanitize_id(&workspace_label)),
            group: format!("Docker · {workspace_label}"),
            label: "docker compose logs -f".to_string(),
            command: "docker compose logs -f".to_string(),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "database".to_string(),
            long_running: true,
        },
    ]
}

fn read_make_tasks(workspace: &Path, root: &Path) -> Vec<ProjectTask> {
    let makefile_path = workspace.join("Makefile");

    if !makefile_path.exists() {
        return Vec::new();
    }

    let Ok(content) = fs::read_to_string(makefile_path) else {
        return Vec::new();
    };

    let workspace_label = get_workspace_label(workspace, root);
    let mut tasks = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty()
            || trimmed.starts_with('#')
            || trimmed.starts_with('.')
            || trimmed.starts_with('\t')
        {
            continue;
        }

        if !trimmed.contains(':') || trimmed.contains('=') {
            continue;
        }

        let target = trimmed.split(':').next().unwrap_or("").trim();

        if target.is_empty()
            || target.contains(' ')
            || target.contains('\t')
            || target.contains('/')
            || target.contains('$')
        {
            continue;
        }

        tasks.push(ProjectTask {
            id: format!("make-{}-{}", sanitize_id(&workspace_label), sanitize_id(target)),
            group: format!("Make · {workspace_label}"),
            label: format!("make {target}"),
            command: format!("make {target}"),
            cwd: workspace.to_string_lossy().to_string(),
            icon: "terminal".to_string(),
            long_running: is_long_running_script(target),
        });
    }

    tasks
}

fn has_compose_file(path: &Path) -> bool {
    let compose_files = [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
    ];

    compose_files.iter().any(|name| path.join(name).exists())
}

fn get_workspace_label(workspace: &Path, root: &Path) -> String {
    if workspace == root {
        return "root".to_string();
    }

    workspace
        .strip_prefix(root)
        .ok()
        .and_then(|relative| {
            let value = relative.to_string_lossy().replace('\\', "/");

            if value.trim().is_empty() {
                None
            } else {
                Some(value)
            }
        })
        .unwrap_or_else(|| {
            workspace
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| "workspace".to_string())
        })
}

fn check_version_command(
    id: &str,
    label: &str,
    program: &str,
    args: &[&str],
    detail: &str,
    icon: &str,
) -> ToolchainItem {
    match Command::new(program).args(args).output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let version = if stdout.is_empty() { stderr } else { stdout };

            ToolchainItem {
                id: id.to_string(),
                label: label.to_string(),
                status: "OK".to_string(),
                version: if version.is_empty() {
                    "Disponible".to_string()
                } else {
                    first_line(&version)
                },
                detail: detail.to_string(),
                ok: true,
                icon: icon.to_string(),
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            ToolchainItem {
                id: id.to_string(),
                label: label.to_string(),
                status: "Error".to_string(),
                version: "No disponible".to_string(),
                detail: if stderr.is_empty() {
                    format!("{label} respondió con error.")
                } else {
                    first_line(&stderr)
                },
                ok: false,
                icon: icon.to_string(),
            }
        }
        Err(_) => ToolchainItem {
            id: id.to_string(),
            label: label.to_string(),
            status: "No instalado".to_string(),
            version: "No encontrado".to_string(),
            detail: format!("{program} no está disponible en el PATH."),
            ok: false,
            icon: icon.to_string(),
        },
    }
}

fn check_docker() -> ToolchainItem {
    match Command::new("docker").arg("info").output() {
        Ok(output) if output.status.success() => ToolchainItem {
            id: "docker".to_string(),
            label: "Docker".to_string(),
            status: "Running".to_string(),
            version: "Daemon activo".to_string(),
            detail: "Docker está instalado y el daemon responde.".to_string(),
            ok: true,
            icon: "database".to_string(),
        },
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            ToolchainItem {
                id: "docker".to_string(),
                label: "Docker".to_string(),
                status: "Stopped".to_string(),
                version: "Daemon detenido".to_string(),
                detail: if stderr.is_empty() {
                    "Docker está instalado, pero el daemon no está activo o no tenés permisos.".to_string()
                } else {
                    first_line(&stderr)
                },
                ok: false,
                icon: "database".to_string(),
            }
        }
        Err(_) => ToolchainItem {
            id: "docker".to_string(),
            label: "Docker".to_string(),
            status: "No instalado".to_string(),
            version: "No encontrado".to_string(),
            detail: "Docker no está disponible en el PATH.".to_string(),
            ok: false,
            icon: "database".to_string(),
        },
    }
}

fn check_docker_compose_plugin() -> ToolchainItem {
    match Command::new("docker").args(["compose", "version"]).output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

            ToolchainItem {
                id: "docker-compose-plugin".to_string(),
                label: "Docker Compose plugin".to_string(),
                status: "OK".to_string(),
                version: if stdout.is_empty() {
                    "Disponible".to_string()
                } else {
                    first_line(&stdout)
                },
                detail: "Docker Compose moderno disponible con docker compose.".to_string(),
                ok: true,
                icon: "database".to_string(),
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            ToolchainItem {
                id: "docker-compose-plugin".to_string(),
                label: "Docker Compose plugin".to_string(),
                status: "Error".to_string(),
                version: "No disponible".to_string(),
                detail: if stderr.is_empty() {
                    "docker compose no respondió correctamente.".to_string()
                } else {
                    first_line(&stderr)
                },
                ok: false,
                icon: "database".to_string(),
            }
        }
        Err(_) => ToolchainItem {
            id: "docker-compose-plugin".to_string(),
            label: "Docker Compose plugin".to_string(),
            status: "No disponible".to_string(),
            version: "No encontrado".to_string(),
            detail: "No se pudo ejecutar docker compose version.".to_string(),
            ok: false,
            icon: "database".to_string(),
        },
    }
}

fn check_git_config(id: &str, label: &str, key: &str) -> ToolchainItem {
    match Command::new("git").args(["config", "--global", key]).output() {
        Ok(output) if output.status.success() => {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();

            ToolchainItem {
                id: id.to_string(),
                label: label.to_string(),
                status: if value.is_empty() { "Vacío" } else { "OK" }.to_string(),
                version: if value.is_empty() {
                    "No configurado".to_string()
                } else {
                    value
                },
                detail: format!("Configuración global Git: {key}"),
                ok: !String::from_utf8_lossy(&output.stdout).trim().is_empty(),
                icon: "git-branch".to_string(),
            }
        }
        _ => ToolchainItem {
            id: id.to_string(),
            label: label.to_string(),
            status: "No configurado".to_string(),
            version: "No disponible".to_string(),
            detail: format!("Configurá Git con: git config --global {key} \"valor\""),
            ok: false,
            icon: "git-branch".to_string(),
        },
    }
}

fn is_long_running_script(name: &str) -> bool {
    let normalized = name.to_lowercase();

    normalized.contains("dev")
        || normalized.contains("start")
        || normalized.contains("serve")
        || normalized.contains("watch")
        || normalized.contains("preview")
        || normalized.contains("tauri")
        || normalized == "run"
        || normalized == "up"
        || normalized == "logs"
}

fn is_long_running_command(command: &str) -> bool {
    let normalized = command.to_lowercase();

    normalized.contains("vite")
        || normalized.contains("next dev")
        || normalized.contains("nuxt dev")
        || normalized.contains("astro dev")
        || normalized.contains("webpack serve")
        || normalized.contains("tauri dev")
        || normalized.contains("--watch")
        || normalized.contains(" -w")
        || normalized.contains("nodemon")
        || normalized.contains("tsx watch")
        || normalized.contains("node src/server.js")
}

fn sanitize_id(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "task".to_string()
    } else {
        sanitized
    }
}

fn first_line(value: &str) -> String {
    value
        .lines()
        .next()
        .unwrap_or(value)
        .trim()
        .to_string()
}