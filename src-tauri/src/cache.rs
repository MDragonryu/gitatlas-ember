use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::db::models::RepoInfo;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub scan_roots: Vec<String>,
}

fn data_dir() -> Result<PathBuf, AppError> {
    dirs_next::home_dir()
        .map(|h| h.join(".gitatlas"))
        .ok_or_else(|| AppError::General("Could not determine the user home directory".to_string()))
}

fn ensure_dir() -> Result<PathBuf, AppError> {
    let dir = data_dir()?;
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

// ── Repo cache ──

pub fn save(repos: &[RepoInfo]) -> Result<(), AppError> {
    let dir = ensure_dir()?;
    let path = dir.join("cache.json");
    let json = serde_json::to_string(repos)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn load() -> Result<Vec<RepoInfo>, AppError> {
    let path = data_dir()?.join("cache.json");
    let data = match fs::read_to_string(path) {
        Ok(data) => data,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.into()),
    };
    Ok(serde_json::from_str(&data)?)
}

// ── Config ──

pub fn load_config() -> Result<Config, AppError> {
    let path = data_dir()?.join("config.json");
    let data = match fs::read_to_string(path) {
        Ok(data) => data,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Config::default()),
        Err(error) => return Err(error.into()),
    };
    Ok(serde_json::from_str(&data)?)
}

pub fn save_config(config: &Config) -> Result<(), AppError> {
    let dir = ensure_dir()?;
    let json = serde_json::to_string_pretty(config)?;
    fs::write(dir.join("config.json"), json)?;
    Ok(())
}
