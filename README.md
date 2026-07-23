# GitAtlas

A desktop app for developers who work across many Git repositories. GitAtlas scans your filesystem, discovers every
repo, and shows their status on a single dashboard — branch names, ahead/behind counts, uncommitted changes, and health
at a glance. Drill into any repo for a full-featured Git UI with commit history, staging, branching, stashing, and more.

This repository is a fork of the original [GitAtlas](https://github.com/grahambrooks/gitatlas), customized into my
personal **Ember** version with adjustments that I consider improvements or that better fit my workflow and style.

Built with Tauri v2 (Rust) and React.

## Features

- **Repo Discovery** — Automatically finds Git repositories under configurable root directories
- **Status Dashboard** — See branch, ahead/behind, dirty files, and stash count for every repo in one view
- **Health Indicators** — Color-coded badges: clean, local changes, diverged, or error
- **Filter & Search** — Filter by health status, search by name/branch/path
- **Bulk Operations** — Fetch or pull all repositories with one click
- **Repo Detail View** — Full-screen view with tabbed interface:
  - **Changes** — Stage/unstage files, view diffs, create commits
  - **History** — Visual commit graph with branch topology, commit details and file diffs
  - **Branches** — Create, checkout, delete, and merge branches (with drag-and-drop merge)
  - **Stashes** — Save, pop, and drop stashes
  - **Readme** — View repository README
- **Remote Operations** — Fetch, pull (rebase), and push per-repo with remote management
- **Git Profile** — View and edit per-repo git user.name/email
- **GitHub Integration** — Direct links to GitHub repos from dashboard cards, open PR creation
- **Fast Startup** — Repo list cached to disk for instant display on launch
- **Configurable Scan Root** — Click to edit the scan directory, persisted across sessions

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable)
- Tauri v2 system dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Install & Run

```sh
npm install
npm run tauri dev
```

This starts the Vite dev server and compiles the Rust backend, then opens a native desktop window. The scan root
defaults to `~/dev` — click the path below the header to change it. Click **"Scan for Repos"** to discover Git
repositories.

### Build for Production

```sh
npm run tauri build
```

Produces a native app bundle in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer             | Technology                            |
|-------------------|---------------------------------------|
| Desktop framework | Tauri v2                              |
| Frontend          | React 19, TypeScript 5, Tailwind CSS v4 |
| Build tool        | Vite 6                                |
| Git engine        | git2 (libgit2)                        |
| Filesystem scan   | ignore + walkdir                      |
| Database          | SQLite (rusqlite, in-memory)          |
| Config/cache      | JSON files in `~/.gitatlas/`          |

## Project Structure

```
gitatlas/
├── src/                        # React frontend
│   ├── components/
│   │   ├── Dashboard.tsx       # Main layout, scan root, scan trigger
│   │   ├── RepoList.tsx        # Repo card grid
│   │   ├── RepoCard.tsx        # Single repo card with status + actions
│   │   ├── FilterBar.tsx       # Health filter + search
│   │   ├── BulkActions.tsx     # Fetch All / Pull All buttons
│   │   ├── StatusBadge.tsx     # Health indicator dot
│   │   ├── GitHubLink.tsx      # Shared GitHub icon button (shell.open)
│   │   └── detail/
│   │       ├── RepoDetail.tsx  # Full-screen repo view with tabs
│   │       ├── FileChanges.tsx # Staging, unstaging, diffs
│   │       ├── CommitGraph.tsx # Commit history with visual graph
│   │       ├── CommitLog.tsx   # Commit list
│   │       ├── CommitForm.tsx  # Commit message input
│   │       ├── DiffViewer.tsx  # Unified diff display
│   │       ├── BranchPanel.tsx # Branch management
│   │       ├── StashPanel.tsx  # Stash management
│   │       ├── ReadmeViewer.tsx# README rendering
│   │       └── graph/
│   │           ├── computeGraph.ts  # Lane assignment algorithm
│   │           └── GraphSvg.tsx     # SVG rendering of commit graph
│   ├── hooks/
│   │   ├── useRepos.ts         # Scan, refresh, bulk ops, cache loading
│   │   ├── useRepoDetail.ts    # All detail operations (commits, staging, branches, etc.)
│   │   └── useRepoStatus.ts    # Single repo status polling
│   └── types/
│       ├── repo.ts             # RepoInfo, RepoHealth
│       ├── detail.ts           # CommitInfo, FileChange, BranchInfo, StashEntry, etc.
│       └── index.ts            # Re-exports
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── lib.rs              # AppState, Builder, command registration
│       ├── main.rs             # Entry point
│       ├── error.rs            # AppError enum with Serialize for IPC
│       ├── cache.rs            # Disk cache + config (~/.gitatlas/)
│       ├── commands/
│       │   ├── scan.rs         # scan_directories, get/set_scan_roots, load_cached_repos
│       │   ├── status.rs       # get_all_repos, get_repo_status
│       │   ├── operations.rs   # fetch_all, pull_all, fetch/pull/push per-repo
│       │   └── detail.rs       # 29 commands: commits, staging, branches, stashes, remotes, etc.
│       ├── git/
│       │   ├── discovery.rs    # Find .git dirs using ignore crate
│       │   ├── status.rs       # Branch, ahead/behind, dirty, stash, remote URL
│       │   ├── operations.rs   # Fetch, pull, push via git2
│       │   └── detail.rs       # Commit log, diffs, staging, branches, stashes, remotes, profiles
│       ├── db/
│       │   ├── mod.rs          # Database struct, schema init
│       │   ├── models.rs       # RepoInfo, CommitInfo, FileChange, BranchInfo, etc.
│       │   └── queries.rs      # Upsert, get_all, clear
│       └── scanner/
│           └── mod.rs          # Multi-root scan orchestration
├── package.json
└── vite.config.ts
```

## Data Storage

GitAtlas stores configuration and cache files in `~/.gitatlas/`:

- `config.json` — User settings (scan root directories)
- `cache.json` — Last-known repo list for fast startup

The in-memory SQLite database holds repo data during the app session. It is populated from the cache on startup and
refreshed on scan.

## License

MIT
