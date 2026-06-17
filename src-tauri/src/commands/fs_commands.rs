// src-tauri/src/commands/fs_commands.rs
use crate::core::fs::{
    add_project_to_recent,
    build_project_tree,
    clear_recent_projects_store,
    create_empty_file,
    create_new_folder,
    delete_file_or_folder,
    execute_ai_chat,
    get_recent_projects,
    get_settings,
    read_text_file,
    rename_file_or_folder,
    save_settings,
    search_project_content,
    write_text_file,
    AiChatRequest,
    AiChatResponse,
    AppSettings,
    FileNode,
    RecentProject,
    SearchResult,
};

use std::{
    fs,
    path::{Path, PathBuf},
};

fn normalize_absolute_path(value: String, label: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} no puede estar vacío."));
    }

    Ok(PathBuf::from(trimmed))
}

fn get_file_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| "No se pudo leer el nombre del archivo o carpeta.".to_string())
}

#[tauri::command]
pub async fn open_project_dialog() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Abrir proyecto en Aurelius IDE")
        .pick_folder();

    Ok(folder.map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn read_project_tree(project_path: String) -> Result<Vec<FileNode>, String> {
    build_project_tree(project_path)
}

#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    read_text_file(file_path)
}

#[tauri::command]
pub async fn write_file(file_path: String, content: String) -> Result<(), String> {
    write_text_file(file_path, content)
}

#[tauri::command]
pub async fn create_file(project_path: String, relative_path: String) -> Result<String, String> {
    create_empty_file(project_path, relative_path)
}

#[tauri::command]
pub async fn create_folder(project_path: String, relative_path: String) -> Result<String, String> {
    create_new_folder(project_path, relative_path)
}

#[tauri::command]
pub async fn rename_path(current_path: String, new_name: String) -> Result<String, String> {
    rename_file_or_folder(current_path, new_name)
}

#[tauri::command]
pub async fn delete_path(target_path: String) -> Result<(), String> {
    delete_file_or_folder(target_path)
}

#[tauri::command]
pub async fn move_path(source_path: String, target_directory_path: String) -> Result<String, String> {
    let source = normalize_absolute_path(source_path, "La ruta origen")?;
    let target_directory = normalize_absolute_path(target_directory_path, "La carpeta destino")?;

    if !source.exists() {
        return Err("El archivo o carpeta de origen no existe.".to_string());
    }

    if !target_directory.exists() {
        return Err("La carpeta destino no existe.".to_string());
    }

    if !target_directory.is_dir() {
        return Err("El destino seleccionado no es una carpeta.".to_string());
    }

    let source_canonical = fs::canonicalize(&source)
        .map_err(|error| format!("No se pudo validar el origen: {error}"))?;

    let target_canonical = fs::canonicalize(&target_directory)
        .map_err(|error| format!("No se pudo validar el destino: {error}"))?;

    if source_canonical == target_canonical {
        return Err("No se puede mover un elemento dentro de sí mismo.".to_string());
    }

    if source_canonical.is_dir() && target_canonical.starts_with(&source_canonical) {
        return Err("No se puede mover una carpeta dentro de sí misma.".to_string());
    }

    let file_name = get_file_name(&source)?;
    let destination = target_directory.join(file_name);

    if destination.exists() {
        return Err("Ya existe un archivo o carpeta con ese nombre en el destino.".to_string());
    }

    let destination_parent = destination
        .parent()
        .ok_or_else(|| "No se pudo resolver la carpeta destino.".to_string())?;

    let source_parent = source
        .parent()
        .ok_or_else(|| "No se pudo resolver la carpeta actual del origen.".to_string())?;

    let source_parent_canonical = fs::canonicalize(source_parent)
        .map_err(|error| format!("No se pudo validar la carpeta actual: {error}"))?;

    let destination_parent_canonical = fs::canonicalize(destination_parent)
        .map_err(|error| format!("No se pudo validar la carpeta destino: {error}"))?;

    if source_parent_canonical == destination_parent_canonical {
        return Err("El archivo ya está dentro de esa carpeta.".to_string());
    }

    fs::rename(&source, &destination)
        .map_err(|error| format!("No se pudo mover el archivo o carpeta: {error}"))?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_recent_projects() -> Result<Vec<RecentProject>, String> {
    get_recent_projects()
}

#[tauri::command]
pub async fn add_recent_project(project_path: String) -> Result<Vec<RecentProject>, String> {
    add_project_to_recent(project_path)
}

#[tauri::command]
pub async fn clear_recent_projects() -> Result<Vec<RecentProject>, String> {
    clear_recent_projects_store()
}

#[tauri::command]
pub async fn read_settings() -> Result<AppSettings, String> {
    get_settings()
}

#[tauri::command]
pub async fn write_settings(settings: AppSettings) -> Result<AppSettings, String> {
    save_settings(settings)
}

#[tauri::command]
pub async fn search_project(project_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    search_project_content(project_path, query)
}

#[tauri::command]
pub async fn chat_with_ai(request: AiChatRequest) -> Result<AiChatResponse, String> {
    execute_ai_chat(request).await
}