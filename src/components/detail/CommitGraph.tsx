import { useMemo, useCallback } from "react";
import type { CommitInfo, RefLabel } from "../../types";
import { computeGraph } from "./graph/computeGraph";
import GraphSvg, { ROW_HEIGHT, LANE_WIDTH, LEFT_PAD } from "./graph/GraphSvg";

interface CommitGraphProps {
  commits: CommitInfo[];
  selectedOid: string | null;
  onSelect: (oid: string) => void;
  onMergeDrop?: (sourceBranch: string, targetOid: string) => void;
}

const REF_CLASSES: Record<string, string> = {
  head: "ref-head",
  local: "ref-local",
  remote: "ref-remote",
  tag: "ref-tag",
};

function avatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["var(--action)", "var(--type)", "var(--success)", "var(--number)", "var(--attribute)"];
  return colors[Math.abs(hash) % colors.length];
}

export default function CommitGraph({ commits, selectedOid, onSelect, onMergeDrop }: CommitGraphProps) {
  const { laneCount } = useMemo(() => computeGraph(commits), [commits]);
  const graphWidth = LEFT_PAD + laneCount * LANE_WIDTH + 12;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetOid: string) => {
      e.preventDefault();
      const sourceBranch = e.dataTransfer.getData("text/plain");
      if (sourceBranch && onMergeDrop) {
        onMergeDrop(sourceBranch, targetOid);
      }
    },
    [onMergeDrop],
  );

  if (commits.length === 0) {
    return (
      <div className="empty-row">No commits found</div>
    );
  }

  return (
    <div className="commit-graph">
      {/* SVG layer */}
      <GraphSvg commits={commits} width={graphWidth} />

      {/* Commit rows on top of SVG */}
      <div className="commit-rows" style={{ paddingLeft: graphWidth }}>
        {commits.map((commit) => {
          const isSelected = selectedOid === commit.oid;
          const date = new Date(commit.date);
          const relDate = formatRelative(date);
          const initial = (commit.author[0] || "?").toUpperCase();
          const color = avatarColor(commit.author_email);

          return (
            <button
              key={commit.oid}
              onClick={() => onSelect(commit.oid)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, commit.oid)}
              className={`commit-row${isSelected ? " selected" : ""}`}
              style={{ height: ROW_HEIGHT }}
            >
              {/* Avatar */}
              <div
                className="avatar"
                style={{ backgroundColor: color }}
                title={commit.author}
              >
                {initial}
              </div>

              <div className="commit-copy">
                <div className="commit-subject">
                  <p>
                    {commit.message.split("\n")[0]}
                  </p>
                  {commit.refs.length > 0 && (
                    <div className="ref-list">
                      {commit.refs.map((ref) => (
                        <RefBadge key={`${ref.kind}-${ref.name}`} refLabel={ref} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="commit-meta">
                  <span className="oid">{commit.short_oid}</span>
                  <span className="author">{commit.author}</span>
                  <time dateTime={commit.date}>{relDate}</time>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RefBadge({ refLabel }: { refLabel: RefLabel }) {
  const className = REF_CLASSES[refLabel.kind] ?? REF_CLASSES.local;
  const display = refLabel.kind === "head"
    ? `HEAD \u2192 ${refLabel.name}`
    : refLabel.name;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", refLabel.name);
    e.dataTransfer.effectAllowed = "move";
  };

  const isDraggable = refLabel.kind === "local" || refLabel.kind === "remote";

  return (
    <span
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      className={`ref-badge ${className}${isDraggable ? " cursor-grab active:cursor-grabbing" : ""}`}
    >
      {display}
    </span>
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
