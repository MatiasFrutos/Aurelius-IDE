// src-tauri/src/core/fs.rs
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub opened_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub ui_scale: f32,
    pub sidebar_width: u16,
    pub editor_font_size: u16,
    pub editor_font_family: String,
    pub ai_provider: String,
    pub ai_base_url: String,
    pub ai_api_key: String,
    pub ai_model: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub line_number: usize,
    pub line_text: String,
    pub match_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatRequest {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub messages: Vec<AiMessage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiChatResponse {
    pub content: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "es".to_string(),
            ui_scale: 1.0,
            sidebar_width: 286,
            editor_font_size: 14,
            editor_font_family: "JetBrains Mono".to_string(),
            ai_provider: "ollama".to_string(),
            ai_base_url: "http://localhost:11434".to_string(),
            ai_api_key: "".to_string(),
            ai_model: "llama3.2".to_string(),
        }
    }
}

const MAX_TREE_DEPTH: usize = 64;
const MAX_SEARCH_DEPTH: usize = 8;
const MAX_RECENT_PROJECTS: usize = 10;
const MAX_SEARCH_RESULTS: usize = 220;
const MAX_SEARCH_FILE_SIZE: u64 = 640 * 1024;

const TREE_IGNORED_FILES: &[&str] = &[
    ".DS_Store",
];

const SEARCH_IGNORED_DIRS: &[&str] = &[
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".cache",
    ".tauri",
    ".turbo",
    ".parcel-cache",
    "vendor",
    "coverage",
];

const SEARCH_IGNORED_FILES: &[&str] = &[
    ".DS_Store",
];

const SEARCH_EXTENSIONS: &[&str] = &[
    "js",
    "jsx",
    "ts",
    "tsx",
    "html",
    "css",
    "json",
    "rs",
    "md",
    "txt",
    "toml",
    "yaml",
    "yml",
    "env",
    "sql",
    "sh",
    "bash",
    "zsh",
    "php",
    "py",
    "java",
    "c",
    "h",
    "cpp",
    "hpp",
];

pub fn build_project_tree(project_path: String) -> Result<Vec<FileNode>, String> {
    let root = validate_project_root(project_path)?;

    read_directory(&root, 0)
}

pub fn read_text_file(file_path: String) -> Result<String, String> {
    let path = validate_existing_file_path(file_path)?;

    fs::read_to_string(&path).map_err(|error| {
        format!(
            "No se pudo leer el archivo. Puede que no sea texto UTF-8. Detalle: {}",
            error
        )
    })
}

pub fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    let path = validate_existing_file_path(file_path)?;

    fs::write(&path, content)
        .map_err(|error| format!("No se pudo guardar el archivo. Detalle: {}", error))
}

pub fn create_empty_file(project_path: String, relative_path: String) -> Result<String, String> {
    let root = validate_project_root(project_path)?;
    let relative = validate_relative_path(relative_path)?;
    let target = root.join(relative);

    ensure_target_inside_root(&root, &target)?;

    if target.exists() {
        return Err("Ya existe un archivo o carpeta con esa ruta.".to_string());
    }

    if let Some(parent) = target.parent() {
        ensure_target_inside_root(&root, parent)?;

        fs::create_dir_all(parent).map_err(|error| {
            format!("No se pudo crear la carpeta contenedora. Detalle: {}", error)
        })?;
    }

    fs::write(&target, "")
        .map_err(|error| format!("No se pudo crear el archivo. Detalle: {}", error))?;

    Ok(normalize_path_string(&target))
}

pub fn create_new_folder(project_path: String, relative_path: String) -> Result<String, String> {
    let root = validate_project_root(project_path)?;
    let relative = validate_relative_path(relative_path)?;
    let target = root.join(relative);

    ensure_target_inside_root(&root, &target)?;

    if target.exists() {
        return Err("Ya existe un archivo o carpeta con esa ruta.".to_string());
    }

    fs::create_dir_all(&target)
        .map_err(|error| format!("No se pudo crear la carpeta. Detalle: {}", error))?;

    Ok(normalize_path_string(&target))
}

pub fn rename_file_or_folder(current_path: String, new_name: String) -> Result<String, String> {
    let source = validate_existing_path(current_path)?;
    let clean_name = validate_simple_name(new_name)?;

    let parent = source
        .parent()
        .ok_or_else(|| "No se pudo obtener la carpeta contenedora.".to_string())?;

    let target = parent.join(clean_name);

    if target.exists() {
        return Err("Ya existe un archivo o carpeta con ese nombre.".to_string());
    }

    fs::rename(&source, &target)
        .map_err(|error| format!("No se pudo renombrar. Detalle: {}", error))?;

    Ok(normalize_path_string(&target))
}

