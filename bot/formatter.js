/**
 * Convert standard Markdown to Telegram HTML.
 * Telegram HTML supports: <b>, <i>, <u>, <s>, <code>, <pre>, <a>, <blockquote>
 * But NOT tables, headers, etc. — we convert those to visual equivalents.
 *
 * @param {string} md - Standard markdown text
 * @returns {string} Telegram-compatible HTML
 */
export function mdToTelegramHtml(md) {
  if (!md) return "";

  let html = md;

  // Escape HTML entities first (but preserve our conversions)
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code blocks (``` ... ```) — must be done before inline code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    // Unescape inside code blocks
    const clean = code.trimEnd();
    if (lang) {
      return `<pre><code class="language-${lang}">${clean}</code></pre>`;
    }
    return `<pre>${clean}</pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Headers: # → bold, ## → bold, ### → bold italic
  html = html.replace(/^### (.+)$/gm, "<b><i>$1</i></b>");
  html = html.replace(/^## (.+)$/gm, "<b>$1</b>");
  html = html.replace(/^# (.+)$/gm, "<b>$1</b>");

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ (but not inside words with underscores)
  html = html.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "<i>$1</i>");
  html = html.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "<i>$1</i>");

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Blockquotes: > text
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules: --- or ***
  html = html.replace(/^(-{3,}|\*{3,})$/gm, "────────────────");

  // Tables: convert to monospace alignment
  html = convertTable(html);

  // Bullet lists: - item or * item → • item
  html = html.replace(/^[\-\*] (.+)$/gm, "• $1");

  // Numbered lists: keep as-is (1. item already looks fine)

  // Clean up excessive newlines
  html = html.replace(/\n{3,}/g, "\n\n");

  return html.trim();
}

/**
 * Convert Markdown tables to monospace pre-formatted blocks.
 * Detects | col | col | patterns and formats them.
 */
function convertTable(text) {
  const lines = text.split("\n");
  const result = [];
  let tableLines = [];
  let inTable = false;

  for (const line of lines) {
    const isTableRow = /^\|(.+)\|$/.test(line.trim());
    const isSeparator = /^\|[\s\-:]+\|$/.test(line.trim());

    if (isTableRow || isSeparator) {
      if (isSeparator) continue; // skip --- separator rows
      inTable = true;
      tableLines.push(line.trim());
    } else {
      if (inTable) {
        result.push(formatTable(tableLines));
        tableLines = [];
        inTable = false;
      }
      result.push(line);
    }
  }

  if (inTable) {
    result.push(formatTable(tableLines));
  }

  return result.join("\n");
}

/**
 * Format table rows into aligned monospace block.
 */
function formatTable(rows) {
  const parsed = rows.map((row) =>
    row
      .split("|")
      .filter((c) => c !== "")
      .map((c) => c.trim())
  );

  // Calculate column widths
  const colWidths = [];
  for (const row of parsed) {
    row.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
    });
  }

  // Format rows with padding
  const formatted = parsed.map((row) =>
    row.map((cell, i) => cell.padEnd(colWidths[i])).join("  ")
  );

  // First row is header — make bold
  const header = formatted[0];
  const divider = colWidths.map((w) => "─".repeat(w)).join("──");
  const body = formatted.slice(1);

  return `<pre>${header}\n${divider}\n${body.join("\n")}</pre>`;
}
