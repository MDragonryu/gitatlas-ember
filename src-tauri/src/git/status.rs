use git2::{BranchType, Repository};
use std::path::Path;

use crate::db::models::{RepoHealth, RepoInfo};

/// Get the full status of a Git repository.
pub fn get_repo_info(path: &Path) -> RepoInfo {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let now = chrono::Utc::now().to_rfc3339();

    let mut repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => {
            return RepoInfo {
                id: None,
                path: path.to_string_lossy().to_string(),
                name,
                branch: "unknown".to_string(),
                ahead: 0,
                behind: 0,
                dirty_files: 0,
                stash_count: 0,
                health: RepoHealth::Error,
                last_checked: now,
                remote_url: None,
            };
        }
    };

    let branch = get_branch_name(&repo);
    let (ahead, behind) = get_ahead_behind(&repo);
    let dirty_files = get_dirty_count(&repo);
    let stash_count = get_stash_count(&mut repo);
    let remote_url = get_origin_url(&repo);

    let health = determine_health(ahead, behind, dirty_files);

    RepoInfo {
        id: None,
        path: path.to_string_lossy().to_string(),
        name,
        branch,
        ahead,
        behind,
        dirty_files,
        stash_count,
        health,
        last_checked: now,
        remote_url,
    }
}

fn get_branch_name(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|head| head.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD (detached)".to_string())
}

fn get_ahead_behind(repo: &Repository) -> (u32, u32) {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return (0, 0),
    };

    let local_oid = match head.target() {
        Some(oid) => oid,
        None => return (0, 0),
    };

    let branch_name = match head.shorthand() {
        Some(name) => name.to_string(),
        None => return (0, 0),
    };

    let upstream = match repo
        .find_branch(&branch_name, BranchType::Local)
        .and_then(|branch| branch.upstream())
    {
        Ok(branch) => branch,
        Err(_) => return (0, 0),
    };

    let upstream_oid = match upstream.get().peel_to_commit() {
        Ok(commit) => commit.id(),
        Err(_) => return (0, 0),
    };

    repo.graph_ahead_behind(local_oid, upstream_oid)
        .map(|(a, b)| (a as u32, b as u32))
        .unwrap_or((0, 0))
}

fn get_dirty_count(repo: &Repository) -> u32 {
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(false);

    repo.statuses(Some(&mut opts))
        .map(|statuses| statuses.len() as u32)
        .unwrap_or(0)
}

fn get_stash_count(repo: &mut Repository) -> u32 {
    let mut count = 0u32;
    let _ = repo.stash_foreach(|_, _, _| {
        count += 1;
        true
    });
    count
}

fn get_origin_url(repo: &Repository) -> Option<String> {
    repo.find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(String::from))
}

fn determine_health(ahead: u32, behind: u32, dirty_files: u32) -> RepoHealth {
    if behind > 0 && (ahead > 0 || dirty_files > 0) {
        RepoHealth::Diverged
    } else if dirty_files > 0 || ahead > 0 {
        RepoHealth::Dirty
    } else {
        RepoHealth::Clean
    }
}

#[cfg(test)]
mod tests {
    use super::get_ahead_behind;
    use git2::{Repository, Signature};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn compares_head_with_the_configured_upstream() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after the Unix epoch")
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("gitatlas-status-{}-{unique}", std::process::id()));
        fs::create_dir_all(&path).expect("temporary repository directory should be created");
        let repo = Repository::init(&path).expect("temporary Git repository should be initialized");
        let signature =
            Signature::now("GitAtlas Test", "test@example.com").expect("signature should be valid");

        let tree_oid = {
            let mut index = repo.index().expect("repository index should be available");
            index.write_tree().expect("empty tree should be written")
        };
        let tree = repo
            .find_tree(tree_oid)
            .expect("written tree should be available");
        let upstream_oid = repo
            .commit(Some("HEAD"), &signature, &signature, "initial", &tree, &[])
            .expect("initial commit should be created");
        let first_commit = repo
            .find_commit(upstream_oid)
            .expect("initial commit should be available");
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "local",
            &tree,
            &[&first_commit],
        )
        .expect("local commit should be created");

        let branch_name = repo
            .head()
            .expect("HEAD should exist")
            .shorthand()
            .expect("HEAD should name a branch")
            .to_string();
        repo.reference(
            "refs/remotes/company/trunk",
            upstream_oid,
            true,
            "test upstream",
        )
        .expect("remote-tracking reference should be created");
        repo.remote("company", "https://example.com/company/repo.git")
            .expect("upstream remote should be created");
        let mut config = repo
            .config()
            .expect("repository config should be available");
        config
            .set_str(&format!("branch.{branch_name}.remote"), "company")
            .expect("upstream remote should be configured");
        config
            .set_str(&format!("branch.{branch_name}.merge"), "refs/heads/trunk")
            .expect("upstream merge ref should be configured");

        assert_eq!(get_ahead_behind(&repo), (1, 0));
        drop(config);
        drop(tree);
        drop(first_commit);
        drop(repo);
        fs::remove_dir_all(path).expect("temporary directory should be removed");
    }
}
