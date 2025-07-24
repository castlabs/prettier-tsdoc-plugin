/**
 * Utilities for extracting and formatting Markdown content within TSDoc comments.
 * Handles fenced code blocks and delegates to Prettier's language formatters.
 */

import type { ParserOptions } from 'prettier';
import { format } from 'prettier';

export interface MarkdownSection {
  type: 'markdown' | 'fenced-code';
  content: string;
  language?: string;
  start: number;
  end: number;
}

// Language mapping table for fenced code blocks
const LANGUAGE_MAP: Record<string, string> = {
  // TypeScript
  ts: 'typescript',
  typescript: 'typescript',

  // JavaScript
  js: 'babel',
  javascript: 'babel',
  jsx: 'babel',

  // JSON
  json: 'json',
  json5: 'json5',

  // Web
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',

  // Markdown
  md: 'markdown',
  markdown: 'markdown',

  // Shell/Bash (no formatter, treat as text)
  sh: 'text',
  shell: 'text',
  bash: 'text',
  zsh: 'text',

  // YAML
  yaml: 'yaml',
  yml: 'yaml',

  // Other
  xml: 'html', // HTML parser can handle XML
  graphql: 'graphql',
};

// Cache for formatted code snippets with hash-based keys for better performance
const formatCache = new Map<string, string>();

/**
 * Create a simple hash of input string for cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Extract markdown sections and fenced code blocks from text content.
 */
export function extractMarkdownSections(text: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const fencedCodeRegex = /```(\w+)?\s*\n([\s\S]*?)\n```/g;

  let lastIndex = 0;
  let match;

  while ((match = fencedCodeRegex.exec(text)) !== null) {
    const [fullMatch, language, code] = match;
    const start = match.index;
    const end = match.index + fullMatch.length;

    // Add markdown section before this code block (if any)
    if (start > lastIndex) {
      const markdownContent = text.slice(lastIndex, start).trim();
      if (markdownContent) {
        sections.push({
          type: 'markdown',
          content: markdownContent,
          start: lastIndex,
          end: start,
        });
      }
    }

    // Add the fenced code block
    sections.push({
      type: 'fenced-code',
      content: code.trim(),
      language: language || '',
      start,
      end,
    });

    lastIndex = end;
  }

  // Add remaining markdown content (if any)
  if (lastIndex < text.length) {
    const markdownContent = text.slice(lastIndex).trim();
    if (markdownContent) {
      sections.push({
        type: 'markdown',
        content: markdownContent,
        start: lastIndex,
        end: text.length,
      });
    }
  }

  // If no fenced code blocks were found, treat entire text as markdown
  if (sections.length === 0 && text.trim()) {
    sections.push({
      type: 'markdown',
      content: text.trim(),
      start: 0,
      end: text.length,
    });
  }

  return sections;
}

/**
 * Format a fenced code block using basic formatting rules.
 * Note: Full Prettier integration would require async, which is complex for plugins.
 * For now, we apply basic formatting rules.
 */
export function formatFencedCode(
  code: string,
  language: string,
  options: ParserOptions<any>
): string {
  // Create efficient cache key using hash
  const contentHash = simpleHash(code);
  const optionsHash = simpleHash(
    JSON.stringify({
      printWidth: options.printWidth,
      tabWidth: options.tabWidth,
      useTabs: options.useTabs,
    })
  );
  const cacheKey = `${language}:${optionsHash}:${contentHash}`;

  // Check cache first
  if (formatCache.has(cacheKey)) {
    return formatCache.get(cacheKey)!;
  }

  // Map language to see if we recognize it
  const parser = LANGUAGE_MAP[language.toLowerCase()] || 'text';

  // For now, apply basic normalization
  let formatted = code;

  // Basic whitespace normalization
  formatted = formatted.trim();

  // For JavaScript/TypeScript, apply basic formatting
  if (parser === 'typescript' || parser === 'babel') {
    // Basic semicolon normalization and spacing (very simple)
    formatted = formatted
      .replace(/;\s*\n/g, ';\n') // Normalize semicolon spacing
      .replace(/,\s*\n/g, ',\n') // Normalize comma spacing
      .replace(/\{\s*\n/g, '{\n') // Normalize brace spacing
      .replace(/\n\s*\}/g, '\n}'); // Normalize closing brace
  }

  formatCache.set(cacheKey, formatted);
  return formatted;
}

/**
 * Format markdown content using basic markdown formatting rules.
 * Note: Full Prettier integration would require async support.
 */
export function formatMarkdown(
  content: string,
  options: ParserOptions<any>
): string {
  // Create efficient cache key using hash
  const contentHash = simpleHash(content);
  const optionsHash = simpleHash(
    JSON.stringify({
      printWidth: options.printWidth,
      tabWidth: options.tabWidth,
      useTabs: options.useTabs,
    })
  );
  const cacheKey = `markdown:${optionsHash}:${contentHash}`;

  // Check cache first
  if (formatCache.has(cacheKey)) {
    return formatCache.get(cacheKey)!;
  }

  // Apply basic markdown normalization
  let formatted = content.trim();

  // Normalize list formatting
  formatted = formatted
    .replace(/^\s*[-*+]\s+/gm, '- ') // Normalize bullet points
    .replace(/^\s*(\d+)\.\s+/gm, '$1. '); // Normalize numbered lists

  formatCache.set(cacheKey, formatted);
  return formatted;
}

/**
 * Apply fenced code indentation based on configuration.
 */
export function applyFencedIndent(
  code: string,
  fencedIndent: 'space' | 'none' = 'space'
): string {
  if (fencedIndent === 'none') {
    return code;
  }

  // Add one space of indentation to each line
  return code
    .split('\n')
    .map((line) => (line ? ` ${line}` : line))
    .join('\n');
}

/**
 * Clear the format cache (useful for testing).
 */
export function clearFormatCache(): void {
  formatCache.clear();
}
