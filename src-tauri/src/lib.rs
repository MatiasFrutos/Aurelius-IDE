// src-tauri/src/lib.rs
mod commands;
mod core;

use commands::fs_commands::{
    add_recent_project,
    chat_with_ai,
    clear_recent_projects,
    create_file,
    create_folder,
    delete_path,
    open_project_dialog,
    read_file,
    read_project_tree,
    read_recent_projects,
    read_settings,
    rename_path,
    search_project,
    write_file,
    write_settings,
};

use commands::git_commands::{
    git_refresh_project,
    git_status_project,
};

use commands::live_server_commands::{
    live_server_open_browser,
    live_server_start,
    live_server_status,
    live_server_stop,
    LiveServerManager,
};

use commands::project_tools_commands::{
    read_project_tasks,
    read_toolchain_doctor,
    run_project_task,
};

use commands::session_commands::{
    read_ui_session,
    write_ui_session,
};

use commands::system_commands::{
    read_monitor_snapshot,
};

use commands::task_commands::{
    cargo_check_project,
    run_project_diagnostics,
};

use commands::terminal_commands::{
    terminal_kill,
    terminal_resize,
    terminal_spawn,
    terminal_write,
    TerminalManager,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TerminalManager::default())
        .manage(LiveServerManager::default())
        .invoke_handler(tauri::generate_handler![
            open_project_dialog,
            read_project_tree,
            read_file,
            write_file,
            create_file,
            create_folder,
            rename_path,
            delete_path,
            read_recent_projects,
            add_recent_project,
            clear_recent_projects,
            read_settings,
            write_settings,
            search_project,
            chat_with_ai,
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            cargo_check_project,
            run_project_diagnostics,
            git_status_project,
            git_refresh_project,
            read_ui_session,
            write_ui_session,
            read_monitor_snapshot,
            read_project_tasks,
            run_project_task,
            read_toolchain_doctor,
            live_server_start,
            live_server_stop,
            live_server_status,
            live_server_open_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aurelius IDE");
}