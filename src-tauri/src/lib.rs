mod commands;
mod db;
mod git;
mod usage_limits;

#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
#[cfg(desktop)]
use tauri::image::Image;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[allow(unused_imports)]
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let run_result = tauri::Builder::default()
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

            #[cfg(desktop)]
            {
                let show_item =
                    MenuItem::with_id(app, "tray_show", "Show Divergence", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;
                let separator = PredefinedMenuItem::separator(app)?;
                let tray_menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

                let tray_icon_image = Image::from_bytes(include_bytes!(
                    "../icons/tray-iconTemplate@2x.png"
                ))?;

                let _tray_icon = TrayIconBuilder::with_id("main-tray")
                    .icon(tray_icon_image)
                    .icon_as_template(true)
                    .menu(&tray_menu)
                    .show_menu_on_left_click(true)
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app_handle = tray.app_handle();
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "tray_quit" {
                app.exit(0);
                return;
            }
            if event.id() == "tray_show" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
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
            commands::fetch_github_pull_requests,
            commands::check_branch_status,
            commands::list_git_changes,
            commands::get_git_diff,
            commands::get_divergence_base_path,
            commands::kill_tmux_session,
            commands::list_tmux_sessions,
            commands::list_all_tmux_sessions,
            commands::get_tmux_diagnostics,
            commands::kill_all_tmux_sessions,
            commands::list_project_files,
            commands::list_branch_changes,
            commands::get_branch_diff,
            commands::write_review_brief_file,
            commands::spawn_tmux_automation_session,
            commands::query_tmux_pane_status,
            commands::read_file_tail,
            commands::read_file_if_exists,
            commands::create_workspace_folder,
            commands::update_workspace_folder,
            commands::delete_workspace_folder,
            commands::get_workspaces_base_path,
            commands::check_port_available,
            usage_limits::get_usage_limits_status,
            usage_limits::fetch_claude_usage,
            usage_limits::fetch_codex_usage,
            commands::get_default_shell,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = run_result {
        eprintln!("error while running tauri application: {}", error);
    }
}
