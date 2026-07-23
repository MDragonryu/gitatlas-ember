import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BulkOperationResult, RepoInfo } from "../types";

export function useRepos() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached repos on mount for instant startup
  useEffect(() => {
    invoke<RepoInfo[]>("load_cached_repos")
      .then((cached) => {
        if (cached.length > 0) setRepos(cached);
      })
      .catch(() => {});
  }, []);

  const updateRepo = useCallback((updated: RepoInfo) => {
    setRepos((prev) =>
      prev.map((r) => (r.path === updated.path ? updated : r)),
    );
  }, []);

  const scanRepos = useCallback(async (roots: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<RepoInfo[]>("scan_directories", { roots });
      setRepos(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<RepoInfo[]>("get_all_repos");
      setRepos(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRepo = useCallback(
    async (path: string) => {
      const updated = await invoke<RepoInfo>("get_repo_status", { path });
      updateRepo(updated);
    },
    [updateRepo],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<BulkOperationResult>("fetch_all");
      setRepos(result.repos);
      if (result.errors.length > 0) {
        setError(`Fetch failed for ${result.errors.join("; ")}`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const pullAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<BulkOperationResult>("pull_all");
      setRepos(result.repos);
      if (result.errors.length > 0) {
        setError(`Pull failed for ${result.errors.join("; ")}`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRepo = useCallback(
    async (path: string) => {
      const updated = await invoke<RepoInfo>("fetch_repo", { path });
      updateRepo(updated);
    },
    [updateRepo],
  );

  const pullRebaseRepo = useCallback(
    async (path: string) => {
      const updated = await invoke<RepoInfo>("pull_rebase_repo", { path });
      updateRepo(updated);
    },
    [updateRepo],
  );

  const pushRepo = useCallback(
    async (path: string) => {
      const updated = await invoke<RepoInfo>("push_repo", { path });
      updateRepo(updated);
    },
    [updateRepo],
  );

  return {
    repos,
    loading,
    error,
    scanRepos,
    refreshRepos,
    refreshRepo,
    fetchAll,
    pullAll,
    fetchRepo,
    pullRebaseRepo,
    pushRepo,
  };
}
