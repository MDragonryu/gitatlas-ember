use std::path::Path;

use crate::db::models::{
    BranchInfo, CommitFileChange, CommitInfo, FileChange, GitProfile, RemoteInfo, StashEntry,
};
use crate::error::AppError;
use crate::git;

// ── Commit log ──────────────────────────────────────────

#[tauri::command]
pub async fn get_commit_log(
    path: String,
    count: Option<usize>,
) -> Result<Vec<CommitInfo>, AppError> {
    let limit = count.unwrap_or(100);
    git::detail::get_commit_log(Path::new(&path), limit)
}

#[tauri::command]
pub async fn get_commit_diff(path: String, oid: String) -> Result<String, AppError> {
    git::detail::get_commit_diff(Path::new(&path), &oid)
}

// ── File changes & diff ─────────────────────────────────

#[tauri::command]
pub async fn get_file_changes(path: String) -> Result<Vec<FileChange>, AppError> {
    git::detail::get_file_changes(Path::new(&path))
}

#[tauri::command]
pub async fn get_file_diff(
    path: String,
    file_path: String,
    staged: bool,
) -> Result<String, AppError> {
    git::detail::get_file_diff(Path::new(&path), &file_path, staged)
}

// ── Staging ─────────────────────────────────────────────

#[tauri::command]
pub async fn stage_files(path: String, files: Vec<String>) -> Result<Vec<FileChange>, AppError> {
    let p = Path::new(&path);
    git::detail::stage_files(p, &files)?;
    git::detail::get_file_changes(p)
}

#[tauri::command]
pub async fn unstage_files(path: String, files: Vec<String>) -> Result<Vec<FileChange>, AppError> {
    let p = Path::new(&path);
    git::detail::unstage_files(p, &files)?;
    git::detail::get_file_changes(p)
}

#[tauri::command]
pub async fn stage_all_files(path: String) -> Result<Vec<FileChange>, AppError> {
    let p = Path::new(&path);
    git::detail::stage_all(p)?;
    git::detail::get_file_changes(p)
}

#[tauri::command]
pub async fn unstage_all_files(path: String) -> Result<Vec<FileChange>, AppError> {
    let p = Path::new(&path);
    git::detail::unstage_all(p)?;
    git::detail::get_file_changes(p)
}

// ── Commit ──────────────────────────────────────────────

#[tauri::command]
pub async fn create_commit(path: String, message: String) -> Result<String, AppError> {
    git::detail::create_commit(Path::new(&path), &message)
}

// ── Branches ────────────────────────────────────────────

#[tauri::command]
pub async fn get_branches(path: String) -> Result<Vec<BranchInfo>, AppError> {
    git::detail::get_branches(Path::new(&path))
}

#[tauri::command]
pub async fn checkout_branch(path: String, branch_name: String) -> Result<(), AppError> {
    git::detail::checkout_branch(Path::new(&path), &branch_name)
}

#[tauri::command]
pub async fn create_branch(path: String, branch_name: String) -> Result<(), AppError> {
    git::detail::create_branch(Path::new(&path), &branch_name)
}

#[tauri::command]
pub async fn delete_branch(path: String, branch_name: String) -> Result<(), AppError> {
    git::detail::delete_branch(Path::new(&path), &branch_name)
}

// ── Stashes ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_stashes(path: String) -> Result<Vec<StashEntry>, AppError> {
    git::detail::get_stashes(Path::new(&path))
}

#[tauri::command]
pub async fn stash_save(path: String, message: String) -> Result<(), AppError> {
    git::detail::stash_save(Path::new(&path), &message)
}

#[tauri::command]
pub async fn stash_pop(path: String, index: usize) -> Result<(), AppError> {
    git::detail::stash_pop(Path::new(&path), index)
}

#[tauri::command]
pub async fn stash_drop(path: String, index: usize) -> Result<(), AppError> {
    git::detail::stash_drop(Path::new(&path), index)
}

// ── Commit files ─────────────────────────────────────────

#[tauri::command]
pub async fn get_commit_files(
    path: String,
    oid: String,
) -> Result<Vec<CommitFileChange>, AppError> {
    git::detail::get_commit_files(Path::new(&path), &oid)
}

// ── Merge ─────────────────────────────────────────────

#[tauri::command]
pub async fn merge_branch(path: String, branch_name: String) -> Result<String, AppError> {
    git::detail::merge_branch(Path::new(&path), &branch_name)
}

// ── File history ─────────────────────────────────────────

#[tauri::command]
pub async fn get_file_history(
    path: String,
    file_path: String,
    count: Option<usize>,
) -> Result<Vec<CommitInfo>, AppError> {
    let limit = count.unwrap_or(50);
    git::detail::get_file_history(Path::new(&path), &file_path, limit)
}

// ── Remotes ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_remotes(path: String) -> Result<Vec<RemoteInfo>, AppError> {
    git::detail::get_remotes(Path::new(&path))
}

#[tauri::command]
pub async fn add_remote(path: String, name: String, url: String) -> Result<(), AppError> {
    git::detail::add_remote(Path::new(&path), &name, &url)
}

#[tauri::command]
pub async fn remove_remote(path: String, name: String) -> Result<(), AppError> {
    git::detail::remove_remote(Path::new(&path), &name)
}

#[tauri::command]
pub async fn rename_remote(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<(), AppError> {
    git::detail::rename_remote(Path::new(&path), &old_name, &new_name)
}

// ── Git profile ─────────────────────────────────────────

#[tauri::command]
pub async fn get_git_profile(path: String) -> Result<GitProfile, AppError> {
    git::detail::get_git_profile(Path::new(&path))
}

#[tauri::command]
pub async fn set_git_profile(path: String, name: String, email: String) -> Result<(), AppError> {
    git::detail::set_git_profile(Path::new(&path), &name, &email)
}

// ── Squash ──────────────────────────────────────────────

#[tauri::command]
pub async fn squash_commits(
    path: String,
    count: usize,
    message: String,
) -> Result<String, AppError> {
    git::detail::squash_commits(Path::new(&path), count, &message)
}

// ── PR URL ──────────────────────────────────────────────

#[tauri::command]
pub async fn get_pr_url(path: String) -> Result<String, AppError> {
    git::detail::get_pr_url(Path::new(&path))
}

// ── README ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_readme(path: String) -> Result<Option<String>, AppError> {
    git::detail::get_readme(Path::new(&path))
}
