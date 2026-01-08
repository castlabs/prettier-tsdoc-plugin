/**
 * Utilities for extracting and formatting Markdown content within TSDoc comments.
 * Handles fenced code blocks and delegates to Prettier's language formatters.
 */

import type { ParserOptions } from 'prettier';
import { format, doc } from 'prettier';
import { debugLog } from './common.js';

const { builders: _builders } = doc;

// Comprehensive list of TSDoc block tags (standard + extended TypeDoc/AEDoc)
export const BLOCK_TAGS = new Set([
  // TSDoc Standard Block Tags
  '@param',
  '@typeParam',
  '@returns',
  '@throws',
  '@example',
  '@deprecated',
  '@see',
  '@since',
  '@override',
  '@sealed',
  '@virtual',
  '@readonly',
  '@eventProperty',
  '@defaultValue',
  '@remarks',
  '@alpha',
  '@beta',
  '@public',
  '@internal',
  '@packageDocumentation',
  '@privateRemarks',

  // TypeDoc Extensions
  '@category',
  '@categoryDescription',
  '@group',
  '@groupDescription',
  '@default',
  '@document',
  '@expandType',
  '@import',
  '@inlineType',
  '@license',
  '@module',
  '@preventExpand',
  '@preventInline',
  '@property',
  '@prop',
  '@return',
  '@sortStrategy',
  '@summary',
  '@template',
  '@type',

  // AEDoc Extensions
  '@abstract',
  '@event',
  '@experimental',
  '@hidden',
  '@inline',
  '@preapproved',
  '@migratedPackage',
  '@packageDocumentation',
]);

// Markdown-capable block tags that should be processed through markdown formatter
export const MARKDOWN_BLOCK_TAGS = new Set([
  '@remarks',
  '@example',
  '@privateRemarks',
  '@deprecated',
  '@see',
]);

// Inline tags that should be preserved as unbreakable tokens
export const INLINE_TAGS = new Set([
  '{@link}',
  '{@linkcode}',
  '{@linkplain}',
  '{@inheritDoc}',
  '{@label}',
  '{@include}',
  '{@includeCode}',
]);

/**
 * Check if a tag is a block tag
 */
export function isBlockTag(tagName: string): boolean {
  return BLOCK_TAGS.has(tagName);
}

/**
 * Check if a block tag should be processed through markdown formatter
 */
export function isMarkdownCapableTag(tagName: string): boolean {
  return MARKDOWN_BLOCK_TAGS.has(tagName);
}

/**
 * Extract clean text content for markdown processing by removing comment marks
 */
export function stripCommentMarks(rawText: string): string {
  if (!rawText) return '';

  return rawText
    .split('\n')
    .map((line) => {
      // Remove leading whitespace and comment asterisk ONLY when followed by whitespace or end of line.
      // Using lookahead (?=\s|$) ensures we don't strip the first * from markdown bold syntax like **text**
      return line.replace(/^\s*\*(?=\s|$)\s?/, '');
    })
    .join('\n')
    .trim();
}

/**
 * Preserve inline tags as unbreakable tokens during markdown processing
 */
export function preserveInlineTags(text: string): {
  text: string;
  tokens: Map<string, string>;
} {
  const tokens = new Map<string, string>();
  let tokenCounter = 0;

  // Replace inline tags with placeholder tokens
  let processedText = text;
  const inlineTagRegex = /\{@\w+[^}]*\}/g;

  processedText = processedText.replace(inlineTagRegex, (match) => {
    const token = `__INLINE_TAG_${tokenCounter++}__`;
    tokens.set(token, match);
    return token;
  });

  return { text: processedText, tokens };
}

/**
 * Restore inline tags from placeholder tokens
 */
export function restoreInlineTags(
  text: string,
  tokens: Map<string, string>
): string {
  let restoredText = text;

  tokens.forEach((originalTag, token) => {
    restoredText = restoredText.replace(new RegExp(token, 'g'), originalTag);
  });

  return restoredText;
}

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

  // If content contains backticks (inline code), use a more careful approach
  if (content.includes('`')) {
    // Try to format as markdown while preserving inline code spacing
    try {
      // Use synchronous formatting with a simple approach
      let formatted = content
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single spaces
        .trim();

      // Ensure proper spacing around backticks
      formatted = formatted
        .replace(/(\w)`/g, '$1 `') // Add space before backtick if missing
        .replace(/`(\w)/g, '` $1'); // Add space after backtick if missing

      formatCache.set(cacheKey, formatted);
      return formatted;
    } catch {
      // Fallback to original content if formatting fails
      formatCache.set(cacheKey, content);
      return content;
    }
  }

  // Apply basic markdown normalization for text without backticks
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

/**
 * Format a markdown block using Prettier's markdown formatter with embedded language support
 */
export async function formatMarkdownBlock(
  rawText: string,
  options: ParserOptions<any>
): Promise<string> {
  if (!rawText.trim()) {
    return '';
  }

  try {
    // 1. Preserve inline tags as unbreakable tokens
    const { text: textWithTokens, tokens } = preserveInlineTags(rawText);

    // 2. Format with Prettier markdown parser with embedded language support enabled
    const formatted = await format(textWithTokens, {
      ...options,
      parser: 'markdown',
      printWidth: options.printWidth || 80,
      tabWidth: options.tabWidth || 2,
      useTabs: options.useTabs || false,
      proseWrap: 'always', // Ensure prose wrapping
      // Enable embedded language formatting
      plugins: options.plugins || [],
    });

    // 3. Restore inline tags
    const restored = restoreInlineTags(formatted, tokens);

    // 4. Clean up extra newlines and ensure proper formatting
    return restored.trim();
  } catch (error) {
    // Log only in debug mode since this is a utility function without access to options
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'Markdown formatting failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
    return rawText; // fallback to original
  }
}

/**
 * Add comment marks back to formatted markdown content with proper alignment
 */
export function addCommentMarks(
  formattedText: string,
  baseIndentation: string = ''
): string {
  if (!formattedText.trim()) {
    return '';
  }

  return formattedText
    .split('\n')
    .map((line, _index) => {
      // Handle empty lines
      if (!line.trim()) {
        return `${baseIndentation} *`;
      }

      // Add comment mark with proper spacing
      return `${baseIndentation} * ${line}`;
    })
    .join('\n');
}

/**
 * Extract original indentation from a comment block
 */
export function extractIndentation(commentText: string): string {
  const lines = commentText.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\s*)\*/);
    if (match) {
      return match[1]; // Return the whitespace before the asterisk
    }
  }

  return ''; // Default to no indentation
}
