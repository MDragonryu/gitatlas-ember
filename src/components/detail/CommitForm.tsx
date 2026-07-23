import { useState } from "react";

interface CommitFormProps {
  stagedCount: number;
  onCommit: (message: string) => Promise<void>;
}

export default function CommitForm({ stagedCount, onCommit }: CommitFormProps) {
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || stagedCount === 0) return;
    setCommitting(true);
    try {
      await onCommit(message.trim());
      setMessage("");
    } finally {
      setCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="commit-form">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        aria-label="Commit message"
        rows={3}
        className="control"
      />
      <div className="form-footer">
        <span>
          {stagedCount} file{stagedCount !== 1 ? "s" : ""} staged
        </span>
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || stagedCount === 0 || committing}
          className="button compact success"
        >
          {committing ? "Committing..." : "Commit"}
        </button>
      </div>
    </div>
  );
}
