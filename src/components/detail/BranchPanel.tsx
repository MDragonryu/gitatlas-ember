import { useState } from "react";
import type { BranchInfo, RemoteInfo } from "../../types";

interface BranchPanelProps {
  branches: BranchInfo[];
  onCheckout: (name: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onMerge?: (name: string) => Promise<void>;
  remotes?: RemoteInfo[];
  onAddRemote?: (name: string, url: string) => Promise<void>;
  onRemoveRemote?: (name: string) => Promise<void>;
  onRenameRemote?: (oldName: string, newName: string) => Promise<void>;
}

export default function BranchPanel({
  branches,
  onCheckout,
  onCreate,
  onDelete,
  onMerge,
  remotes,
  onAddRemote,
  onRemoveRemote,
  onRenameRemote,
}: BranchPanelProps) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreate(newName.trim());
      setNewName("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="section-header">
        <span className="section-title">
          Local
          <span className="section-count">{localBranches.length}</span>
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="section-action"
        >
          + New
        </button>
      </div>

      {showCreate && (
        <div className="inline-form">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="branch-name"
            aria-label="New branch name"
            autoFocus
            className="control compact mono"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="button compact primary"
          >
            Create
          </button>
        </div>
      )}

      <div className="scroll-region">
        {localBranches.map((branch) => (
          <BranchRow
            key={branch.name}
            branch={branch}
            onCheckout={onCheckout}
            onDelete={onDelete}
            onMerge={onMerge}
          />
        ))}
      </div>

      {remoteBranches.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">
              Remote Branches
              <span className="section-count">{remoteBranches.length}</span>
            </span>
          </div>
          <div className="scroll-region">
            {remoteBranches.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                onCheckout={onCheckout}
              />
            ))}
          </div>
        </>
      )}

      {/* Remotes section */}
      {remotes && (
        <RemotesSection
          remotes={remotes}
          onAdd={onAddRemote}
          onRemove={onRemoveRemote}
          onRename={onRenameRemote}
        />
      )}
    </div>
  );
}

function BranchRow({
  branch,
  onCheckout,
  onDelete,
  onMerge,
}: {
  branch: BranchInfo;
  onCheckout: (name: string) => Promise<void>;
  onDelete?: (name: string) => Promise<void>;
  onMerge?: (name: string) => Promise<void>;
}) {
  return (
    <div className="data-row">
      <span className={`data-row-main mono${branch.is_head ? " branch-head" : ""}`}>
        {branch.is_head && "* "}
        {branch.name}
      </span>

      {branch.upstream && (
        <span className="row-meta" title={branch.upstream}>
          {branch.upstream}
        </span>
      )}

      {!branch.is_head && (
        <div className="row-actions">
          {onMerge && !branch.is_remote && (
            <button
              onClick={() => onMerge(branch.name)}
              className="row-action"
            >
              merge
            </button>
          )}
          <button
            onClick={() => onCheckout(branch.name)}
            className="row-action"
          >
            checkout
          </button>
          {onDelete && !branch.is_remote && (
            <button
              onClick={() => onDelete(branch.name)}
              className="row-action danger"
            >
              delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RemotesSection({
  remotes,
  onAdd,
  onRemove,
  onRename,
}: {
  remotes: RemoteInfo[];
  onAdd?: (name: string, url: string) => Promise<void>;
  onRemove?: (name: string) => Promise<void>;
  onRename?: (oldName: string, newName: string) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [renamingRemote, setRenamingRemote] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleAdd = async () => {
    if (!addName.trim() || !addUrl.trim() || !onAdd) return;
    await onAdd(addName.trim(), addUrl.trim());
    setAddName("");
    setAddUrl("");
    setShowAdd(false);
  };

  const handleRename = async (oldName: string) => {
    if (!renameValue.trim() || !onRename) return;
    await onRename(oldName, renameValue.trim());
    setRenamingRemote(null);
    setRenameValue("");
  };

  return (
    <>
      <div className="section-header">
        <span className="section-title">
          Remotes
          <span className="section-count">{remotes.length}</span>
        </span>
        {onAdd && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="section-action"
          >
            + Add
          </button>
        )}
      </div>

      {showAdd && (
        <div className="inline-form stack">
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="name (e.g. upstream)"
            aria-label="Remote name"
            className="control compact mono"
          />
          <input
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="https://github.com/user/repo.git"
            aria-label="Remote URL"
            className="control compact mono"
          />
          <button
            onClick={handleAdd}
            disabled={!addName.trim() || !addUrl.trim()}
            className="button compact primary self-end"
          >
            Add Remote
          </button>
        </div>
      )}

      <div className="scroll-region">
        {remotes.length === 0 ? (
          <p className="empty-row">No remotes configured</p>
        ) : (
          remotes.map((remote) => (
            <div key={remote.name} className="data-row">
              {renamingRemote === remote.name ? (
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(remote.name);
                    if (e.key === "Escape") setRenamingRemote(null);
                  }}
                  onBlur={() => setRenamingRemote(null)}
                  autoFocus
                  aria-label={`Rename ${remote.name}`}
                  className="control compact mono"
                />
              ) : (
                <>
                  <span className="mono">{remote.name}</span>
                  <span className="data-row-main mono" title={remote.url}>
                    {remote.url}
                  </span>
                </>
              )}
              <div className="row-actions">
                {onRename && (
                  <button
                    onClick={() => {
                      setRenamingRemote(remote.name);
                      setRenameValue(remote.name);
                    }}
                    className="row-action"
                  >
                    rename
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={() => onRemove(remote.name)}
                    className="row-action danger"
                  >
                    remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
