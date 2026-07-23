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
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 transition hover:border-slate-500 ${
        repo.behind > 0
          ? "border-red-700/60 bg-red-950/20"
          : "border-slate-700 bg-slate-800/50"
      }`}
    >
      <div
        className="flex flex-col gap-3 cursor-pointer"
        onClick={() => onOpen(repo)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-medium text-slate-100">{repo.name}</p>
              {gitUrlToWeb(repo.remote_url) && (
                <GitHubLink url={gitUrlToWeb(repo.remote_url)!} className="h-3.5 w-3.5" />
              )}
            </div>
            <p className="truncate text-xs text-slate-500 font-mono" title={repo.path}>
              {repo.path}
            </p>
          </div>
          <StatusBadge health={repo.health} />
        </div>

        <div className="flex items-center gap-2">
          <span className="truncate rounded bg-slate-700/60 px-2 py-0.5 text-xs font-mono text-blue-300">
            {repo.branch}
          </span>
          {repo.behind > 0 && (
            <span className="rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-300">
              ↓{repo.behind} behind origin
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          {repo.ahead > 0 && (
            <span className="text-green-400" title="Commits ahead of origin">
              ↑{repo.ahead} ahead
            </span>
          )}
          {repo.dirty_files > 0 && (
            <span className="text-yellow-400" title="Dirty files">
              ~{repo.dirty_files} changed
            </span>
          )}
          {repo.stash_count > 0 && (
            <span className="text-purple-400" title="Stashes">
              {repo.stash_count} stash
            </span>
          )}
          {repo.ahead === 0 && repo.behind === 0 && repo.dirty_files === 0 && repo.stash_count === 0 && (
            <span className="text-slate-500">Up to date</span>
          )}
        </div>
      </div>

      {actionError && (
        <p className="text-xs text-red-400 truncate" title={actionError}>
          {actionError}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-slate-700/50 pt-3">
        <ActionButton label="Fetch" busy={busy} onClick={() => run("Fetch", onFetch)} />
        <ActionButton label="Pull" busy={busy} onClick={() => run("Pull", onPullRebase)} />
        <ActionButton label="Push" busy={busy} onClick={() => run("Push", onPush)} />
      </div>
    </div>
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
      className="flex-1 rounded bg-slate-700/60 px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isThis ? `${label}...` : label}
    </button>
  );
}
