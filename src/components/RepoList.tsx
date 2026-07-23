import type { RepoInfo } from "../types";
import RepoCard from "./RepoCard";

interface RepoListProps {
  repos: RepoInfo[];
  onFetch: (path: string) => Promise<void>;
  onPullRebase: (path: string) => Promise<void>;
  onPush: (path: string) => Promise<void>;
  onOpen: (repo: RepoInfo) => void;
}

export default function RepoList({ repos, onFetch, onPullRebase, onPush, onOpen }: RepoListProps) {
  if (repos.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>No repositories found</h2>
          <p>Scan a root to discover Git repositories.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-grid">
      {repos.map((repo) => (
        <RepoCard
          key={repo.path}
          repo={repo}
          onFetch={onFetch}
          onPullRebase={onPullRebase}
          onPush={onPush}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
