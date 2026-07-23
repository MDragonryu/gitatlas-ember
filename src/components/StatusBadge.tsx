import type { RepoHealth } from "../types";

const healthConfig: Record<RepoHealth, { tone: string; label: string }> = {
  clean: { tone: "tone-clean", label: "Clean" },
  dirty: { tone: "tone-dirty", label: "Changes" },
  diverged: { tone: "tone-diverged", label: "Diverged" },
  error: { tone: "tone-error", label: "Error" },
};

interface StatusBadgeProps {
  health: RepoHealth;
}

export default function StatusBadge({ health }: StatusBadgeProps) {
  const config = healthConfig[health];
  return (
    <span className={`status-badge ${config.tone}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
