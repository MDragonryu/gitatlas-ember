use std::collections::HashSet;
use std::path::PathBuf;

use crate::db::models::RepoInfo;
use crate::git::{discovery, status};

/// Scan multiple root directories for Git repositories,
/// returning status info for each discovered repo.
pub fn scan_roots(roots: &[PathBuf]) -> Vec<RepoInfo> {
    let mut all_repos = Vec::new();
    let mut seen = HashSet::new();

    for root in roots {
        let repo_paths = discovery::discover_repos(root);
        for path in repo_paths {
            let identity = path.canonicalize().unwrap_or_else(|_| path.clone());
            if !seen.insert(identity) {
                continue;
            }
            let info = status::get_repo_info(&path);
            all_repos.push(info);
        }
    }

    all_repos.sort_by_key(|repo| repo.name.to_lowercase());
    all_repos
}

#[cfg(test)]
mod tests {
    use super::scan_roots;
    use git2::Repository;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn deduplicates_repositories_from_overlapping_roots() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after the Unix epoch")
            .as_nanos();
        let root =
            std::env::temp_dir().join(format!("gitatlas-scanner-{}-{unique}", std::process::id()));
        let repo_path = root.join("repo");
        fs::create_dir_all(&repo_path).expect("temporary repository directory should be created");
        Repository::init(&repo_path).expect("temporary Git repository should be initialized");

        let roots: Vec<PathBuf> = vec![root.clone(), repo_path];
        let repos = scan_roots(&roots);

        assert_eq!(repos.len(), 1);
        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }
}
