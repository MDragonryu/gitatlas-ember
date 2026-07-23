import type { RepoHealth, RepoInfo } from "../types";

const HEALTH_OPTIONS: { value: RepoHealth; label: string; tone: string }[] = [
  { value: "clean", label: "Clean", tone: "tone-clean" },
  { value: "dirty", label: "Changes", tone: "tone-dirty" },
  { value: "diverged", label: "Diverged", tone: "tone-diverged" },
  { value: "error", label: "Error", tone: "tone-error" },
];

interface FilterBarProps {
  repos: RepoInfo[];
  activeFilters: Set<RepoHealth>;
  onToggleFilter: (health: RepoHealth) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export default function FilterBar({
  repos,
  activeFilters,
  onToggleFilter,
  search,
  onSearchChange,
}: FilterBarProps) {
  const counts = new Map<RepoHealth, number>();
  for (const repo of repos) {
    counts.set(repo.health, (counts.get(repo.health) ?? 0) + 1);
  }

  return (
    <div className="filter-bar">
      <div className="filter-group" aria-label="Repository health filters">
        {HEALTH_OPTIONS.map(({ value, label, tone }) => {
          const count = counts.get(value) ?? 0;
          const active = activeFilters.has(value);
          return (
            <button
              key={value}
              onClick={() => onToggleFilter(value)}
              aria-pressed={active}
              className={`filter-chip ${tone}${active ? " active" : ""}`}
            >
              <span className="filter-dot" aria-hidden="true" />
              {label}
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search repos..."
        aria-label="Search repositories"
        className="control filter-search"
      />
    </div>
  );
}
