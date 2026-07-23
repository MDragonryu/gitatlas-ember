import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  CommitInfo,
  FileChange,
  BranchInfo,
  StashEntry,
  CommitFileChange,
  RemoteInfo,
  GitProfile,
} from "../types";

export function useRepoDetail(repoPath: string) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [diff, setDiff] = useState<string>("");
  const [readme, setReadme] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New state for features
  const [commitFiles, setCommitFiles] = useState<CommitFileChange[]>([]);
  const [fileHistory, setFileHistory] = useState<CommitInfo[]>([]);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [profile, setProfile] = useState<GitProfile | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const withError = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const showSuccess = useCallback((msg: string) => {
    if (successTimer.current) clearTimeout(successTimer.current);
    setSuccessMessage(msg);
    successTimer.current = setTimeout(() => {
      setSuccessMessage(null);
      successTimer.current = null;
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    },
    [],
  );

  // ── Commits ──

  const loadCommits = useCallback(
    async (count = 100) => {
      setLoading(true);
      await withError(async () => {
        const result = await invoke<CommitInfo[]>("get_commit_log", {
          path: repoPath,
          count,
        });
        setCommits(result);
      });
      setLoading(false);
    },
    [repoPath, withError],
  );

  const loadCommitDiff = useCallback(
    async (oid: string) => {
      await withError(async () => {
        const result = await invoke<string>("get_commit_diff", {
          path: repoPath,
          oid,
        });
        setDiff(result);
      });
    },
    [repoPath, withError],
  );

  // ── Commit files (details panel) ──

  const loadCommitFiles = useCallback(
    async (oid: string) => {
      await withError(async () => {
        const result = await invoke<CommitFileChange[]>("get_commit_files", {
          path: repoPath,
          oid,
        });
        setCommitFiles(result);
      });
    },
    [repoPath, withError],
  );

  // ── File changes ──

  const loadChanges = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<FileChange[]>("get_file_changes", {
        path: repoPath,
      });
      setChanges(result);
    });
  }, [repoPath, withError]);

  const loadFileDiff = useCallback(
    async (filePath: string, staged: boolean) => {
      await withError(async () => {
        const result = await invoke<string>("get_file_diff", {
          path: repoPath,
          filePath,
          staged,
        });
        setDiff(result);
      });
    },
    [repoPath, withError],
  );

  // ── Staging ──

  const stageFiles = useCallback(
    async (files: string[]) => {
      await withError(async () => {
        const result = await invoke<FileChange[]>("stage_files", {
          path: repoPath,
          files,
        });
        setChanges(result);
      });
    },
    [repoPath, withError],
  );

  const unstageFiles = useCallback(
    async (files: string[]) => {
      await withError(async () => {
        const result = await invoke<FileChange[]>("unstage_files", {
          path: repoPath,
          files,
        });
        setChanges(result);
      });
    },
    [repoPath, withError],
  );

  const stageAll = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<FileChange[]>("stage_all_files", {
        path: repoPath,
      });
      setChanges(result);
    });
  }, [repoPath, withError]);

  const unstageAll = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<FileChange[]>("unstage_all_files", {
        path: repoPath,
      });
      setChanges(result);
    });
  }, [repoPath, withError]);

  // ── Commit ──

  const createCommit = useCallback(
    async (message: string) => {
      await withError(async () => {
        await invoke<string>("create_commit", { path: repoPath, message });
        await loadChanges();
        await loadCommits();
      });
    },
    [repoPath, withError, loadChanges, loadCommits],
  );

  // ── Branches ──

  const loadBranches = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<BranchInfo[]>("get_branches", {
        path: repoPath,
      });
      setBranches(result);
    });
  }, [repoPath, withError]);

  const checkoutBranch = useCallback(
    async (branchName: string) => {
      await withError(async () => {
        await invoke("checkout_branch", {
          path: repoPath,
          branchName,
        });
        await loadBranches();
      });
    },
    [repoPath, withError, loadBranches],
  );

  const createBranch = useCallback(
    async (branchName: string) => {
      await withError(async () => {
        await invoke("create_branch", { path: repoPath, branchName });
        await loadBranches();
      });
    },
    [repoPath, withError, loadBranches],
  );

  const deleteBranch = useCallback(
    async (branchName: string) => {
      await withError(async () => {
        await invoke("delete_branch", { path: repoPath, branchName });
        await loadBranches();
      });
    },
    [repoPath, withError, loadBranches],
  );

  // ── Merge ──

  const mergeBranch = useCallback(
    async (branchName: string) => {
      setLoading(true);
      setLoadingAction("Merging…");
      await withError(async () => {
        const result = await invoke<string>("merge_branch", {
          path: repoPath,
          branchName,
        });
        await loadCommits();
        await loadBranches();
        await loadChanges();
        showSuccess(result);
      });
      setLoadingAction(null);
      setLoading(false);
    },
    [repoPath, withError, loadCommits, loadBranches, loadChanges, showSuccess],
  );

  // ── Remote operations ──

  const fetchRemote = useCallback(async () => {
    setLoading(true);
    setLoadingAction("Fetching…");
    await withError(async () => {
      await invoke("fetch_repo", { path: repoPath });
      await loadCommits();
      await loadBranches();
      showSuccess("Fetch complete");
    });
    setLoadingAction(null);
    setLoading(false);
  }, [repoPath, withError, loadCommits, loadBranches, showSuccess]);

  const pullRebase = useCallback(async () => {
    setLoading(true);
    setLoadingAction("Pulling…");
    await withError(async () => {
      await invoke("pull_rebase_repo", { path: repoPath });
      await loadCommits();
      await loadChanges();
      await loadBranches();
      showSuccess("Pull complete");
    });
    setLoadingAction(null);
    setLoading(false);
  }, [repoPath, withError, loadCommits, loadChanges, loadBranches, showSuccess]);

  const push = useCallback(async () => {
    setLoading(true);
    setLoadingAction("Pushing…");
    await withError(async () => {
      await invoke("push_repo", { path: repoPath });
      await loadCommits();
      showSuccess("Push complete");
    });
    setLoadingAction(null);
    setLoading(false);
  }, [repoPath, withError, loadCommits, showSuccess]);

  // ── Stashes ──

  const loadStashes = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<StashEntry[]>("get_stashes", {
        path: repoPath,
      });
      setStashes(result);
    });
  }, [repoPath, withError]);

  const saveStash = useCallback(
    async (message: string) => {
      await withError(async () => {
        await invoke("stash_save", { path: repoPath, message });
        await loadStashes();
        await loadChanges();
      });
    },
    [repoPath, withError, loadStashes, loadChanges],
  );

  const popStash = useCallback(
    async (index: number) => {
      await withError(async () => {
        await invoke("stash_pop", { path: repoPath, index });
        await loadStashes();
        await loadChanges();
      });
    },
    [repoPath, withError, loadStashes, loadChanges],
  );

  const dropStash = useCallback(
    async (index: number) => {
      await withError(async () => {
        await invoke("stash_drop", { path: repoPath, index });
        await loadStashes();
      });
    },
    [repoPath, withError, loadStashes],
  );

  // ── README ──

  const loadReadme = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<string | null>("get_readme", {
        path: repoPath,
      });
      setReadme(result);
    });
  }, [repoPath, withError]);

  // ── File history ──

  const loadFileHistory = useCallback(
    async (filePath: string) => {
      setFileHistoryPath(filePath);
      await withError(async () => {
        const result = await invoke<CommitInfo[]>("get_file_history", {
          path: repoPath,
          filePath,
        });
        setFileHistory(result);
      });
    },
    [repoPath, withError],
  );

  const closeFileHistory = useCallback(() => {
    setFileHistoryPath(null);
    setFileHistory([]);
  }, []);

  // ── Remotes ──

  const loadRemotes = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<RemoteInfo[]>("get_remotes", {
        path: repoPath,
      });
      setRemotes(result);
    });
  }, [repoPath, withError]);

  const addRemote = useCallback(
    async (name: string, url: string) => {
      await withError(async () => {
        await invoke("add_remote", { path: repoPath, name, url });
        await loadRemotes();
        showSuccess(`Remote '${name}' added`);
      });
    },
    [repoPath, withError, loadRemotes, showSuccess],
  );

  const removeRemote = useCallback(
    async (name: string) => {
      await withError(async () => {
        await invoke("remove_remote", { path: repoPath, name });
        await loadRemotes();
        showSuccess(`Remote '${name}' removed`);
      });
    },
    [repoPath, withError, loadRemotes, showSuccess],
  );

  const renameRemote = useCallback(
    async (oldName: string, newName: string) => {
      await withError(async () => {
        await invoke("rename_remote", { path: repoPath, oldName, newName });
        await loadRemotes();
        showSuccess(`Remote renamed to '${newName}'`);
      });
    },
    [repoPath, withError, loadRemotes, showSuccess],
  );

  // ── Git profile ──

  const loadProfile = useCallback(async () => {
    await withError(async () => {
      const result = await invoke<GitProfile>("get_git_profile", {
        path: repoPath,
      });
      setProfile(result);
    });
  }, [repoPath, withError]);

  const updateProfile = useCallback(
    async (name: string, email: string) => {
      await withError(async () => {
        await invoke("set_git_profile", { path: repoPath, name, email });
        setProfile({ name, email });
        showSuccess("Profile updated");
      });
    },
    [repoPath, withError, showSuccess],
  );

  // ── Squash ──

  const squashCommits = useCallback(
    async (count: number, message: string) => {
      setLoading(true);
      setLoadingAction("Squashing…");
      await withError(async () => {
        await invoke<string>("squash_commits", {
          path: repoPath,
          count,
          message,
        });
        await loadCommits();
        showSuccess(`Squashed ${count} commits`);
      });
      setLoadingAction(null);
      setLoading(false);
    },
    [repoPath, withError, loadCommits, showSuccess],
  );

  // ── PR URL ──

  const openPullRequest = useCallback(async () => {
    await withError(async () => {
      const url = await invoke<string>("get_pr_url", { path: repoPath });
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    });
  }, [repoPath, withError]);

  return {
    commits,
    changes,
    branches,
    stashes,
    diff,
    readme,
    loading,
    loadingAction,
    error,
    successMessage,
    commitFiles,
    fileHistory,
    fileHistoryPath,
    remotes,
    profile,
    setDiff,
    loadCommits,
    loadCommitDiff,
    loadCommitFiles,
    loadChanges,
    loadFileDiff,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    createCommit,
    loadBranches,
    checkoutBranch,
    createBranch,
    deleteBranch,
    mergeBranch,
    fetchRemote,
    pullRebase,
    push,
    loadStashes,
    saveStash,
    popStash,
    dropStash,
    loadReadme,
    loadFileHistory,
    closeFileHistory,
    loadRemotes,
    addRemote,
    removeRemote,
    renameRemote,
    loadProfile,
    updateProfile,
    squashCommits,
    openPullRequest,
  };
}
