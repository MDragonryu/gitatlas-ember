import { useState } from "react";
import type { StashEntry } from "../../types";

interface StashPanelProps {
  stashes: StashEntry[];
  onSave: (message: string) => Promise<void>;
  onPop: (index: number) => Promise<void>;
  onDrop: (index: number) => Promise<void>;
}

export default function StashPanel({ stashes, onSave, onPop, onDrop }: StashPanelProps) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(message.trim());
      setMessage("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="inline-form">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Stash message (optional)"
          aria-label="Stash message"
          className="control compact"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="button compact"
        >
          {saving ? "..." : "Stash"}
        </button>
      </div>

      <div className="scroll-region">
        {stashes.length === 0 ? (
          <p className="empty-row">No stashes</p>
        ) : (
          stashes.map((stash) => (
            <div
              key={stash.index}
              className="data-row"
            >
              <span className="row-meta mono">#{stash.index}</span>
              <span className="data-row-main">{stash.message}</span>
              <div className="row-actions">
                <button
                  onClick={() => onPop(stash.index)}
                  className="row-action"
                >
                  pop
                </button>
                <button
                  onClick={() => onDrop(stash.index)}
                  className="row-action danger"
                >
                  drop
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
