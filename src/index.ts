import type { Plugin, AstPath, ParserOptions, Doc } from 'prettier';
import { TSDocParser } from '@microsoft/tsdoc';
import { createTSDocConfiguration } from './parser-config.js';
import { isTSDocCandidate } from './detection.js';
import { formatTSDocComment } from './format.js';
import parserTypescript from 'prettier/parser-typescript';
import parserBabel from 'prettier/parser-babel';

// Cached parser instances with memoized configurations for performance
const parserCache = new Map<string, TSDocParser>();

function getTSDocParser(extraTags: string[] = []): TSDocParser {
  // Create cache key based on configuration
  const cacheKey =
    extraTags.length > 0 ? extraTags.sort().join(',') : 'default';

  if (parserCache.has(cacheKey)) {
    return parserCache.get(cacheKey)!;
  }

  // Create new parser with configuration
  const configuration = createTSDocConfiguration(extraTags);
  const parser = new TSDocParser(configuration);

  // Cache the parser
  parserCache.set(cacheKey, parser);

  // Limit cache size to prevent memory leaks
  if (parserCache.size > 10) {
    const firstKey = parserCache.keys().next().value;
    if (firstKey) {
      parserCache.delete(firstKey);
    }
  }

  return parser;
}

/**
 * Handle comment printing for TSDoc comments.
 */
