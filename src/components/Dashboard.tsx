import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepos } from "../hooks/useRepos";
import type { RepoHealth, RepoInfo } from "../types";
import FilterBar from "./FilterBar";
import RepoList from "./RepoList";
import BulkActions from "./BulkActions";
import GitHubLink from "./GitHubLink";
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
    <div className="px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">GitAtlas</h1>
            <p className="text-sm text-slate-400">
              Multi-repo observability dashboard
            </p>
          </div>
          <GitHubLink url="https://github.com/grahambrooks/gitatlas" className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-3">
          <BulkActions
            onFetchAll={fetchAll}
            onPullAll={pullAll}
            disabled={loading}
            repoCount={repos.length}
          />
          <button
            onClick={handleScan}
            disabled={loading || scanRoots.length === 0}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Scanning..." : "Scan for Repos"}
          </button>
        </div>
      </header>

      <div className="mb-6 flex items-center gap-2 text-sm">
        <span className="text-slate-500 shrink-0">Scan root:</span>
        {editingRoot !== null ? (
          <form
            className="flex items-center gap-2 flex-1 min-w-0"
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
              className="flex-1 min-w-0 rounded bg-slate-800 border border-slate-600 px-2 py-0.5 text-sm font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => setEditingRoot(scanRoots[0] ?? "")}
            className="truncate font-mono text-slate-300 hover:text-white transition cursor-pointer"
            title="Click to change scan root"
          >
            {scanRoots[0] ?? "Not set"}
          </button>
        )}
      </div>

      {(error || settingsError) && (
        <div className="mb-4 rounded-md bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error || settingsError}
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

      <div className="mb-4 text-sm text-slate-500">
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
  );
}
