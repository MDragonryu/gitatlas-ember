use std::path::Path;

use tauri::State;

use crate::cache;
use crate::db::models::{BulkOperationResult, RepoInfo};
use crate::error::AppError;
use crate::git;
use crate::AppState;

#[tauri::command]
pub async fn fetch_all(state: State<'_, AppState>) -> Result<BulkOperationResult, AppError> {
    let repos = state.db.get_all_repos()?;
    let mut results = Vec::new();
    let mut errors = Vec::new();

    for repo in &repos {
        let path = Path::new(&repo.path);
        if let Err(error) = git::operations::fetch_repo(path) {
            errors.push(format!("{}: {}", repo.name, error));
        }
        let updated = git::status::get_repo_info(path);
        state.db.upsert_repo(&updated)?;
        results.push(updated);
    }

    cache::save(&results)?;
    Ok(BulkOperationResult {
        repos: results,
        errors,
    })
}

#[tauri::command]
pub async fn pull_all(state: State<'_, AppState>) -> Result<BulkOperationResult, AppError> {
    let repos = state.db.get_all_repos()?;
    let mut results = Vec::new();
    let mut errors = Vec::new();

    for repo in &repos {
        let path = Path::new(&repo.path);
        if let Err(error) = git::operations::pull_rebase_repo(path) {
            errors.push(format!("{}: {}", repo.name, error));
        }
        let updated = git::status::get_repo_info(path);
        state.db.upsert_repo(&updated)?;
        results.push(updated);
    }

    cache::save(&results)?;
    Ok(BulkOperationResult {
        repos: results,
        errors,
    })
}

#[tauri::command]
pub async fn fetch_repo(path: String, state: State<'_, AppState>) -> Result<RepoInfo, AppError> {
    let repo_path = Path::new(&path);
    git::operations::fetch_repo(repo_path)?;
    update_repo_cache(repo_path, &state)
}

#[tauri::command]
pub async fn pull_rebase_repo(
    path: String,
    state: State<'_, AppState>,
) -> Result<RepoInfo, AppError> {
    let repo_path = Path::new(&path);
    git::operations::pull_rebase_repo(repo_path)?;
    update_repo_cache(repo_path, &state)
}

#[tauri::command]
pub async fn push_repo(path: String, state: State<'_, AppState>) -> Result<RepoInfo, AppError> {
    let repo_path = Path::new(&path);
    git::operations::push_repo(repo_path)?;
    update_repo_cache(repo_path, &state)
}

fn update_repo_cache(repo_path: &Path, state: &State<'_, AppState>) -> Result<RepoInfo, AppError> {
    let updated = git::status::get_repo_info(repo_path);
    state.db.upsert_repo(&updated)?;
    cache::save(&state.db.get_all_repos()?)?;
    Ok(updated)
}
