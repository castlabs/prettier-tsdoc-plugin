/**
 * Comment detection logic for TSDoc candidates.
 * Based on specification §3.
 */

import { debugLog } from './utils/common.js';

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
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('[TSDoc Candidate-Check] Not a comment block');
    }
    return false;
  }

  // Must start with /** (not /*!)
  if (!comment.value.trim().startsWith('*')) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('[TSDoc Candidate-Check] Does not start with *', comment.value);
    }
    return false;
  }

  // Must be multi-line (contains newline before closing */)
  if (!comment.value.includes('\n')) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('[TSDoc Candidate-Check] No a multiline block');
    }
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
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog(
      `[TSDoc Candidate-Check] Block: ${hasBlockTag}, Inline: ${hasInlineTag}, Content: ${hasContent}`
    );
  }

  return hasBlockTag || hasInlineTag || hasContent;
}
