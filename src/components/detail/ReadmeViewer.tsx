import type { MouseEvent } from "react";

interface ReadmeViewerProps {
  content: string | null;
}

export default function ReadmeViewer({ content }: ReadmeViewerProps) {
  if (content === null) {
    return (
      <div className="p-6 text-sm text-slate-500">
        No README file found in this repository.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="prose prose-invert prose-sm max-w-none">
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
      `<pre class="bg-slate-800 rounded-lg p-4 overflow-x-auto text-sm"><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-slate-800 rounded px-1.5 py-0.5 text-sm text-blue-300">$1</code>',
  );

  // Headers
  html = html.replace(
    /^######\s+(.+)$/gm,
    '<h6 class="text-sm font-semibold text-slate-300 mt-4 mb-1">$1</h6>',
  );
  html = html.replace(
    /^#####\s+(.+)$/gm,
    '<h5 class="text-sm font-semibold text-slate-200 mt-4 mb-1">$1</h5>',
  );
  html = html.replace(
    /^####\s+(.+)$/gm,
    '<h4 class="text-base font-semibold text-slate-200 mt-5 mb-1">$1</h4>',
  );
  html = html.replace(
    /^###\s+(.+)$/gm,
    '<h3 class="text-lg font-semibold text-slate-100 mt-6 mb-2">$1</h3>',
  );
  html = html.replace(
    /^##\s+(.+)$/gm,
    '<h2 class="text-xl font-bold text-white mt-8 mb-2 pb-1 border-b border-slate-700">$1</h2>',
  );
  html = html.replace(
    /^#\s+(.+)$/gm,
    '<h1 class="text-2xl font-bold text-white mt-8 mb-3 pb-2 border-b border-slate-700">$1</h1>',
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
        ? `<img src="${safeUrl}" alt="${alt}" class="rounded max-w-full" />`
        : `<span>${alt}</span>`;
    },
  );

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text: string, url: string) => {
      const safeUrl = sanitizeExternalUrl(url);
      return safeUrl
        ? `<a href="#" data-external-url="${safeUrl}" class="text-blue-400 hover:text-blue-300 underline">${text}</a>`
        : `<span>${text}</span>`;
    },
  );

  // Horizontal rule
  html = html.replace(
    /^---+$/gm,
    '<hr class="border-slate-700 my-6" />',
  );

  // Unordered lists (- or *)
  html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-slate-300">$1</li>');

  // Blockquotes
  html = html.replace(
    /^&gt;\s+(.+)$/gm,
    '<blockquote class="border-l-4 border-slate-600 pl-4 text-slate-400 italic my-2">$1</blockquote>',
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
