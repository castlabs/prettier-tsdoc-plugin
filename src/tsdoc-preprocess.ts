import { TSDocParser } from '@microsoft/tsdoc';
import * as ts from 'typescript';
import {
  analyzeSourceForTSDoc,
  replaceCommentsInSource,
} from './ast-analyzer.js';
import { resolveOptions } from './config.js';
import { isTSDocCandidate } from './detection.js';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import type { PrettierOptionsWithTSDoc } from './types.js';
import { parserCache, PerformanceMonitor } from './utils/cache.js';
import { debugLog, logWarning } from './utils/common.js';
import {
  derivePrinterConfigFromParserOptions,
  safeDocToString,
} from './utils/doc-to-string.js';
import { applyLegacyTransformations } from './utils/legacy-transforms.js';
import { EMBEDDED_FORMATTER_FLAG } from './embedded-formatting/formatter.js';

/**
 * Shared async helper used to prepare source text for TSDoc-aware formatting.
 * The body remains synchronous today but is marked async to allow future await points.
 */
export async function prepareSourceForTSDoc(
  text: string,
  options: PrettierOptionsWithTSDoc
): Promise<string> {
  const optionsRecord = options as unknown as Record<PropertyKey, unknown>;
  if (optionsRecord[EMBEDDED_FORMATTER_FLAG]) {
    return text;
  }

  try {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Preprocessing source with length:', text.length);
    }

    const tsdocOptions = resolveOptions(options);
    optionsRecord.tsdocEmbeddedLanguageFormatting =
      tsdocOptions.embeddedLanguageFormatting;

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

    const commentReplacements: Array<{
      comment: (typeof analysis.comments)[number]['comment'];
      newContent: string;
    }> = [];

    const parser = getTSDocParser(options.tsdoc?.extraTags || []);

    for (const commentContext of analysis.comments) {
      const commentText = text.substring(
        commentContext.comment.pos,
        commentContext.comment.end
      );

      let commentValue = extractCommentValue(commentText);

      const legacyOptions = {
        closureCompilerCompat: tsdocOptions.closureCompilerCompat,
      };
      commentValue = applyLegacyTransformations(commentValue, legacyOptions);

      const isTSDocCandidateResult = isTSDocCandidate({
        type: 'CommentBlock',
        value: commentValue,
      });

      // Special case: Allow empty comments on exported APIs when defaultReleaseTag is configured
      // This enables adding default release tags to exported declarations with empty /** */ comments
      const shouldProcessEmptyComment =
        !isTSDocCandidateResult &&
        tsdocOptions.defaultReleaseTag &&
        commentContext.isExported &&
        commentValue.trim() === '';

      if (!isTSDocCandidateResult && !shouldProcessEmptyComment) {
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('Skipping non-TSDoc comment:', commentText.substring(0, 50));
        }
        continue;
      }

      if (
        process.env.PRETTIER_TSDOC_DEBUG === '1' &&
        shouldProcessEmptyComment
      ) {
        debugLog(
          'Processing empty comment on exported API for default release tag'
        );
      }

      try {
        const exportContext = {
          isExported: commentContext.isExported,
          followingCode: commentContext.declaration
            ? text.substring(
                commentContext.comment.end,
                Math.min(commentContext.comment.end + 200, text.length)
              )
            : '',
          isConstEnumProperty: commentContext.isConstEnumProperty,
          constEnumHasReleaseTag: commentContext.constEnumHasReleaseTag,
          // Add AST context information for inheritance detection
          isContainerMember:
            commentContext.isClassMember || !!commentContext.container,
          containerType:
            commentContext.container?.kind ===
            ts.SyntaxKind.InterfaceDeclaration
              ? 'interface'
              : commentContext.container?.kind ===
                  ts.SyntaxKind.ClassDeclaration
                ? 'class'
                : undefined,
          shouldInheritReleaseTag:
            commentContext.isClassMember || !!commentContext.container,
        };

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('Processing comment with context:', {
            isExported: exportContext.isExported,
            isClassMember: commentContext.isClassMember,
            exportType: commentContext.exportType,
            hasDeclaration: !!commentContext.declaration,
            isConstEnumProperty: commentContext.isConstEnumProperty,
            constEnumHasReleaseTag: commentContext.constEnumHasReleaseTag,
          });
        }

        const formattedDoc = await formatTSDocComment(
          commentValue,
          options,
          parser,
          undefined,
          exportContext
        );

        const printerConfig = derivePrinterConfigFromParserOptions(options);
        const formattedString = safeDocToString(
          formattedDoc,
          '',
          printerConfig
        );

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
        continue;
      }
    }

    if (commentReplacements.length === 0) {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('No comments were formatted');
      }
      return text;
    }

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
    return text;
  }
}

/**
 * Synchronous variant retained for compatibility with Prettier preprocess hooks.
 */
export function prepareSourceForTSDocSync(
  text: string,
  options: PrettierOptionsWithTSDoc
): string {
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    logWarning(
      options.logger,
      'prepareSourceForTSDocSync no longer performs embedded formatting; upgrade to async parser wrappers.'
    );
  }
  return text;
}

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

  const configuration = createTSDocConfiguration(extraTags);
  const parser = new TSDocParser(configuration);

  parserCache.set(extraTags, parser);

  PerformanceMonitor.endTimer('parser-creation');
  PerformanceMonitor.endTimer('parser-cache-lookup');

  return parser;
}

function extractCommentValue(commentText: string): string {
  let value = commentText.trim();

  if (value.startsWith('/**')) {
    value = value.substring(3);
  }

  if (value.endsWith('*/')) {
    value = value.substring(0, value.length - 2);
  }

  value = value.replace(/^\s+/, '');

  return value;
}
