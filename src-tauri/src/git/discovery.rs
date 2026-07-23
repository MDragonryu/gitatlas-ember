use ignore::WalkBuilder;
use std::path::{Path, PathBuf};

/// Discover all Git repositories under the given root directory.
/// Skips Git's internal object directories while still finding normal,
/// bare-adjacent, and worktree repositories.
pub fn discover_repos(root: &Path) -> Vec<PathBuf> {
    let mut repos = Vec::new();

    if !root.exists() || !root.is_dir() {
        return repos;
    }

    let walker = WalkBuilder::new(root)
        .hidden(false) // Don't skip hidden directories (repos can be in hidden dirs)
        .git_ignore(false) // Don't use .gitignore for discovery
        .git_global(false)
        .git_exclude(false)
        .max_depth(Some(5)) // Don't recurse too deep
        .filter_entry(|entry| entry.file_name() != ".git")
        .build();

    for entry in walker.flatten() {
        let path = entry.path();
        if path.is_dir() && path.join(".git").exists() {
            repos.push(path.to_path_buf());
        }
    }

    repos
}

#[cfg(test)]
mod tests {
    use super::discover_repos;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after the Unix epoch")
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("gitatlas-{name}-{}-{unique}", std::process::id()));
        fs::create_dir_all(&path).expect("temporary directory should be created");
        path
    }

    #[test]
    fn discovers_standard_and_worktree_repositories() {
        let root = temp_dir("discovery");
        let standard = root.join("standard");
        let worktree = root.join("worktree");
        fs::create_dir_all(standard.join(".git")).expect("standard repo metadata should exist");
        fs::create_dir_all(&worktree).expect("worktree directory should exist");
        fs::write(worktree.join(".git"), "gitdir: ../metadata")
            .expect("worktree metadata link should exist");

        let mut repos = discover_repos(&root);
        repos.sort();

        assert_eq!(repos, vec![standard, worktree]);
        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }

    #[test]
    fn does_not_walk_git_metadata_directories() {
        let root = temp_dir("metadata");
        let repo = root.join("repo");
        fs::create_dir_all(repo.join(".git").join("nested").join(".git"))
            .expect("nested metadata should exist");

        assert_eq!(discover_repos(&root), vec![repo]);
        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }
}
