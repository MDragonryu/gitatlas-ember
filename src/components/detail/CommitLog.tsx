import type { CommitInfo } from "../../types";

interface CommitLogProps {
  commits: CommitInfo[];
  selectedOid: string | null;
  onSelect: (oid: string) => void;
}

export default function CommitLog({ commits, selectedOid, onSelect }: CommitLogProps) {
  if (commits.length === 0) {
    return (
      <div className="empty-row">No commits found</div>
    );
  }

  return (
    <div>
      {commits.map((commit) => {
        const isSelected = selectedOid === commit.oid;
        const date = new Date(commit.date);
        const relDate = formatRelative(date);

        return (
          <button
            key={commit.oid}
            onClick={() => onSelect(commit.oid)}
            className={`commit-row${isSelected ? " selected" : ""}`}
          >
            <div className="commit-copy">
            <p className="m-0 text-sm">
              {commit.message.split("\n")[0]}
            </p>
            <div className="commit-meta">
              <span className="oid">{commit.short_oid}</span>
              <span>{commit.author}</span>
              <time dateTime={commit.date}>{relDate}</time>
            </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