pub fn delete_file_or_folder(target_path: String) -> Result<(), String> {
    let target = validate_existing_path(target_path)?;

    if is_dangerous_delete_target(&target) {
        return Err("Aurelius bloqueó una eliminación peligrosa.".to_string());
    }

    if target.is_dir() {
        fs::remove_dir_all(&target)
            .map_err(|error| format!("No se pudo eliminar la carpeta. Detalle: {}", error))?;

        return Ok(());
    }

    if target.is_file() {
        fs::remove_file(&target)
            .map_err(|error| format!("No se pudo eliminar el archivo. Detalle: {}", error))?;

        return Ok(());
    }

    Err("La ruta no es un archivo ni una carpeta válida.".to_string())
}

pub fn get_recent_projects() -> Result<Vec<RecentProject>, String> {
    let path = recent_projects_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path).map_err(|error| {
        format!("No se pudo leer proyectos recientes. Detalle: {}", error)
    })?;

    if content.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut projects: Vec<RecentProject> = serde_json::from_str(&content).unwrap_or_default();

    projects.retain(|project| {
        let path = PathBuf::from(&project.path);

        path.exists() && path.is_dir()
    });

    projects.sort_by(|a, b| b.opened_at.cmp(&a.opened_at));
    projects.truncate(MAX_RECENT_PROJECTS);

    Ok(projects)
}

pub fn add_project_to_recent(project_path: String) -> Result<Vec<RecentProject>, String> {
    let root = validate_project_root(project_path)?;
    let path = normalize_path_string(&root);
    let name = root
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| path.clone());

    let mut projects = get_recent_projects().unwrap_or_default();

    projects.retain(|project| project.path != path);

    projects.insert(
        0,
        RecentProject {
            name,
            path,
            opened_at: current_timestamp(),
        },
    );

    projects.truncate(MAX_RECENT_PROJECTS);
    write_recent_projects(&projects)?;

    Ok(projects)
}

pub fn clear_recent_projects_store() -> Result<Vec<RecentProject>, String> {
    write_recent_projects(&Vec::new())?;

    Ok(Vec::new())
}

pub fn get_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;

    if !path.exists() {
        let settings = AppSettings::default();
        save_settings(settings.clone())?;
        return Ok(settings);
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("No se pudo leer settings.json. Detalle: {}", error))?;

    if content.trim().is_empty() {
        let settings = AppSettings::default();
        save_settings(settings.clone())?;
        return Ok(settings);
    }

    let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();
    let normalized = normalize_settings(settings);

    save_settings(normalized.clone())?;

    Ok(normalized)
}

pub fn save_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let normalized = normalize_settings(settings);
    let path = settings_path()?;

    let content = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("No se pudo serializar settings.json. Detalle: {}", error))?;

    fs::write(&path, content)
        .map_err(|error| format!("No se pudo escribir settings.json. Detalle: {}", error))?;

    Ok(normalized)
}

pub fn search_project_content(project_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let root = validate_project_root(project_path)?;
    let clean_query = query.trim().to_lowercase();

    if clean_query.len() < 2 {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    search_directory(&root, &clean_query, &mut results, 0)?;

    Ok(results)
}

pub async fn execute_ai_chat(request: AiChatRequest) -> Result<AiChatResponse, String> {
    let provider = normalize_ai_provider(&request.provider);
    let model = request.model.trim();

    if model.is_empty() {
        return Err("Tenés que configurar un modelo de IA.".to_string());
    }

    match provider.as_str() {
        "ollama" => chat_ollama(request).await,
        "openai" => chat_openai_like(request, "openai").await,
        "openrouter" => chat_openai_like(request, "openrouter").await,
        "claude" => chat_claude(request).await,
        _ => Err("Proveedor de IA no soportado.".to_string()),
    }
}

async fn chat_ollama(request: AiChatRequest) -> Result<AiChatResponse, String> {
    let client = Client::new();
    let base_url = normalize_base_url(&request.base_url, "http://localhost:11434");
    let url = format!("{}/api/chat", base_url);

    let body = json!({
        "model": request.model,
        "messages": request.messages,
        "stream": false
    });

    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con Ollama. Detalle: {}", error))?;

    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|error| format!("Ollama respondió en un formato inválido. Detalle: {}", error))?;

    if !status.is_success() {
        return Err(format!("Ollama devolvió error: {}", value));
    }

    let content = value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("Ollama no devolvió contenido.".to_string());
    }

    Ok(AiChatResponse { content })
}