function printComment(
  commentPath: AstPath<any>,
  options: ParserOptions<any>
): string {
  const comment = commentPath.getValue();

  // Debug logging
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    const logger = (options as any).logger;
    if (logger?.warn) {
      logger.warn('TSDoc comment received:', JSON.stringify(comment, null, 2));
    }
  }

  // For block comments, we need to wrap with /** and */
  const isBlockComment = comment.type === 'Block';
  
  // Check if this is a TSDoc candidate
  if (!isTSDocCandidate(comment, (options as any).forceFormatTSDoc || false)) {
    // Return the original comment with proper wrapping
    if (isBlockComment) {
      return `/*${comment.value}*/`;
    }
    return comment.value;
  }

  try {
    // Get cached parser (with potential extraTags from options)
    const extraTags = (options as any).tsdoc?.extraTags || [];
    const parser = getTSDocParser(extraTags);

    // Format the comment and convert to string
    const formattedDoc = formatTSDocComment(comment.value, options, parser, commentPath);
    const formattedContent = docToString(formattedDoc);
    
    // For block comments, wrap with /** and */
    if (isBlockComment) {
      return `/*${formattedContent}*/`;
    }
    
    return formattedContent;
  } catch (error) {
    // Gracefully handle formatting errors
    if ((options as any).logger?.debug) {
      (options as any).logger.debug(
        `TSDoc formatting failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    // Return the original comment as fallback with proper wrapping
    if (isBlockComment) {
      return `/*${comment.value}*/`;
    }
    return comment.value;
  }
}

/**
 * Convert Prettier Doc to string for comment printing
 */
function docToString(doc: any): string {
  if (typeof doc === 'string') {
    return doc;
  }
  
  if (typeof doc === 'number') {
    return String(doc);
  }
  
  if (doc === null || doc === undefined) {
    return '';
  }
  
  if (Array.isArray(doc)) {
    return doc.map(docToString).join('');
  }
  
  if (doc && typeof doc === 'object') {
    // Handle Prettier Doc builders
    if (doc.type === 'concat' || (doc.parts && Array.isArray(doc.parts))) {
      return doc.parts.map(docToString).join('');
    }
    if (doc.type === 'group' && doc.contents) {
      return docToString(doc.contents);
    }
    if (doc.type === 'line' || doc.type === 'hardline') {
      return '\n';
    }
    if (doc.type === 'softline') {
      return ' ';
    }
    if (doc.type === 'fill' && doc.parts) {
      return doc.parts.map(docToString).join(' ');
    }
    if (doc.type === 'break-parent' || doc.type === 'indent' || doc.type === 'dedent') {
      return ''; // These are formatting control tokens, not content
    }
    if (doc.contents !== undefined) {
      return docToString(doc.contents);
    }
    if (doc.parts !== undefined) {
      return doc.parts.map(docToString).join('');
    }
    
    // Last resort: check for common properties
    if (doc.value !== undefined) {
      return docToString(doc.value);
    }
    if (doc.text !== undefined) {
      return docToString(doc.text);
    }
  }
  
  // Only return [object Object] if we truly can't extract anything
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    console.warn('Unable to convert doc to string:', doc);
  }
  return String(doc);
}

// Import estree plugin to extend its printer

/**
 * Prettier plugin for TSDoc comment formatting.
 *
 * This implementation detects TSDoc candidates, parses them, and formats
 * the summary and @remarks sections according to the specification.
 */
/**
 * Transform TSDoc comments in the source text before parsing
 */
function preprocessSource(text: string, options: ParserOptions<any>): string {
  // Only run if forceFormatTSDoc is enabled
  if (!(options as any).forceFormatTSDoc) {
    return text;
  }

  // Match /** ... */ comments
  const tsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
  
  return text.replace(tsdocRegex, (match, commentContent) => {
    try {
      // Create mock comment object for detection 
      // The comment content from regex doesn't include /** and */, but detection expects the * pattern
      const trimmedContent = commentContent.replace(/^\s*/, '');
      const mockComment = {
        value: `*\n${trimmedContent}`,
        type: 'CommentBlock'
      };
      
      // Check if this is a TSDoc candidate
      if (!isTSDocCandidate(mockComment, true)) {
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          const logger = (options as any).logger;
          if (logger?.warn) {
            logger.warn('Not a TSDoc candidate:', JSON.stringify(mockComment.value.substring(0, 50)));
          }
        }
        return match; // Return original if not TSDoc
      }
      
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        const logger = (options as any).logger;
        if (logger?.warn) {
          logger.warn('Processing TSDoc comment:', JSON.stringify(mockComment.value.substring(0, 50)));
        }
      }
      
      // Get parser
      const extraTags = (options as any)?.tsdoc?.extraTags || [];
      const parser = getTSDocParser(extraTags);
      
      // Format the comment
      const formattedDoc = formatTSDocComment(commentContent, options, parser);
      const formatted = docToString(formattedDoc);
      
      // Return the formatted comment (already includes /** and */)
      return formatted;
    } catch (error) {
      // Return original on error
      return match;
    }
  });
}

const plugin: Plugin = {
  languages: [
    {
      name: 'TypeScript',
      parsers: ['typescript'],
      extensions: ['.ts', '.tsx'],
    },
    {
      name: 'JavaScript',
      parsers: ['babel'],
      extensions: ['.js', '.jsx'],
    },
  ],
  parsers: {
    typescript: {
      ...parserTypescript.parsers.typescript,
      preprocess: preprocessSource,
    },
    babel: {
      ...parserBabel.parsers.babel,
      preprocess: preprocessSource,
    },
  },
  options: {
    fencedIndent: {
      type: 'choice',
      category: 'TSDoc',
      default: 'space',
      description: 'Indentation style for fenced code blocks',
      choices: [
        { value: 'space', description: 'Add one space indentation' },
        { value: 'none', description: 'No additional indentation' },
      ],
    },
    forceFormatTSDoc: {
      type: 'boolean',
      category: 'TSDoc',
      default: false,
      description: 'Force format all /** comments as TSDoc',
    },
    normalizeTagOrder: {
      type: 'boolean',
      category: 'TSDoc',
      default: false,
      description: 'Normalize tag order based on conventional patterns',
    },
    dedupeReleaseTags: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Deduplicate release tags (@public, @beta, etc)',
    },
    splitModifiers: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Split modifiers to separate lines',
    },
    singleSentenceSummary: {
      type: 'boolean',
      category: 'TSDoc',
      default: false,
      description: 'Enforce single sentence summaries',
    },
    releaseTagStrategy: {
      type: 'choice',
      category: 'TSDoc',
      default: 'keep-first',
      description: 'Strategy for release tag deduplication',
      choices: [
        { value: 'keep-first', description: 'Keep the first occurrence' },
        { value: 'keep-last', description: 'Keep the last occurrence' },
      ],
    },
    alignParamTags: {
      type: 'boolean',
      category: 'TSDoc',
      default: false,
      description: 'Align parameter descriptions in @param and @typeParam tags',
    },
    defaultReleaseTag: {
      type: 'string',
      category: 'TSDoc',
      default: '@internal',
      description: 'Default release tag to add when no release tag is present (use null to disable)',
    },
    onlyExportedAPI: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Only add release tags to exported API constructs (AST-aware detection)',
    },
    inheritanceAware: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Respect inheritance rules - skip tagging class/interface members',
    },
  },
};

export default plugin;
