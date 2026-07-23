use std::path::PathBuf;

use tauri::State;

use crate::cache;
use crate::db::models::RepoInfo;
use crate::error::AppError;
use crate::scanner;
use crate::AppState;

#[tauri::command]
pub async fn scan_directories(
    roots: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<RepoInfo>, AppError> {
    let root_paths: Vec<PathBuf> = roots.into_iter().map(PathBuf::from).collect();
    let repos = scanner::scan_roots(&root_paths);

    // Persist to database
    let db = &state.db;
    db.clear_repos()?;
    for repo in &repos {
        db.upsert_repo(repo)?;
    }

    // Write to disk cache for fast startup next time
    cache::save(&repos)?;

    Ok(repos)
}

#[tauri::command]
pub async fn load_cached_repos(state: State<'_, AppState>) -> Result<Vec<RepoInfo>, AppError> {
    let repos = cache::load()?;
    if !repos.is_empty() {
        let db = &state.db;
        db.clear_repos()?;
        for repo in &repos {
            db.upsert_repo(repo)?;
        }
    }
    Ok(repos)
}

#[tauri::command]
pub async fn get_scan_roots() -> Result<Vec<String>, AppError> {
    let config = cache::load_config()?;
    if !config.scan_roots.is_empty() {
        return Ok(config.scan_roots);
    }
    // Default fallback
    let home = dirs_next::home_dir()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|| "/Users".to_string());
    Ok(vec![format!("{}/dev", home)])
}

#[tauri::command]
pub async fn set_scan_roots(roots: Vec<String>) -> Result<(), AppError> {
    let mut config = cache::load_config()?;
    config.scan_roots = roots;
    cache::save_config(&config)?;
    Ok(())
}
