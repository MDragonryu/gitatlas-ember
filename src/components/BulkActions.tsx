interface BulkActionsProps {
  onFetchAll: () => void;
  onPullAll: () => void;
  disabled: boolean;
  repoCount: number;
}

export default function BulkActions({
  onFetchAll,
  onPullAll,
  disabled,
  repoCount,
}: BulkActionsProps) {
  if (repoCount === 0) return null;

  return (
    <>
      <button
        onClick={onFetchAll}
        disabled={disabled}
        className="button subtle"
      >
        Fetch All
      </button>
      <button
        onClick={onPullAll}
        disabled={disabled}
        className="button subtle"
      >
        Pull All
      </button>
    </>
  );
}
