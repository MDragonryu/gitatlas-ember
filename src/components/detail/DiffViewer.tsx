interface DiffViewerProps {
  diff: string;
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  if (!diff) {
    return (
      <div className="diff-empty">
        Select a file or commit to view diff
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <div className="diff-viewer">
      <pre className="diff-code" aria-label="Unified diff">
        {lines.map((line, i) => {
          let cls = "diff-line";
          if (line.startsWith("+")) cls += " diff-add";
          else if (line.startsWith("-")) cls += " diff-remove";
          else if (line.startsWith("@@")) cls += " diff-hunk";

          return (
            <span key={i} className={cls}>
              {line || " "}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
