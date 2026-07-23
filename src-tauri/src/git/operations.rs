use git2::{
    AnnotatedCommit, AutotagOption, BranchType, Cred, CredentialType, FetchOptions, PushOptions,
    RemoteCallbacks, Repository,
};
use std::path::Path;
use std::sync::Once;

use crate::error::AppError;

/// Ensure SSH_AUTH_SOCK is set. On macOS, GUI apps don't inherit shell
/// environment variables, so the SSH agent socket must be discovered.
fn ensure_ssh_auth_sock() {
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        if std::env::var("SSH_AUTH_SOCK").is_ok() {
            return;
        }
        // macOS: the system SSH agent socket lives under /private/tmp/com.apple.launchd.*
        if let Ok(entries) = std::fs::read_dir("/private/tmp") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if name.to_string_lossy().starts_with("com.apple.launchd.") {
                    let sock = entry.path().join("Listeners");
                    if sock.exists() {
                        std::env::set_var("SSH_AUTH_SOCK", &sock);
                        return;
                    }
                }
            }
        }
    });
}

/// Build remote callbacks with SSH agent, SSH key, and HTTPS credential support.
fn make_callbacks() -> RemoteCallbacks<'static> {
    ensure_ssh_auth_sock();

    let mut callbacks = RemoteCallbacks::new();

    callbacks.credentials(|url, username_from_url, allowed_types| {
        // Try SSH agent first
        if allowed_types.contains(CredentialType::SSH_KEY) {
            let user = username_from_url.unwrap_or("git");

            // Try the SSH agent
            if let Ok(cred) = Cred::ssh_key_from_agent(user) {
                return Ok(cred);
            }

            // Fall back to common key file locations
            let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());
            for key_name in &["id_ed25519", "id_rsa", "id_ecdsa"] {
                let key_path = format!("{}/.ssh/{}", home, key_name);
                let pub_path = format!("{}.pub", key_path);
                let key = Path::new(&key_path);
                let pubkey = Path::new(&pub_path);

                if key.exists() {
                    let pub_key = if pubkey.exists() {
                        Some(pubkey.to_path_buf())
                    } else {
                        None
                    };
                    if let Ok(cred) = Cred::ssh_key(user, pub_key.as_deref(), key, None) {
                        return Ok(cred);
                    }
                }
            }
        }

        // HTTPS: try git credential helper via default credentials
        if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(cred) = Cred::credential_helper(
                &git2::Config::open_default()
                    .unwrap_or_else(|_| git2::Config::new().expect("failed to create git config")),
                url,
                username_from_url,
            ) {
                return Ok(cred);
            }

            // Fall back to default username if nothing else works
            if let Some(user) = username_from_url {
                if let Ok(cred) = Cred::username(user) {
                    return Ok(cred);
                }
            }
        }

        if allowed_types.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }

        Err(git2::Error::from_str("no authentication method available"))
    });

    callbacks
}

fn make_fetch_options() -> FetchOptions<'static> {
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(make_callbacks());
    fetch_opts.download_tags(AutotagOption::All);
    fetch_opts
}

fn make_push_options() -> PushOptions<'static> {
    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(make_callbacks());
    push_opts
}

/// Fetch all remotes for the repository at the given path.
pub fn fetch_repo(path: &Path) -> Result<(), AppError> {
    let repo = Repository::open(path)?;

    let remotes = repo.remotes()?;
    for remote_name in remotes.iter().flatten() {
        let mut remote = repo.find_remote(remote_name)?;

        let refspecs: Vec<String> = remote
            .fetch_refspecs()?
            .iter()
            .flatten()
            .map(String::from)
            .collect();
        let refspec_refs: Vec<&str> = refspecs.iter().map(|s| s.as_str()).collect();

        remote.fetch(&refspec_refs, Some(&mut make_fetch_options()), None)?;
    }

    Ok(())
}

/// Fetch then rebase the current branch onto its upstream.
pub fn pull_rebase_repo(path: &Path) -> Result<(), AppError> {
    fetch_repo(path)?;

    let repo = Repository::open(path)?;

    let head = repo.head()?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| AppError::General("HEAD is not on a branch".to_string()))?
        .to_string();

    let upstream_branch = repo
        .find_branch(&branch_name, BranchType::Local)?
        .upstream()
        .map_err(|_| AppError::General(format!("No upstream branch found for {branch_name}")))?;
    let upstream_commit = repo.reference_to_annotated_commit(upstream_branch.get())?;

    rebase_onto(&repo, &upstream_commit)?;

    Ok(())
}

fn rebase_onto(repo: &Repository, upstream: &AnnotatedCommit) -> Result<(), AppError> {
    let mut rebase = repo.rebase(None, Some(upstream), None, None)?;

    while let Some(op) = rebase.next() {
        let _op = op?;
        let index = repo.index()?;
        if index.has_conflicts() {
            rebase.abort()?;
            return Err(AppError::General(
                "Rebase aborted: conflicts detected".to_string(),
            ));
        }
        let committer = repo.signature()?;
        rebase.commit(None, &committer, None)?;
    }

    rebase.finish(None)?;

    Ok(())
}

/// Push the current branch to origin.
pub fn push_repo(path: &Path) -> Result<(), AppError> {
    let repo = Repository::open(path)?;

    let head = repo.head()?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| AppError::General("HEAD is not on a branch".to_string()))?
        .to_string();

    let mut remote = repo
        .find_remote("origin")
        .map_err(|_| AppError::General("No 'origin' remote found".to_string()))?;

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
    remote.push(&[&refspec], Some(&mut make_push_options()))?;

    Ok(())
}
