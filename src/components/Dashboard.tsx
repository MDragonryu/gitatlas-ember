import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepos } from "../hooks/useRepos";
import type { RepoHealth, RepoInfo } from "../types";
import FilterBar from "./FilterBar";
import RepoList from "./RepoList";
import BulkActions from "./BulkActions";
import GitHubLink from "./GitHubLink";
import ThemeSwitcher from "./ThemeSwitcher";
import RepoDetail from "./detail/RepoDetail";

export default function Dashboard() {
  const {
    repos, loading, error,
    scanRepos, fetchAll, pullAll,
    fetchRepo, pullRebaseRepo, pushRepo, refreshRepo,
  } = useRepos();
  const [scanRoots, setScanRoots] = useState<string[]>([]);
  const [editingRoot, setEditingRoot] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<RepoHealth>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<RepoInfo | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("get_scan_roots")
      .then(setScanRoots)
      .catch((err) => setSettingsError(String(err)));
  }, []);

  const handleScan = () => {
    if (scanRoots.length > 0) {
      scanRepos(scanRoots);
    }
  };

  const saveScanRoot = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const roots = [trimmed];
      setSettingsError(null);
      try {
        await invoke("set_scan_roots", { roots });
        setScanRoots(roots);
        setEditingRoot(null);
      } catch (err) {
        setSettingsError(String(err));
      }
    },
    [],
  );

  const closeRepoDetail = useCallback(async () => {
    if (selectedRepo) {
      try {
        await refreshRepo(selectedRepo.path);
      } catch {
        // The dashboard's existing status remains usable if the repo disappeared.
      }
    }
    setSelectedRepo(null);
  }, [refreshRepo, selectedRepo]);

  const toggleFilter = (health: RepoHealth) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(health)) {
        next.delete(health);
      } else {
        next.add(health);
      }
      return next;
    });
  };

  const filteredRepos = useMemo(() => {
    let result = repos;

    if (activeFilters.size > 0) {
      result = result.filter((r) => activeFilters.has(r.health));
    }

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.branch.toLowerCase().includes(query) ||
          r.path.toLowerCase().includes(query),
      );
    }

    return result;
  }, [repos, activeFilters, search]);

  // Show detail view as fullscreen overlay
  if (selectedRepo) {
    return (
      <RepoDetail
        repo={selectedRepo}
        onClose={closeRepoDetail}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="dashboard">
      <header className="dashboard-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="5" r="2" fill="currentColor" />
              <circle cx="18" cy="8" r="2" fill="currentColor" />
              <circle cx="8" cy="19" r="2" fill="currentColor" />
              <path d="M6 7v4.5a3 3 0 0 0 3 3h3a4 4 0 0 0 4-4V10M8 17v-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="brand-copy">
            <span className="eyebrow">Repository workspace</span>
            <div className="brand-row">
              <h1>GitAtlas</h1>
              <GitHubLink url="https://github.com/grahambrooks/gitatlas" className="h-4 w-4" />
            </div>
            <p className="subtitle">Multi-repo observability, without the noise.</p>
          </div>
        </div>
        <div className="header-actions">
          <ThemeSwitcher />
          <BulkActions
            onFetchAll={fetchAll}
            onPullAll={pullAll}
            disabled={loading}
            repoCount={repos.length}
          />
          <button
            onClick={handleScan}
            disabled={loading || scanRoots.length === 0}
            className="button primary"
          >
            {loading ? "Scanning..." : "Scan for Repos"}
          </button>
        </div>
      </header>

      <section className="scan-bar" aria-label="Repository scan location">
        <span className="scan-label">Scan root</span>
        {editingRoot !== null ? (
          <form
            className="min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              saveScanRoot(editingRoot);
            }}
          >
            <input
              autoFocus
              type="text"
              value={editingRoot}
              onChange={(e) => setEditingRoot(e.target.value)}
              onBlur={() => saveScanRoot(editingRoot)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingRoot(null);
              }}
              aria-label="Scan root path"
              className="control compact mono"
            />
          </form>
        ) : (
          <button
            onClick={() => setEditingRoot(scanRoots[0] ?? "")}
            className="scan-path"
            title="Click to change scan root"
          >
            {scanRoots[0] ?? "Not set"}
          </button>
        )}
        <span className="count-label">{repos.length} indexed</span>
      </section>

      {(error || settingsError) && (
        <div className="message error" role="alert">
          <strong>Error</strong>
          <span>{error || settingsError}</span>
        </div>
      )}

      {repos.length > 0 && (
        <FilterBar
          repos={repos}
          activeFilters={activeFilters}
          onToggleFilter={toggleFilter}
          search={search}
          onSearchChange={setSearch}
        />
      )}

      <div className="result-count" role="status">
        {repos.length === 0
          ? "No repositories scanned yet"
          : filteredRepos.length === repos.length
            ? `${repos.length} repositories`
            : `${filteredRepos.length} of ${repos.length} repositories`}
      </div>

      <RepoList
        repos={filteredRepos}
        onFetch={fetchRepo}
        onPullRebase={pullRebaseRepo}
        onPush={pushRepo}
        onOpen={setSelectedRepo}
      />
      </div>
    </main>
  );
}
