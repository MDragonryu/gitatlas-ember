use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub id: Option<i64>,
    pub path: String,
    pub name: String,
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub dirty_files: u32,
    pub stash_count: u32,
    pub health: RepoHealth,
    pub last_checked: String,
    pub remote_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkOperationResult {
    pub repos: Vec<RepoInfo>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RepoHealth {
    Clean,
    Dirty,
    Diverged,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: String,
    pub parents: Vec<String>,
    /// Branch/tag names pointing at this commit
    pub refs: Vec<RefLabel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefLabel {
    pub name: String,
    pub kind: RefKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RefKind {
    Head,
    Local,
    Remote,
    Tag,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub status: FileStatus,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Untracked,
    Conflicted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitFileChange {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitProfile {
    pub name: String,
    pub email: String,
}

impl RepoHealth {
    pub fn as_str(&self) -> &'static str {
        match self {
            RepoHealth::Clean => "clean",
            RepoHealth::Dirty => "dirty",
            RepoHealth::Diverged => "diverged",
            RepoHealth::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "clean" => RepoHealth::Clean,
            "dirty" => RepoHealth::Dirty,
            "diverged" => RepoHealth::Diverged,
            _ => RepoHealth::Error,
        }
    }
}
