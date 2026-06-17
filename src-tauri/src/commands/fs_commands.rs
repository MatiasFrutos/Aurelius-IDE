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