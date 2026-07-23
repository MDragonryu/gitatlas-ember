use std::path::Path;

use tauri::State;

use crate::cache;
use crate::db::models::RepoInfo;
use crate::error::AppError;
use crate::git;
use crate::AppState;

#[tauri::command]
pub async fn get_all_repos(state: State<'_, AppState>) -> Result<Vec<RepoInfo>, AppError> {
    state.db.get_all_repos()
}

#[tauri::command]
pub async fn get_repo_status(
    path: String,
    state: State<'_, AppState>,
) -> Result<RepoInfo, AppError> {
    let repo_path = Path::new(&path);
    if !repo_path.exists() {
        return Err(AppError::General(format!("Path does not exist: {}", path)));
    }
    let updated = git::status::get_repo_info(repo_path);
    state.db.upsert_repo(&updated)?;
    cache::save(&state.db.get_all_repos()?)?;
    Ok(updated)
}
