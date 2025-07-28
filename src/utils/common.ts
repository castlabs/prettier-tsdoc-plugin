/**
 * Common utility functions to reduce code duplication
 */

import type { PrettierOptionsWithTSDoc, CommentNode } from '../types.js';
import { FORMATTING } from '../constants.js';

/**
 * Wraps content with block comment delimiters if needed
 */
export function wrapBlockComment(
  content: string,
  isBlockComment: boolean
): string {
  if (!isBlockComment) {
    return content;
  }

  // Ensure content doesn't already have the delimiters
  const trimmed = content.trim();
  if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
    return content;
  }

  return `/*${content}*/`;
}

/**
 * Extracts the inner content from a block comment, removing delimiters
 */
export function unwrapBlockComment(content: string): string {
  const trimmed = content.trim();

  // Remove /** and */ delimiters
  if (trimmed.startsWith('/**') && trimmed.endsWith('*/')) {
    return trimmed.slice(3, -2);
  }

  // Remove /* and */ delimiters
  if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
    return trimmed.slice(2, -2);
  }

  return content;
}

/**
 * Merges user options with defaults, handling both top-level and nested tsdoc options
 */
export function mergeOptions<T extends Record<string, any>>(
  defaults: T,
  userOptions: PrettierOptionsWithTSDoc,
  topLevelKeys: (keyof T)[] = []
): T {
  // Start with defaults
  const merged = { ...defaults };

  // Merge tsdoc-namespaced options
  const tsdocOptions = userOptions.tsdoc || {};
  Object.assign(merged, tsdocOptions);

  // Override with top-level options (for backward compatibility)
  for (const key of topLevelKeys) {
    if (userOptions[key as string] !== undefined) {
      (merged as any)[key] = userOptions[key as string];
    }
  }

  return merged;
}

/**
 * Normalizes whitespace in text content
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(FORMATTING.PATTERNS.MULTIPLE_SPACES, ' ')
    .replace(FORMATTING.PATTERNS.TRAILING_WHITESPACE, '')
    .replace(FORMATTING.PATTERNS.BLANK_LINES, '\n\n')
    .trim();
}

/**
 * Removes comment prefixes (* ) from lines
 */
export function removeCommentPrefixes(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(FORMATTING.PATTERNS.LEADING_ASTERISK, ''))
    .join('\n');
}

/**
 * Adds comment prefixes (* ) to lines
 */
export function addCommentPrefixes(
  text: string,
  indentLevel: number = 0
): string {
  const baseIndent = ' '.repeat(indentLevel);

  return text
    .split('\n')
    .map((line, index) => {
      if (index === 0) {
        // First line gets the opening delimiter
        return `${baseIndent}/**`;
      }

      if (line.trim() === '') {
        // Empty lines get just the asterisk
        return `${baseIndent}${FORMATTING.COMMENT_PREFIX.EMPTY_LINE}`;
      }

      // Regular lines get the asterisk and space prefix
      return `${baseIndent}${FORMATTING.COMMENT_PREFIX.LINE_PREFIX}${line}`;
    })
    .concat(`${baseIndent}${FORMATTING.COMMENT_PREFIX.BLOCK_END}`)
    .join('\n');
}

/**
 * Checks if a comment node is a block comment
 */
export function isBlockComment(comment: CommentNode): boolean {
  return comment.type === 'Block' || comment.type === 'CommentBlock';
}

/**
 * Checks if debugging is enabled
 */
export function isDebugEnabled(): boolean {
  return process.env.PRETTIER_TSDOC_DEBUG === '1';
}

/**
 * Safe debug logging that only logs when debug is enabled
 */
export function debugLog(message: string, ...args: any[]): void {
  if (isDebugEnabled()) {
    console.debug(`[TSDoc Plugin] ${message}`, ...args);
  }
}

/**
 * Safe warning logging through the provided logger
 */
export function logWarning(
  logger: PrettierOptionsWithTSDoc['logger'],
  message: string,
  ...args: any[]
): void {
  if (logger?.warn) {
    logger.warn(`[TSDoc Plugin] ${message}`, ...args);
  } else if (isDebugEnabled()) {
    console.warn(`[TSDoc Plugin] ${message}`, ...args);
  }
}

/**
 * Safe error logging through the provided logger
 */
export function logError(
  logger: PrettierOptionsWithTSDoc['logger'],
  message: string,
  error?: Error
): void {
  const fullMessage = error ? `${message}: ${error.message}` : message;

  if (logger?.error) {
    logger.error(`[TSDoc Plugin] ${fullMessage}`);
  } else if (logger?.warn) {
    logger.warn(`[TSDoc Plugin] ${fullMessage}`);
  } else if (isDebugEnabled()) {
    console.error(`[TSDoc Plugin] ${fullMessage}`);
  }
}

/**
 * Creates a cache key from an array of strings
 */
export function createCacheKey(parts: string[]): string {
  return parts.length > 0 ? parts.sort().join(',') : 'default';
}

/**
 * Validates that a string is a valid tag name
 */
export function isValidTagName(tagName: string): boolean {
  return /^@[a-zA-Z][a-zA-Z0-9]*$/.test(tagName);
}

/**
 * Cleans up tag names by ensuring they start with \@
 */
export function normalizeTagName(tagName: string): string {
  const cleaned = tagName.trim();
  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

/**
 * Safely gets a nested property from an object
 */
export function safeGet<T>(obj: any, path: string[], defaultValue: T): T {
  let current = obj;

  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }

  return current != null ? current : defaultValue;
}

/**
 * Deep clones an object (simple implementation for config objects)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Measures the visual width of text considering tabs
 */
export function measureTextWidth(
  text: string,
  tabWidth: number = 2,
  useTabs: boolean = false
): number {
  let width = 0;

  for (const char of text) {
    if (char === '\t') {
      if (useTabs) {
        width += tabWidth - (width % tabWidth);
      } else {
        width += tabWidth;
      }
    } else {
      width += 1;
    }
  }

  return width;
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}