async fn chat_openai_like(request: AiChatRequest, provider: &str) -> Result<AiChatResponse, String> {
    let api_key = request.api_key.trim();

    if api_key.is_empty() {
        return Err("Tenés que configurar una API Key para este proveedor.".to_string());
    }

    let default_base_url = if provider == "openrouter" {
        "https://openrouter.ai/api/v1"
    } else {
        "https://api.openai.com/v1"
    };

    let client = Client::new();
    let base_url = normalize_base_url(&request.base_url, default_base_url);
    let url = format!("{}/chat/completions", base_url);

    let body = json!({
        "model": request.model,
        "messages": request.messages,
        "temperature": 0.2
    });

    let mut builder = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body);

    if provider == "openrouter" {
        builder = builder
            .header("HTTP-Referer", "http://localhost/aurelius-ide")
            .header("X-Title", "Aurelius IDE");
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con el proveedor IA. Detalle: {}", error))?;

    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|error| format!("El proveedor IA respondió en un formato inválido. Detalle: {}", error))?;

    if !status.is_success() {
        return Err(format!("El proveedor IA devolvió error: {}", value));
    }

    let content = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("El proveedor IA no devolvió contenido.".to_string());
    }

    Ok(AiChatResponse { content })
}

async fn chat_claude(request: AiChatRequest) -> Result<AiChatResponse, String> {
    let api_key = request.api_key.trim();

    if api_key.is_empty() {
        return Err("Tenés que configurar una API Key de Claude.".to_string());
    }

    let client = Client::new();
    let base_url = normalize_base_url(&request.base_url, "https://api.anthropic.com");
    let url = format!("{}/v1/messages", base_url);

    let mut system_prompt = String::from("Sos un asistente técnico integrado dentro de Aurelius IDE.");
    let mut messages = Vec::new();

    for message in request.messages {
        if message.role == "system" {
            system_prompt = message.content;
            continue;
        }

        let role = if message.role == "assistant" {
            "assistant"
        } else {
            "user"
        };

        messages.push(json!({
            "role": role,
            "content": message.content
        }));
    }

    let body = json!({
        "model": request.model,
        "max_tokens": 1800,
        "system": system_prompt,
        "messages": messages
    });

    let response = client
        .post(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con Claude. Detalle: {}", error))?;

    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|error| format!("Claude respondió en un formato inválido. Detalle: {}", error))?;

    if !status.is_success() {
        return Err(format!("Claude devolvió error: {}", value));
    }

    let content = value
        .get("content")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("text").and_then(Value::as_str))
                .collect::<Vec<&str>>()
                .join("\n")
        })
        .unwrap_or_default()
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("Claude no devolvió contenido.".to_string());
    }

    Ok(AiChatResponse { content })
}

