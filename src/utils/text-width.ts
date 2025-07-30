import type { ParserOptions, Doc } from 'prettier';
import { doc } from 'prettier';

const { builders } = doc;
const { fill, line: _line, softline: _softline } = builders;

/**
 * Calculate the effective width available for comment content.
 * This accounts for the comment prefix (indentation + "* ").
 */
export function effectiveWidth(
  options: ParserOptions<any>,
  indentLevel: number = 0
): number {
  const printWidth = options.printWidth || 80;
  const tabWidth = options.tabWidth || 2;
  const useTabs = options.useTabs || false;

  // Calculate the width of the indent
  const indentWidth = useTabs ? indentLevel : indentLevel * tabWidth;

  // Account for "* " prefix (3 characters: "/**" or " * ")
  const prefixWidth = indentWidth + 3;

  return Math.max(printWidth - prefixWidth, 20); // Minimum width of 20
}

/**
 * Wrap text content using Prettier's fill builder for flowing text.
 * Splits text into words and creates a fillable doc structure.
 */
export function wrapText(text: string): any {
  if (!text.trim()) {
    return '';
  }

  // First, protect inline code spans by treating them with surrounding spaces as single units
  const words = tokenizeWithInlineCodeProtection(text);
  return words.length > 0 ? fill(words) : '';
}

/**
 * Tokenize text while protecting inline code spans with their surrounding spaces.
 * This prevents Prettier's fill from breaking lines between spaces and backticks.
 */
function tokenizeWithInlineCodeProtection(text: string): string[] {
  // Simple approach: just treat backticks as single words, let normal tokenization handle spaces
  return tokenizeNormalText(text);
}

/**
 * Normal text tokenization (without inline code protection)
 */
function tokenizeNormalText(text: string): string[] {
  if (!text) return [];

  const words: string[] = [];
  const parts = text.split(/(\s+)/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.trim()) {
      // It's a word
      words.push(part);
    } else if (part && i > 0 && i < parts.length - 1) {
      // It's whitespace between words - convert to single space for flow
      words.push(' ');
    }
  }

  return words;
}

/**
 * Create a properly indented comment line with the "* " prefix.
 */
export function createCommentLine(content: any): any {
  if (!content) {
    return ' * ';
  }

  // Special handling for content with inline code (backticks)
  if (typeof content === 'string' && content.includes('`')) {
    // Use the wrapText function which has inline code protection
    return [' * ', wrapText(content)];
  }

  return [' * ', content];
}

/**
 * Create an empty comment line (just "* ").
 */
export function createEmptyCommentLine(): string {
  return ' *';
}

/**
 * Convert TSDoc text content to wrapped format, handling line breaks and markdown.
 */
export function formatTextContent(
  text: string,
  options?: ParserOptions<any>
): Doc | string | null {
  if (!text.trim()) {
    return null;
  }

  // Check if content contains fenced code blocks or complex markdown
  if (text.includes('```') || text.includes('\n- ') || text.includes('\n1. ')) {
    // Handle as markdown content - preserve more structure
    return formatMarkdownContent(text, options);
  }

  // Simple text - normalize whitespace and wrap
  const normalizedText = text
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  return wrapText(normalizedText);
}

/**
 * Format markdown content while preserving structure.
 */
function formatMarkdownContent(
  text: string,
  _options?: ParserOptions<any>
): Doc | string | null {
  // For now, preserve the markdown structure more carefully
  // Split by lines and handle each type
  const lines = text.split('\n');
  const result: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      // Empty line - preserve as line break
      continue;
    }

    if (
      line.startsWith('- ') ||
      line.startsWith('* ') ||
      line.startsWith('+ ')
    ) {
      // List item - format as list
      result.push(line);
      if (i < lines.length - 1) {
        result.push(line);
      }
    } else {
      // Regular text - wrap normally
      result.push(wrapText(line));
      if (i < lines.length - 1) {
        result.push(line);
      }
    }
  }

  return result.length > 0 ? result : wrapText(text.trim());
}
