import type { FileChange, FileStatus } from "../../types";

interface FileChangesProps {
  changes: FileChange[];
  selectedFile: string | null;
  onSelectFile: (path: string, staged: boolean) => void;
  onStageFiles: (files: string[]) => void;
  onUnstageFiles: (files: string[]) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onFileHistory?: (path: string) => void;
}

const STATUS_LABELS: Record<FileStatus, { letter: string; tone: string }> = {
  added: { letter: "A", tone: "status-added" },
  modified: { letter: "M", tone: "status-modified" },
  deleted: { letter: "D", tone: "status-deleted" },
  renamed: { letter: "R", tone: "status-renamed" },
  untracked: { letter: "?", tone: "status-untracked" },
  conflicted: { letter: "!", tone: "status-conflicted" },
};

export default function FileChanges({
  changes,
  selectedFile,
  onSelectFile,
  onStageFiles,
  onUnstageFiles,
  onStageAll,
  onUnstageAll,
  onFileHistory,
}: FileChangesProps) {
  const staged = changes.filter((c) => c.staged);
  const unstaged = changes.filter((c) => !c.staged);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Staged */}
      <Section
        title="Staged"
        count={staged.length}
        action={staged.length > 0 ? { label: "Unstage All", onClick: onUnstageAll } : undefined}
      >
        {staged.map((file) => (
          <FileRow
            key={`staged-${file.path}`}
            file={file}
            isSelected={selectedFile === file.path}
            onSelect={() => onSelectFile(file.path, true)}
            onAction={() => onUnstageFiles([file.path])}
            actionLabel="−"
            actionTitle="Unstage"
            onFileHistory={onFileHistory}
          />
        ))}
      </Section>

      {/* Unstaged */}
      <Section
        title="Changes"
        count={unstaged.length}
        action={unstaged.length > 0 ? { label: "Stage All", onClick: onStageAll } : undefined}
      >
        {unstaged.map((file) => (
          <FileRow
            key={`unstaged-${file.path}`}
            file={file}
            isSelected={selectedFile === file.path}
            onSelect={() => onSelectFile(file.path, false)}
            onAction={() => onStageFiles([file.path])}
            actionLabel="+"
            actionTitle="Stage"
            onFileHistory={onFileHistory}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="panel-section">
      <div className="section-header">
        <span className="section-title">
          {title}
          <span className="section-count">{count}</span>
        </span>
        {action && (
          <button
            onClick={action.onClick}
            className="section-action"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="scroll-region">
        {count === 0 ? (
          <p className="empty-row">No files</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function FileRow({
  file,
  isSelected,
  onSelect,
  onAction,
  actionLabel,
  actionTitle,
  onFileHistory,
}: {
  file: FileChange;
  isSelected: boolean;
  onSelect: () => void;
  onAction: () => void;
  actionLabel: string;
  actionTitle: string;
  onFileHistory?: (path: string) => void;
}) {
  const { letter, tone } = STATUS_LABELS[file.status];

  return (
    <div className={`data-row${isSelected ? " selected" : ""}`}>
      <span className={`status-letter ${tone}`}>{letter}</span>
      <button
        onClick={onSelect}
        className="data-row-main mono"
        title={file.path}
      >
        {file.path}
      </button>
      {onFileHistory && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFileHistory(file.path);
          }}
          title="File history"
          className="row-action"
        >
          history
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        title={actionTitle}
        className="row-action"
      >
        {actionLabel}
      </button>
    </div>
  );
}