fn read_directory(dir: &Path, depth: usize) -> Result<Vec<FileNode>, String> {
    if depth > MAX_TREE_DEPTH {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(dir)
        .map_err(|error| format!("No se pudo leer la carpeta. Detalle: {}", error))?;

    let mut nodes: Vec<FileNode> = Vec::new();

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if should_ignore_in_tree(&name, &path) {
            continue;
        }

        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_symlink() {
            continue;
        }

        let is_dir = file_type.is_dir();

        let children = if is_dir {
            read_directory(&path, depth + 1).unwrap_or_default()
        } else {
            Vec::new()
        };

        nodes.push(FileNode {
            name,
            path: normalize_path_string(&path),
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(nodes)
}

fn search_directory(
    dir: &Path,
    query: &str,
    results: &mut Vec<SearchResult>,
    depth: usize,
) -> Result<(), String> {
    if depth > MAX_SEARCH_DEPTH || results.len() >= MAX_SEARCH_RESULTS {
        return Ok(());
    }

    let entries = fs::read_dir(dir)
        .map_err(|error| format!("No se pudo buscar en la carpeta. Detalle: {}", error))?;

    for entry_result in entries {
        if results.len() >= MAX_SEARCH_RESULTS {
            break;
        }

        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if should_ignore_in_search(&name, &path) {
            continue;
        }

        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            search_directory(&path, query, results, depth + 1)?;
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let lower_name = name.to_lowercase();

        if lower_name.contains(query) {
            results.push(SearchResult {
                path: normalize_path_string(&path),
                name: name.clone(),
                line_number: 0,
                line_text: normalize_path_string(&path),
                match_kind: "Archivo".to_string(),
            });
        }

        if !is_searchable_file(&path) {
            continue;
        }

        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if metadata.len() > MAX_SEARCH_FILE_SIZE {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        for (index, line) in content.lines().enumerate() {
            if results.len() >= MAX_SEARCH_RESULTS {
                break;
            }

            if line.to_lowercase().contains(query) {
                results.push(SearchResult {
                    path: normalize_path_string(&path),
                    name: name.clone(),
                    line_number: index + 1,
                    line_text: line.trim().chars().take(220).collect(),
                    match_kind: "Contenido".to_string(),
                });
            }
        }
    }

    Ok(())
}

fn is_searchable_file(path: &Path) -> bool {
    match path.extension().and_then(|value| value.to_str()) {
        Some(extension) => SEARCH_EXTENSIONS.contains(&extension.to_lowercase().as_str()),
        None => true,
    }
}

fn should_ignore_in_tree(name: &str, path: &Path) -> bool {
    if path.is_file() && TREE_IGNORED_FILES.contains(&name) {
        return true;
    }

    false
}

fn should_ignore_in_search(name: &str, path: &Path) -> bool {
    if path.is_dir() && SEARCH_IGNORED_DIRS.contains(&name) {
        return true;
    }

    if path.is_file() && SEARCH_IGNORED_FILES.contains(&name) {
        return true;
    }

    false
}

fn validate_project_root(project_path: String) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_path);

    if !root.exists() {
        return Err("La ruta del proyecto no existe.".to_string());
    }

    if !root.is_dir() {
        return Err("La ruta del proyecto no es una carpeta.".to_string());
    }

    root.canonicalize()
        .map_err(|error| format!("No se pudo resolver la ruta del proyecto. Detalle: {}", error))
}

fn validate_existing_path(path: String) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);

    if !path.exists() {
        return Err("La ruta no existe.".to_string());
    }

    path.canonicalize()
        .map_err(|error| format!("No se pudo resolver la ruta. Detalle: {}", error))
}

fn validate_existing_file_path(file_path: String) -> Result<PathBuf, String> {
    let path = validate_existing_path(file_path)?;

    if !path.is_file() {
        return Err("La ruta seleccionada no es un archivo.".to_string());
    }

    Ok(path)
}

fn validate_relative_path(relative_path: String) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim();

    if trimmed.is_empty() {
        return Err("La ruta relativa no puede estar vacía.".to_string());
    }

    if trimmed.contains('\0') {
        return Err("La ruta contiene caracteres inválidos.".to_string());
    }

    let path = PathBuf::from(trimmed);

    for component in path.components() {
        match component {
            Component::Normal(value) => {
                if value.to_string_lossy().trim().is_empty() {
                    return Err("La ruta contiene un segmento vacío.".to_string());
                }
            }
            _ => {
                return Err(
                    "La ruta debe ser relativa y no puede usar '..' ni rutas absolutas.".to_string()
                );
            }
        }
    }

    Ok(path)
}

fn validate_simple_name(name: String) -> Result<String, String> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err("El nombre no puede estar vacío.".to_string());
    }

    if trimmed.contains('\0') {
        return Err("El nombre contiene caracteres inválidos.".to_string());
    }

    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("El nombre no puede contener separadores de ruta.".to_string());
    }

    if trimmed == "." || trimmed == ".." {
        return Err("Nombre inválido.".to_string());
    }

    Ok(trimmed.to_string())
}

fn ensure_target_inside_root(root: &Path, target: &Path) -> Result<(), String> {
    let normalized_root = root
        .canonicalize()
        .map_err(|error| format!("No se pudo resolver la raíz del proyecto. Detalle: {}", error))?;

    let checked_path = if target.exists() {
        target
            .canonicalize()
            .map_err(|error| format!("No se pudo resolver la ruta objetivo. Detalle: {}", error))?
    } else {
        let parent = target
            .parent()
            .ok_or_else(|| "No se pudo resolver la carpeta contenedora.".to_string())?;

        let normalized_parent = if parent.exists() {
            parent
                .canonicalize()
                .map_err(|error| format!("No se pudo resolver la carpeta contenedora. Detalle: {}", error))?
        } else {
            parent.to_path_buf()
        };

        normalized_parent
    };

    if checked_path.starts_with(&normalized_root) {
        return Ok(());
    }

    Err("La ruta objetivo queda fuera del proyecto.".to_string())
}

