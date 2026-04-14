const MAX_LENGTH = 4096;

/**
 * Split a message into Telegram-safe chunks (<=4096 chars each).
 * Prefers splitting at paragraph boundaries (\n\n), then newlines (\n),
 * then hard-splits. Avoids splitting inside code blocks.
 *
 * @param {string} text
 * @returns {string[]} chunks
 */
export function chunkMessage(text) {
  if (!text) return [];
  if (text.length <= MAX_LENGTH) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    const slice = remaining.slice(0, MAX_LENGTH);
    let splitIndex = -1;

    splitIndex = findSafeSplit(slice, "\n\n");

    if (splitIndex === -1) {
      splitIndex = findSafeSplit(slice, "\n");
    }

    if (splitIndex === -1) {
      splitIndex = MAX_LENGTH;
    }

    const chunk = remaining.slice(0, splitIndex).trimEnd();
    chunks.push(chunk);
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * Find the last occurrence of `delimiter` in `text` that doesn't
 * fall inside an unclosed code block.
 */
function findSafeSplit(text, delimiter) {
  let searchFrom = text.length;

  while (searchFrom > 0) {
    const idx = text.lastIndexOf(delimiter, searchFrom - 1);
    if (idx === -1) break;

    const before = text.slice(0, idx);
    const codeBlockCount = (before.match(/```/g) || []).length;

    if (codeBlockCount % 2 === 0) {
      return idx;
    }

    searchFrom = idx;
  }

  return -1;
}
