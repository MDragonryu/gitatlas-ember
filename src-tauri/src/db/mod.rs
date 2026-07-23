pub mod models;
pub mod queries;

use rusqlite::Connection;
use std::sync::{Mutex, MutexGuard};

use crate::error::AppError;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS repos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                branch TEXT NOT NULL DEFAULT 'unknown',
                ahead INTEGER NOT NULL DEFAULT 0,
                behind INTEGER NOT NULL DEFAULT 0,
                dirty_files INTEGER NOT NULL DEFAULT 0,
                stash_count INTEGER NOT NULL DEFAULT 0,
                health TEXT NOT NULL DEFAULT 'clean',
                last_checked TEXT NOT NULL DEFAULT '',
                remote_url TEXT
            );

            CREATE TABLE IF NOT EXISTS scan_roots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE
            );",
        )?;
        Ok(())
    }

    fn connection(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.conn
            .lock()
            .map_err(|_| AppError::General("Database lock was poisoned".to_string()))
    }
}
