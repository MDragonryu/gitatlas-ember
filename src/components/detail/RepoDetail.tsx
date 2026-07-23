import { useState, useEffect, useCallback } from "react";
import type { RepoInfo, CommitFileChange } from "../../types";
import { useRepoDetail } from "../../hooks/useRepoDetail";
import CommitGraph from "./CommitGraph";
import FileChanges from "./FileChanges";
import DiffViewer from "./DiffViewer";
import CommitForm from "./CommitForm";
import BranchPanel from "./BranchPanel";
import StashPanel from "./StashPanel";
import ReadmeViewer from "./ReadmeViewer";

type Tab = "changes" | "history" | "branches" | "stashes" | "readme";

interface RepoDetailProps {
  repo: RepoInfo;
  onClose: () => void;
}

export default function RepoDetail({ repo, onClose }: RepoDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("changes");
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedCommitIndex, setSelectedCommitIndex] = useState(0);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [showSquash, setShowSquash] = useState(false);
  const [squashMessage, setSquashMessage] = useState("");

  const detail = useRepoDetail(repo.path);
  const {
    loadBranches,
    loadChanges,
    loadCommits,
    loadProfile,
    loadReadme,
    loadRemotes,
    loadStashes,
    setDiff,
  } = detail;

  // Load data for the active tab
  useEffect(() => {
    if (activeTab === "changes") {
      loadChanges();
    } else if (activeTab === "history") {
      loadCommits();
    } else if (activeTab === "branches") {
      loadBranches();
      loadRemotes();
    } else if (activeTab === "stashes") {
      loadStashes();
    } else if (activeTab === "readme") {
      loadReadme();
    }
    // Reset selections on tab switch
    setDiff("");
    setSelectedCommit(null);
    setSelectedFile(null);
    setSelectedFileIndex(0);
    setSelectedCommitIndex(0);
    setShowSquash(false);
  }, [
    activeTab,
    loadBranches,
    loadChanges,
    loadCommits,
    loadReadme,
    loadRemotes,
    loadStashes,
    setDiff,
  ]);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Sync profile edit form when profile loads
  useEffect(() => {
    if (detail.profile) {
      setProfileName(detail.profile.name);
      setProfileEmail(detail.profile.email);
    }
  }, [detail.profile]);

  const handleSelectCommit = useCallback(
    async (oid: string) => {
      setSelectedCommit(oid);
      setSelectedFile(null);
      setShowSquash(false);
      const idx = detail.commits.findIndex((c) => c.oid === oid);
      if (idx >= 0) setSelectedCommitIndex(idx);
      await Promise.all([
        detail.loadCommitDiff(oid),
        detail.loadCommitFiles(oid),
      ]);
    },
    [detail],
  );

  const handleSelectFile = useCallback(
    async (filePath: string, staged: boolean) => {
      setSelectedFile(filePath);
      setSelectedCommit(null);
      const idx = detail.changes.findIndex((c) => c.path === filePath);
      if (idx >= 0) setSelectedFileIndex(idx);
      await detail.loadFileDiff(filePath, staged);
    },
    [detail],
  );

  // Compute squash distance: how many linear commits from HEAD to selected commit
  const squashCount = (() => {
    if (!selectedCommit || activeTab !== "history") return 0;
    const idx = detail.commits.findIndex((c) => c.oid === selectedCommit);
    if (idx <= 0) return 0;
    // Check linearity (each commit has exactly 1 parent that's the next in the list)
    for (let i = 0; i < idx; i++) {
      const commit = detail.commits[i];
      if (commit.parents.length !== 1) return 0;
      const nextOid = detail.commits[i + 1]?.short_oid;
      if (!nextOid || !commit.parents.includes(nextOid)) return 0;
    }
    return idx + 1;
  })();

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Tab switching: 1–5
      const tabKeys: Tab[] = ["changes", "history", "branches", "stashes", "readme"];
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        setActiveTab(tabKeys[parseInt(e.key) - 1]);
        return;
      }

      // Escape: close detail view
      if (e.key === "Escape") {
        e.preventDefault();
        if (detail.fileHistoryPath) {
          detail.closeFileHistory();
        } else {
          onClose();
        }
        return;
      }

      // Cmd+S: stage selected file
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab === "changes" && selectedFile) {
          const file = detail.changes.find((c) => c.path === selectedFile);
          if (file && !file.staged) {
            detail.stageFiles([file.path]);
          } else if (file && file.staged) {
            detail.unstageFiles([file.path]);
          }
        }
        return;
      }

      // j/k: navigate
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const delta = e.key === "j" ? 1 : -1;

        if (activeTab === "history") {
          const newIdx = Math.max(0, Math.min(detail.commits.length - 1, selectedCommitIndex + delta));
          if (detail.commits[newIdx]) {
            handleSelectCommit(detail.commits[newIdx].oid);
          }
        } else if (activeTab === "changes") {
          const newIdx = Math.max(0, Math.min(detail.changes.length - 1, selectedFileIndex + delta));
          if (detail.changes[newIdx]) {
            handleSelectFile(detail.changes[newIdx].path, detail.changes[newIdx].staged);
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeTab,
    selectedFile,
    selectedCommitIndex,
    selectedFileIndex,
    detail,
    onClose,
    handleSelectCommit,
    handleSelectFile,
  ]);

  const handleMergeDrop = useCallback(
    (sourceBranch: string, targetOid: string) => {
      // Only merge onto the HEAD commit
      const headCommit = detail.commits.find((c) =>
        c.refs.some((r) => r.kind === "head"),
      );
      if (headCommit && headCommit.oid === targetOid) {
        detail.mergeBranch(sourceBranch);
      }
    },
    [detail],
  );

  const handleSaveProfile = async () => {
    await detail.updateProfile(profileName, profileEmail);
    setShowProfileEdit(false);
  };

  const handleSquash = async () => {
    if (squashCount < 2 || !squashMessage.trim()) return;
    await detail.squashCommits(squashCount, squashMessage.trim());
    setShowSquash(false);
    setSquashMessage("");
    setSelectedCommit(null);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "changes", label: "Changes" },
    { key: "history", label: "History" },
    { key: "branches", label: "Branches" },
    { key: "stashes", label: "Stashes" },
    { key: "readme", label: "Readme" },
  ];

  const stagedCount = detail.changes.filter((c) => c.staged).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-slate-700 px-4 py-3 shrink-0">
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition"
          title="Back to dashboard (Esc)"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">{repo.name}</h2>
          <p className="text-xs text-slate-500 font-mono truncate">{repo.path}</p>
        </div>

        <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs font-mono text-blue-300 shrink-0">
          {repo.branch}
        </span>

        {/* Git profile */}
        {detail.profile && (
          <div className="relative">
            <button
              onClick={() => setShowProfileEdit(!showProfileEdit)}
              className="text-xs text-slate-400 hover:text-slate-200 transition truncate max-w-32"
              title={`${detail.profile.name} <${detail.profile.email}>`}
            >
              {detail.profile.name || "Set profile"}
            </button>
            {showProfileEdit && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded border border-slate-700 bg-slate-800 p-3 shadow-lg">
                <div className="flex flex-col gap-2 w-56">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="user.name"
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-slate-500"
                  />
                  <input
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="user.email"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-slate-500"
                  />
                  <button
                    onClick={handleSaveProfile}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Remote operations */}
        <div className="flex items-center gap-1.5 ml-4">
          <HeaderButton
            label="Fetch"
            loading={detail.loading}
            loadingAction={detail.loadingAction}
            activeLabel="Fetching…"
            onClick={detail.fetchRemote}
          />
          <HeaderButton
            label="Pull"
            loading={detail.loading}
            loadingAction={detail.loadingAction}
            activeLabel="Pulling…"
            onClick={detail.pullRebase}
          />
          <HeaderButton
            label="Push"
            loading={detail.loading}
            loadingAction={detail.loadingAction}
            activeLabel="Pushing…"
            onClick={detail.push}
          />
          <button
            onClick={detail.openPullRequest}
            className="rounded px-2.5 py-1 text-xs font-medium bg-green-700/80 text-green-100 hover:bg-green-600 transition"
          >
            Create PR
          </button>
        </div>

        {/* Loading action indicator */}
        {detail.loadingAction && (
          <span className="text-xs text-blue-400 animate-pulse shrink-0">
            {detail.loadingAction}
          </span>
        )}

        <div className="ml-auto" />

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
              title={`${tab.label} (${i + 1})`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Toast notifications */}
      {detail.successMessage && (
        <div className="mx-4 mt-2 rounded bg-green-900/30 border border-green-800 px-3 py-2 text-xs text-green-300 shrink-0 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {detail.successMessage}
        </div>
      )}

      {/* Error */}
      {detail.error && (
        <div className="mx-4 mt-2 rounded bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-300 shrink-0 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="7" cy="10.5" r="0.75" fill="currentColor"/>
          </svg>
          <span className="flex-1">{detail.error}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {activeTab === "changes" && (
          <>
            {/* Left: file list + commit form */}
            <div className="flex w-80 shrink-0 flex-col border-r border-slate-700">
              <div className="flex-1 min-h-0 overflow-auto">
                <FileChanges
                  changes={detail.changes}
                  selectedFile={selectedFile}
                  onSelectFile={handleSelectFile}
                  onStageFiles={detail.stageFiles}
                  onUnstageFiles={detail.unstageFiles}
                  onStageAll={detail.stageAll}
                  onUnstageAll={detail.unstageAll}
                  onFileHistory={detail.loadFileHistory}
                />
              </div>
              <CommitForm stagedCount={stagedCount} onCommit={detail.createCommit} />
            </div>
            {/* Right: diff */}
            <div className="flex-1 min-h-0 overflow-auto">
              <DiffViewer diff={detail.diff} />
            </div>
          </>
        )}

        {activeTab === "history" && (
          <>
            {/* Left: branch graph + commit list */}
            <div className="w-[560px] shrink-0 overflow-auto border-r border-slate-700">
              <CommitGraph
                commits={detail.commits}
                selectedOid={selectedCommit}
                onSelect={handleSelectCommit}
                onMergeDrop={handleMergeDrop}
              />
            </div>
            {/* Right: commit details + diff */}
            <div className="flex-1 min-h-0 overflow-auto flex flex-col">
              {/* Commit files panel */}
              {selectedCommit && detail.commitFiles.length > 0 && (
                <div className="border-b border-slate-700 shrink-0">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Changed Files
                      <span className="ml-1.5 text-slate-500">{detail.commitFiles.length}</span>
                    </span>
                    {squashCount >= 2 && (
                      <button
                        onClick={() => {
                          setShowSquash(!showSquash);
                          setSquashMessage(
                            detail.commits
                              .slice(0, squashCount)
                              .map((c) => c.message)
                              .join("\n\n"),
                          );
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 transition"
                      >
                        Squash {squashCount} commits
                      </button>
                    )}
                  </div>
                  {showSquash && (
                    <div className="px-3 pb-2 flex flex-col gap-1.5">
                      <textarea
                        value={squashMessage}
                        onChange={(e) => setSquashMessage(e.target.value)}
                        rows={3}
                        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-mono text-slate-200 outline-none focus:border-slate-500 resize-none"
                        placeholder="Squash commit message..."
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSquash}
                          disabled={!squashMessage.trim()}
                          className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-500 disabled:opacity-40"
                        >
                          Squash
                        </button>
                        <button
                          onClick={() => setShowSquash(false)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="max-h-40 overflow-auto">
                    {detail.commitFiles.map((file) => (
                      <CommitFileRow key={file.path} file={file} />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-auto">
                <DiffViewer diff={detail.diff} />
              </div>
            </div>
          </>
        )}

        {activeTab === "branches" && (
          <div className="flex-1 overflow-auto">
            <BranchPanel
              branches={detail.branches}
              onCheckout={detail.checkoutBranch}
              onCreate={detail.createBranch}
              onDelete={detail.deleteBranch}
              onMerge={detail.mergeBranch}
              remotes={detail.remotes}
              onAddRemote={detail.addRemote}
              onRemoveRemote={detail.removeRemote}
              onRenameRemote={detail.renameRemote}
            />
          </div>
        )}

        {activeTab === "stashes" && (
          <div className="flex-1 overflow-auto">
            <StashPanel
              stashes={detail.stashes}
              onSave={detail.saveStash}
              onPop={detail.popStash}
              onDrop={detail.dropStash}
            />
          </div>
        )}

        {activeTab === "readme" && (
          <div className="flex-1 overflow-auto">
            <ReadmeViewer content={detail.readme} />
          </div>
        )}
      </div>

      {/* File history slide-over */}
      {detail.fileHistoryPath && (
        <FileHistoryPanel
          filePath={detail.fileHistoryPath}
          history={detail.fileHistory}
          onSelectCommit={async (oid) => {
            setActiveTab("history");
            detail.closeFileHistory();
            // Small delay to let tab switch load commits
            setTimeout(() => handleSelectCommit(oid), 100);
          }}
          onClose={detail.closeFileHistory}
        />
      )}
    </div>
  );
}

function CommitFileRow({ file }: { file: CommitFileChange }) {
  const statusColors: Record<string, string> = {
    added: "text-green-400",
    deleted: "text-red-400",
    modified: "text-yellow-400",
    renamed: "text-blue-400",
    copied: "text-cyan-400",
  };
  const statusLetters: Record<string, string> = {
    added: "A",
    deleted: "D",
    modified: "M",
    renamed: "R",
    copied: "C",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-0.5 text-xs hover:bg-slate-700/30">
      <span className={`font-mono font-bold w-3 ${statusColors[file.status] || "text-slate-400"}`}>
        {statusLetters[file.status] || "?"}
      </span>
      <span className="font-mono text-slate-300 truncate">{file.path}</span>
    </div>
  );
}

function FileHistoryPanel({
  filePath,
  history,
  onSelectCommit,
  onClose,
}: {
  filePath: string;
  history: import("../../types").CommitInfo[];
  onSelectCommit: (oid: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-60 w-96 bg-slate-800 border-l border-slate-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">File History</h3>
          <p className="text-xs font-mono text-slate-400 truncate">{filePath}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {history.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">Loading...</p>
        ) : (
          history.map((commit) => (
            <button
              key={commit.oid}
              onClick={() => onSelectCommit(commit.oid)}
              className="w-full text-left px-4 py-2 border-b border-slate-700/50 hover:bg-slate-700/30 transition"
            >
              <p className="text-sm text-slate-200 truncate">{commit.message.split("\n")[0]}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-mono text-slate-400">{commit.short_oid}</span>
                <span className="truncate">{commit.author}</span>
                <span className="ml-auto shrink-0">
                  {new Date(commit.date).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function HeaderButton({
  label,
  loading,
  loadingAction,
  activeLabel,
  onClick,
}: {
  label: string;
  loading: boolean;
  loadingAction: string | null;
  activeLabel: string;
  onClick: () => Promise<void>;
}) {
  const isThisAction = loadingAction === activeLabel;

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded px-2.5 py-1 text-xs font-medium transition ${
        isThisAction
          ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
          : "bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-white"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {isThisAction ? (
        <span className="flex items-center gap-1.5">
          <Spinner />
          {activeLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M6 1A5 5 0 0 1 11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
