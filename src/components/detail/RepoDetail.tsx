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
import ThemeSwitcher from "../ThemeSwitcher";

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
    <div className="detail-shell">
      {/* Header */}
      <header className="detail-header">
        <button
          onClick={onClose}
          className="icon-button"
          title="Back to dashboard (Esc)"
          aria-label="Back to dashboard"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="detail-identity">
          <h1>{repo.name}</h1>
          <p>{repo.path}</p>
        </div>

        <span className="branch-pill">
          {repo.branch}
        </span>

        {/* Git profile */}
        {detail.profile && (
          <div className="profile">
            <button
              onClick={() => setShowProfileEdit(!showProfileEdit)}
              className="profile-trigger"
              title={`${detail.profile.name} <${detail.profile.email}>`}
            >
              {detail.profile.name || "Set profile"}
            </button>
            {showProfileEdit && (
              <div className="popover">
                <div className="form-stack">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="user.name"
                    aria-label="Git user name"
                    className="control compact mono"
                  />
                  <input
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="user.email"
                    aria-label="Git user email"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                    className="control compact mono"
                  />
                  <button
                    onClick={handleSaveProfile}
                    className="button compact primary"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Remote operations */}
        <div className="remote-actions">
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
            className="button compact success"
          >
            Create PR
          </button>
        </div>

        {/* Loading action indicator */}
        {detail.loadingAction && (
          <span className="activity-label" role="status">
            {detail.loadingAction}
          </span>
        )}

        <ThemeSwitcher />

        {/* Tabs */}
        <nav className="detail-tabs" role="tablist" aria-label="Repository sections">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              id={`tab-${tab.key}`}
              aria-controls={`panel-${tab.key}`}
              aria-selected={activeTab === tab.key}
              title={`${tab.label} (${i + 1})`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Toast notifications */}
      {detail.successMessage && (
        <div className="message success detail-message" role="status">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <strong>Success</strong>
          <span>{detail.successMessage}</span>
        </div>
      )}

      {/* Error */}
      {detail.error && (
        <div className="message error detail-message" role="alert">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="7" cy="10.5" r="0.75" fill="currentColor"/>
          </svg>
          <strong>Error</strong>
          <span>{detail.error}</span>
        </div>
      )}

      {/* Content */}
      <div
        className={`detail-content${activeTab === "changes" || activeTab === "history" ? " split-view" : ""}`}
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "changes" && (
          <>
            {/* Left: file list + commit form */}
            <div className="side-panel">
              <div className="scroll-region">
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
            <div className="content-panel">
              <DiffViewer diff={detail.diff} />
            </div>
          </>
        )}

        {activeTab === "history" && (
          <>
            {/* Left: branch graph + commit list */}
            <div className="side-panel graph-panel">
              <CommitGraph
                commits={detail.commits}
                selectedOid={selectedCommit}
                onSelect={handleSelectCommit}
                onMergeDrop={handleMergeDrop}
              />
            </div>
            {/* Right: commit details + diff */}
            <div className="content-panel">
              {/* Commit files panel */}
              {selectedCommit && detail.commitFiles.length > 0 && (
                <div className="shrink-0 border-b border-[var(--border)]">
                  <div className="section-header">
                    <span className="section-title">
                      Changed Files
                      <span className="section-count">{detail.commitFiles.length}</span>
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
                        className="section-action"
                      >
                        Squash {squashCount} commits
                      </button>
                    )}
                  </div>
                  {showSquash && (
                    <div className="inline-form stack">
                      <textarea
                        value={squashMessage}
                        onChange={(e) => setSquashMessage(e.target.value)}
                        rows={3}
                        aria-label="Squash commit message"
                        className="control compact mono"
                        placeholder="Squash commit message..."
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSquash}
                          disabled={!squashMessage.trim()}
                          className="button compact warning"
                        >
                          Squash
                        </button>
                        <button
                          onClick={() => setShowSquash(false)}
                          className="button compact ghost"
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
              <div className="scroll-region">
                <DiffViewer diff={detail.diff} />
              </div>
            </div>
          </>
        )}

        {activeTab === "branches" && (
          <div className="full-panel">
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
          <div className="full-panel">
            <StashPanel
              stashes={detail.stashes}
              onSave={detail.saveStash}
              onPop={detail.popStash}
              onDrop={detail.dropStash}
            />
          </div>
        )}

        {activeTab === "readme" && (
          <div className="full-panel">
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
    added: "status-added",
    deleted: "status-deleted",
    modified: "status-modified",
    renamed: "status-renamed",
    copied: "status-copied",
  };
  const statusLetters: Record<string, string> = {
    added: "A",
    deleted: "D",
    modified: "M",
    renamed: "R",
    copied: "C",
  };

  return (
    <div className="data-row">
      <span className={`status-letter ${statusColors[file.status] || "status-untracked"}`}>
        {statusLetters[file.status] || "?"}
      </span>
      <span className="data-row-main mono">{file.path}</span>
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
    <aside className="slide-over" aria-label={`History for ${filePath}`}>
      <div className="slide-over-header">
        <div className="min-w-0">
          <h2>File History</h2>
          <p>{filePath}</p>
        </div>
        <button
          onClick={onClose}
          className="icon-button"
          aria-label="Close file history"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="scroll-region">
        {history.length === 0 ? (
          <p className="empty-row">Loading…</p>
        ) : (
          history.map((commit) => (
            <button
              key={commit.oid}
              onClick={() => onSelectCommit(commit.oid)}
              className="commit-row"
            >
              <div className="commit-copy">
              <div className="commit-subject"><p>{commit.message.split("\n")[0]}</p></div>
              <div className="commit-meta">
                <span className="oid">{commit.short_oid}</span>
                <span className="author">{commit.author}</span>
                <time dateTime={commit.date}>
                  {new Date(commit.date).toLocaleDateString()}
                </time>
              </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
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
      className={`button compact${isThisAction ? " info" : " subtle"}`}
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
    <svg className="spinner" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M6 1A5 5 0 0 1 11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
