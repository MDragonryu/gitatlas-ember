export type RepoHealth = "clean" | "dirty" | "diverged" | "error";

export interface RepoInfo {
  id: number | null;
  path: string;
  name: string;
  branch: string;
  ahead: number;
  behind: number;
  dirty_files: number;
  stash_count: number;
  health: RepoHealth;
  last_checked: string;
  remote_url: string | null;
}

export interface BulkOperationResult {
  repos: RepoInfo[];
  errors: string[];
}
