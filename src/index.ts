import { TSDocParser } from '@microsoft/tsdoc';
import type { Plugin } from 'prettier';
import parserBabel from 'prettier/parser-babel';
import parserTypescript from 'prettier/parser-typescript';
import { FORMATTING } from './constants.js';
import { isTSDocCandidate } from './detection.js';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import type { PrettierOptionsWithTSDoc } from './types.js';
import { parserCache, PerformanceMonitor, regexCache } from './utils/cache.js';
import { logWarning } from './utils/common.js';
import { safeDocToString } from './utils/doc-to-string.js';

/**
 * Get cached TSDoc parser with performance monitoring
 */
function getTSDocParser(extraTags: string[] = []): TSDocParser {
  PerformanceMonitor.startTimer('parser-cache-lookup');

  const cached = parserCache.get(extraTags);
  if (cached) {
    PerformanceMonitor.endTimer('parser-cache-lookup');
    PerformanceMonitor.increment('parser-cache-hits');
    return cached;
  }

  PerformanceMonitor.increment('parser-cache-misses');
  PerformanceMonitor.startTimer('parser-creation');

  // Create new parser with configuration
  const configuration = createTSDocConfiguration(extraTags);
  const parser = new TSDocParser(configuration);

  // Cache the parser
  parserCache.set(extraTags, parser);

  PerformanceMonitor.endTimer('parser-creation');
  PerformanceMonitor.endTimer('parser-cache-lookup');

  return parser;
}

/**
 * Transform TSDoc comments in the source text before parsing
 */
function preprocessSource(
  text: string,
  options: PrettierOptionsWithTSDoc
): string {
  // Use compiled regex for performance
  const tsdocRegex =
    regexCache.get('tsdocComment') || FORMATTING.PATTERNS.TSDOC_COMMENT;

  return text.replace(tsdocRegex, (match, commentContent) => {
    try {
      // Create mock comment object for detection
      // The comment content from regex doesn't include /** and */, but detection expects the * pattern
      const trimmedContent = commentContent.replace(/^\s*/, '');
      const mockComment = {
        value: `*\n${trimmedContent}`,
        type: 'CommentBlock',
      };

      // Check if this is a TSDoc candidate
      if (!isTSDocCandidate(mockComment, true)) {
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          logWarning(
            options.logger,
            'Not a TSDoc candidate:',
            JSON.stringify(mockComment.value.substring(0, 50))
          );
        }
        return match; // Return original if not TSDoc
      }

      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        logWarning(
          options.logger,
          'Processing TSDoc comment:',
          JSON.stringify(mockComment.value.substring(0, 50))
        );
      }

      // Get parser
      const extraTags = options.tsdoc?.extraTags || [];
      const parser = getTSDocParser(extraTags);

      // Format the comment
      const formattedDoc = formatTSDocComment(commentContent, options, parser);
      const formatted = safeDocToString(formattedDoc);

      // Return the formatted comment (already includes /** and */)
      return formatted;
    } catch (_error) {
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
      description:
        'Default release tag to add when no release tag is present (use null to disable)',
    },
    onlyExportedAPI: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description:
        'Only add release tags to exported API constructs (AST-aware detection)',
    },
    inheritanceAware: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description:
        'Respect inheritance rules - skip tagging class/interface members',
    },
  },
};

export default plugin;
