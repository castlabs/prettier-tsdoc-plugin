/**
 * Preprocessor for TSDoc comments that integrates with Prettier's parser extension.
 * This module handles AST-aware comment formatting before Prettier processes the AST.
 */

import { TSDocParser } from '@microsoft/tsdoc';
import {
  analyzeSourceForTSDoc,
  replaceCommentsInSource,
} from './ast-analyzer.js';
import { isTSDocCandidate } from './detection.js';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import type { PrettierOptionsWithTSDoc } from './types.js';
import { parserCache, PerformanceMonitor } from './utils/cache.js';
import { debugLog, logWarning } from './utils/common.js';
import { safeDocToString } from './utils/doc-to-string.js';

/**
 * Cache for TSDoc parsers with performance monitoring
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
 * Preprocess TypeScript source code to format TSDoc comments.
 * This function is called by Prettier before parsing the AST.
 */
export function preprocessTypescript(
  text: string,
  options: PrettierOptionsWithTSDoc
): string {
  try {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Preprocessing TypeScript source with length:', text.length);
    }

    // Analyze the source code to find TSDoc comments and their contexts
    const analysis = analyzeSourceForTSDoc(text);

    if (analysis.comments.length === 0) {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('No TSDoc comments found in source');
      }
      return text;
    }

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(`Found ${analysis.comments.length} TSDoc comments`);
    }

    // Format each TSDoc comment
    const commentReplacements: Array<{
      comment: (typeof analysis.comments)[0]['comment'];
      newContent: string;
    }> = [];

    const parser = getTSDocParser(options.tsdoc?.extraTags || []);

    for (const commentContext of analysis.comments) {
      const commentText = text.substring(
        commentContext.comment.pos,
        commentContext.comment.end
      );

      // Extract the comment value (strip /** and */)
      const commentValue = extractCommentValue(commentText);

      // Check if this is a TSDoc candidate
      if (!isTSDocCandidate({ type: 'CommentBlock', value: commentValue })) {
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('Skipping non-TSDoc comment:', commentText.substring(0, 50));
        }
        continue;
      }

      try {
        // Create export context from our analysis
        const exportContext = {
          isExported: commentContext.isExported,
          followingCode: commentContext.declaration
            ? text.substring(
                commentContext.comment.end,
                Math.min(commentContext.comment.end + 200, text.length)
              )
            : '',
        };

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('Processing comment with context:', {
            isExported: exportContext.isExported,
            isClassMember: commentContext.isClassMember,
            exportType: commentContext.exportType,
            hasDeclaration: !!commentContext.declaration,
          });
        }

        // Format the comment using existing logic
        const formattedDoc = formatTSDocComment(
          commentValue,
          options,
          parser,
          undefined, // No AST path in preprocessing
          exportContext
        );

        // Convert the formatted Doc back to string
        const formattedString = safeDocToString(formattedDoc);

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog(
            'Formatted comment result:',
            JSON.stringify(formattedString)
          );
        }

        commentReplacements.push({
          comment: commentContext.comment,
          newContent: formattedString,
        });
      } catch (error) {
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          logWarning(
            options.logger,
            `Failed to format TSDoc comment: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        // Skip this comment and leave it unchanged
        continue;
      }
    }

    if (commentReplacements.length === 0) {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('No comments were formatted');
      }
      return text;
    }

    // Replace comments in the source text
    const result = replaceCommentsInSource(text, commentReplacements);

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(`Replaced ${commentReplacements.length} comments in source`);
    }

    return result;
  } catch (error) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      logWarning(
        options.logger,
        `Preprocessing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    // Return original text if preprocessing fails
    return text;
  }
}

/**
 * Preprocess JavaScript source code to format TSDoc comments.
 * Similar to TypeScript preprocessing but for JavaScript files.
 */
export function preprocessJavaScript(
  text: string,
  options: PrettierOptionsWithTSDoc
): string {
  // For JavaScript, we can use the same logic as TypeScript
  // but we might need to handle some differences in the future
  return preprocessTypescript(text, options);
}

/**
 * Extract the comment value from a full comment string.
 * Strips the comment delimiters.
 */
function extractCommentValue(commentText: string): string {
  // Remove /** at the start and */ at the end
  let value = commentText.trim();

  if (value.startsWith('/**')) {
    value = value.substring(3);
  }

  if (value.endsWith('*/')) {
    value = value.substring(0, value.length - 2);
  }

  // Remove leading newline and whitespace if present and ensure we start with *
  value = value.replace(/^\s+/, '');

  return value;
}
