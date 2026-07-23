import type { MouseEvent } from "react";

interface ReadmeViewerProps {
  content: string | null;
}

export default function ReadmeViewer({ content }: ReadmeViewerProps) {
  if (content === null) {
    return (
      <div className="empty-state">
        No README file found in this repository.
      </div>
    );
  }

  return (
    <div className="readme">
      <div className="readme-content">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

/** Simple markdown-to-HTML renderer — handles common patterns without a dependency. */
function MarkdownRenderer({ content }: { content: string }) {
  const html = renderMarkdown(content);
  const handleClick = async (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const link = target.closest<HTMLAnchorElement>("a[data-external-url]");
    if (!link) return;
    event.preventDefault();
    const url = link.dataset.externalUrl;
    if (!url) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch (error) {
      console.error("Failed to open README link", error);
    }
  };

  return <div onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMarkdown(md: string): string {
  let html = escapeHtml(md);

  // Fenced code blocks (```lang ... ```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) =>
      `<pre><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>",
  );

  // Headers
  html = html.replace(
    /^######\s+(.+)$/gm,
    "<h6>$1</h6>",
  );
  html = html.replace(
    /^#####\s+(.+)$/gm,
    "<h5>$1</h5>",
  );
  html = html.replace(
    /^####\s+(.+)$/gm,
    "<h4>$1</h4>",
  );
  html = html.replace(
    /^###\s+(.+)$/gm,
    "<h3>$1</h3>",
  );
  html = html.replace(
    /^##\s+(.+)$/gm,
    "<h2>$1</h2>",
  );
  html = html.replace(
    /^#\s+(.+)$/gm,
    "<h1>$1</h1>",
  );

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Images: ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, url: string) => {
      const safeUrl = sanitizeExternalUrl(url);
      return safeUrl
        ? `<img src="${safeUrl}" alt="${alt}" />`
        : `<span>${alt}</span>`;
    },
  );

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text: string, url: string) => {
      const safeUrl = sanitizeExternalUrl(url);
      return safeUrl
        ? `<a href="#" data-external-url="${safeUrl}">${text}</a>`
        : `<span>${text}</span>`;
    },
  );

  // Horizontal rule
  html = html.replace(
    /^---+$/gm,
    "<hr />",
  );

  // Unordered lists (- or *)
  html = html.replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>");

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Blockquotes
  html = html.replace(
    /^&gt;\s+(.+)$/gm,
    "<blockquote>$1</blockquote>",
  );

  // Paragraphs: blank lines → <br/><br/>
  html = html.replace(/\n\n/g, "<br/><br/>");
  // Single newlines within text (but not after block elements)
  html = html.replace(/(?<!>)\n(?!<)/g, "<br/>");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url.replace(/&amp;/g, "&"));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return escapeHtml(parsed.toString());
  } catch {
    return null;
  }
}
