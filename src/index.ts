import type { Plugin, AstPath, ParserOptions, Doc } from 'prettier';
import { TSDocParser } from '@microsoft/tsdoc';
import { createTSDocConfiguration } from './parser-config.js';
import { isTSDocCandidate } from './detection.js';
import { formatTSDocComment } from './format.js';

// Cached parser instances with memoized configurations for performance
const parserCache = new Map<string, TSDocParser>();

function getTSDocParser(extraTags: string[] = []): TSDocParser {
  // Create cache key based on configuration
  const cacheKey = extraTags.length > 0 ? extraTags.sort().join(',') : 'default';
  
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
): Doc {
  const comment = commentPath.getValue();
  
  // Check if this is a TSDoc candidate
  if (!isTSDocCandidate(comment, false)) {
    // Return the original comment as-is
    return comment.value.split('\n').map((line: string, i: number) => {
      if (i === 0) return `/*${line}`;
      if (i === comment.value.split('\n').length - 1) return `${line}*/`;
      return ` ${line}`;
    }).join('\n');
  }

  try {
    // Get cached parser (with potential extraTags from options)
    const extraTags = (options as any).tsdoc?.extraTags || [];
    const parser = getTSDocParser(extraTags);
    
    // Format the comment
    return formatTSDocComment(comment.value, options, parser);
  } catch (error) {
    // Gracefully handle formatting errors
    if ((options as any).logger?.warn) {
      (options as any).logger.warn(`TSDoc formatting failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Return original comment as fallback
    return comment.value.split('\n').map((line: string, i: number) => {
      if (i === 0) return `/*${line}`;
      if (i === comment.value.split('\n').length - 1) return `${line}*/`;
      return ` ${line}`;
    }).join('\n');
  }
}

/**
 * Prettier plugin for TSDoc comment formatting.
 * 
 * This implementation detects TSDoc candidates, parses them, and formats
 * the summary and @remarks sections according to the specification.
 */
const plugin: Plugin = {
  printers: {
    // We'll implement custom comment handling later
    // For now, we need to return something that Prettier accepts
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
  },
};

export default plugin;
