mod commands;
mod db;
mod git;

#[allow(unused_imports)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Initialize database
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init_database(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_project,
            commands::remove_project,
            commands::list_projects,
            commands::create_divergence,
            commands::list_divergences,
            commands::list_remote_branches,
            commands::delete_divergence,
            commands::get_ralphy_config_summary,
            commands::check_branch_status,
            commands::list_git_changes,
            commands::get_git_diff,
            commands::get_divergence_base_path,
            commands::kill_tmux_session,
            commands::list_tmux_sessions,
            commands::kill_all_tmux_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
