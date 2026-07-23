use rusqlite::params;

use super::Database;
use crate::db::models::{RepoHealth, RepoInfo};
use crate::error::AppError;

impl Database {
    pub fn upsert_repo(&self, repo: &RepoInfo) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO repos (path, name, branch, ahead, behind, dirty_files, stash_count, health, last_checked, remote_url)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(path) DO UPDATE SET
                name = excluded.name,
                branch = excluded.branch,
                ahead = excluded.ahead,
                behind = excluded.behind,
                dirty_files = excluded.dirty_files,
                stash_count = excluded.stash_count,
                health = excluded.health,
                last_checked = excluded.last_checked,
                remote_url = excluded.remote_url",
            params![
                repo.path,
                repo.name,
                repo.branch,
                repo.ahead,
                repo.behind,
                repo.dirty_files,
                repo.stash_count,
                repo.health.as_str(),
                repo.last_checked,
                repo.remote_url,
            ],
        )?;
        Ok(())
    }

    pub fn get_all_repos(&self) -> Result<Vec<RepoInfo>, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, path, name, branch, ahead, behind, dirty_files, stash_count, health, last_checked, remote_url FROM repos ORDER BY name",
        )?;
        let repos = stmt
            .query_map([], |row| {
                Ok(RepoInfo {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    branch: row.get(3)?,
                    ahead: row.get(4)?,
                    behind: row.get(5)?,
                    dirty_files: row.get(6)?,
                    stash_count: row.get(7)?,
                    health: RepoHealth::from_str(&row.get::<_, String>(8)?),
                    last_checked: row.get(9)?,
                    remote_url: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(repos)
    }

    pub fn clear_repos(&self) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute("DELETE FROM repos", [])?;
        Ok(())
    }
}