fn is_dangerous_delete_target(path: &Path) -> bool {
    if path.parent().is_none() {
        return true;
    }

    let protected_paths = [
        PathBuf::from("/"),
        PathBuf::from("/home"),
        PathBuf::from("/usr"),
        PathBuf::from("/etc"),
        PathBuf::from("/var"),
        PathBuf::from("/opt"),
        PathBuf::from("/run"),
        PathBuf::from("/tmp"),
    ];

    protected_paths.iter().any(|protected| path == protected)
}

fn config_dir() -> Result<PathBuf, String> {
    let home = env::var("HOME")
        .map_err(|_| "No se pudo detectar HOME para guardar configuración.".to_string())?;

    let dir = PathBuf::from(home).join(".config").join("aurelius-ide");

    fs::create_dir_all(&dir)
        .map_err(|error| format!("No se pudo crear ~/.config/aurelius-ide. Detalle: {}", error))?;

    Ok(dir)
}

fn recent_projects_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("recent-projects.json"))
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("settings.json"))
}

fn write_recent_projects(projects: &Vec<RecentProject>) -> Result<(), String> {
    let path = recent_projects_path()?;

    let content = serde_json::to_string_pretty(projects)
        .map_err(|error| format!("No se pudo serializar proyectos recientes. Detalle: {}", error))?;

    fs::write(&path, content)
        .map_err(|error| format!("No se pudo escribir recent-projects.json. Detalle: {}", error))
}

fn normalize_settings(settings: AppSettings) -> AppSettings {
    let theme = if settings.theme == "light" {
        "light".to_string()
    } else {
        "dark".to_string()
    };

    let language = if settings.language == "en" {
        "en".to_string()
    } else {
        "es".to_string()
    };

    let ui_scale = if settings.ui_scale.is_finite() {
        settings.ui_scale.clamp(0.85, 1.25)
    } else {
        1.0
    };

    let sidebar_width = settings.sidebar_width.clamp(220, 420);
    let editor_font_size = settings.editor_font_size.clamp(11, 24);

    let editor_font_family = if settings.editor_font_family.trim().is_empty() {
        "JetBrains Mono".to_string()
    } else {
        settings.editor_font_family.trim().to_string()
    };

    let ai_provider = normalize_ai_provider(&settings.ai_provider);

    let ai_base_url = normalize_ai_base_url_by_provider(
        &ai_provider,
        &settings.ai_base_url,
    );

    let ai_model = if settings.ai_model.trim().is_empty() {
        default_ai_model(&ai_provider).to_string()
    } else {
        settings.ai_model.trim().to_string()
    };

    AppSettings {
        theme,
        language,
        ui_scale,
        sidebar_width,
        editor_font_size,
        editor_font_family,
        ai_provider,
        ai_base_url,
        ai_api_key: settings.ai_api_key.trim().to_string(),
        ai_model,
    }
}

fn normalize_ai_provider(provider: &str) -> String {
    match provider.trim().to_lowercase().as_str() {
        "openai" => "openai".to_string(),
        "openrouter" => "openrouter".to_string(),
        "claude" => "claude".to_string(),
        _ => "ollama".to_string(),
    }
}

fn normalize_ai_base_url_by_provider(provider: &str, base_url: &str) -> String {
    let fallback = match provider {
        "openai" => "https://api.openai.com/v1",
        "openrouter" => "https://openrouter.ai/api/v1",
        "claude" => "https://api.anthropic.com",
        _ => "http://localhost:11434",
    };

    normalize_base_url(base_url, fallback)
}

fn normalize_base_url(base_url: &str, fallback: &str) -> String {
    let clean = base_url.trim();

    if clean.is_empty() {
        return fallback.to_string();
    }

    clean.trim_end_matches('/').to_string()
}

fn default_ai_model(provider: &str) -> &'static str {
    match provider {
        "openai" => "gpt-4o-mini",
        "openrouter" => "openai/gpt-4o-mini",
        "claude" => "claude-3-5-sonnet-latest",
        _ => "llama3.2",
    }
}

fn normalize_path_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}