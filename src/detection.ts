/**
 * Comment detection logic for TSDoc candidates.
 * Based on specification §3.
 */

interface CommentNode {
  type: string;
  value: string;
}

/**
 * Determines if a comment is a candidate for TSDoc formatting.
 */
export function isTSDocCandidate(
  comment: CommentNode,
  force: boolean = false
): boolean {
  // Must be a block comment
  if (comment.type !== 'CommentBlock') {
    return false;
  }

  // Must start with /** (not /*!)
  if (!comment.value.startsWith('*')) {
    return false;
  }

  // Must be multi-line (contains newline before closing */)
  if (!comment.value.includes('\n')) {
    return false;
  }

  // If force is enabled, skip heuristics
  if (force) {
    return true;
  }

  // Heuristics: look for TSDoc indicators
  const content = comment.value;

  // Check for @ followed by identifier (block tags)
  const hasBlockTag = /@[a-zA-Z][a-zA-Z0-9]*(\s|$)/.test(content);

  // Check for inline tags
  const hasInlineTag = content.includes('{@');

  // Check for any content that looks like summary text
  const lines = content.split('\n');
  const hasContent = lines.some((line) => {
    const trimmed = line.replace(/^\s*\*?\s*/, '').trim();
    return trimmed.length > 0;
  });

  return hasBlockTag || hasInlineTag || hasContent;
}
