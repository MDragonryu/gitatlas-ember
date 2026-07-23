import { useState } from "react";
import type { RepoInfo } from "../types";
import GitHubLink from "./GitHubLink";
import StatusBadge from "./StatusBadge";

function gitUrlToWeb(url: string | null): string | null {
  if (!url) return null;
  // git@github.com:user/repo.git -> https://github.com/user/repo
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;
  // https://github.com/user/repo.git -> https://github.com/user/repo
  try {
    const u = new URL(url);
    if (u.protocol === "ssh:") {
      return `https://${u.hostname}${u.pathname.replace(/\.git$/, "")}`;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname.replace(/\.git$/, "");
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return null;
  }
}

interface RepoCardProps {
  repo: RepoInfo;
  onFetch: (path: string) => Promise<void>;
  onPullRebase: (path: string) => Promise<void>;
  onPush: (path: string) => Promise<void>;
  onOpen: (repo: RepoInfo) => void;
}

export default function RepoCard({ repo, onFetch, onPullRebase, onPush, onOpen }: RepoCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (label: string, action: (path: string) => Promise<void>) => {
    setBusy(label);
    setActionError(null);
    try {
      await action(repo.path);
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className={`repo-card${repo.behind > 0 ? " attention" : ""}`}>
      <button
        type="button"
        className="repo-main"
        onClick={() => onOpen(repo)}
        aria-label={`Open ${repo.name} repository`}
      >
        <div className="repo-title-row">
          <div className="min-w-0">
            <div className="repo-title">
              <h2>{repo.name}</h2>
            </div>
            <p className="repo-path" title={repo.path}>
              {repo.path}
            </p>
          </div>
          <StatusBadge health={repo.health} />
        </div>

        <div className="branch-row">
          <span className="branch-pill">
            {repo.branch}
          </span>
          {repo.behind > 0 && (
            <span className="signal danger">
              ↓{repo.behind} behind origin
            </span>
          )}
        </div>

        <div className="repo-signals">
          {repo.ahead > 0 && (
            <span className="signal success" title="Commits ahead of origin">
              ↑{repo.ahead} ahead
            </span>
          )}
          {repo.dirty_files > 0 && (
            <span className="signal warning" title="Dirty files">
              ~{repo.dirty_files} changed
            </span>
          )}
          {repo.stash_count > 0 && (
            <span className="signal number" title="Stashes">
              {repo.stash_count} stash
            </span>
          )}
          {repo.ahead === 0 && repo.behind === 0 && repo.dirty_files === 0 && repo.stash_count === 0 && (
            <span className="signal">Up to date</span>
          )}
        </div>
      </button>

      {gitUrlToWeb(repo.remote_url) && (
        <div className="repo-external">
          <GitHubLink url={gitUrlToWeb(repo.remote_url)!} className="h-3.5 w-3.5" />
        </div>
      )}

      {actionError && (
        <p className="repo-error" role="alert" title={actionError}>
          {actionError}
        </p>
      )}

      <div className="card-actions">
        <ActionButton label="Fetch" busy={busy} onClick={() => run("Fetch", onFetch)} />
        <ActionButton label="Pull" busy={busy} onClick={() => run("Pull", onPullRebase)} />
        <ActionButton label="Push" busy={busy} onClick={() => run("Push", onPush)} />
      </div>
    </article>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: string | null;
  onClick: () => void;
}) {
  const isThis = busy === label;
  const disabled = busy !== null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="button compact subtle"
    >
      {isThis ? `${label}...` : label}
    </button>
  );
}
