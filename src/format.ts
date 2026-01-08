/**
 * TSDoc comment formatting logic.
 *
 * This module contains the core formatting implementation for TSDoc comments.
 */

import type { TSDocParser } from '@microsoft/tsdoc';
import type { AstPath, Doc, ParserOptions } from 'prettier';
import { doc } from 'prettier';
import { formatEmbeddedCode } from './embedded-formatting/formatter.js';
import {
  createDefaultReleaseTag,
  getTagOrderPriority,
  hasReleaseTag,
  isReleaseTag,
  normalizeTagName,
  resolveOptions,
  type TSDocPluginOptions,
} from './config.js';
import type { TSDocCommentModel } from './models.js';
import { buildCommentModel } from './models.js';
import {
  analyzeCommentContext,
  shouldAddReleaseTag,
  isLikelyClassMember,
} from './utils/ast-analysis.js';
import {
  preserveInlineTags,
  restoreInlineTags,
  stripCommentMarks,
} from './utils/markdown.js';
import { formatReturnsTag, ParamTagInfo, printAligned } from './utils/tags.js';
import {
  createCommentLine,
  createEmptyCommentLine,
  effectiveWidth,
  formatTextContent,
} from './utils/text-width.js';
import { debugLog } from './utils/common.js';
import { applyLegacyTransformations } from './utils/legacy-transforms.js';

// Debug telemetry for performance and error tracking
interface TelemetryData {
  commentsProcessed: number;
  parseErrors: number;
  formattingErrors: number;
  totalTime: number;
  cacheHits: number;
  cacheMisses: number;
}

const telemetry: TelemetryData = {
  commentsProcessed: 0,
  parseErrors: 0,
  formattingErrors: 0,
  totalTime: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

/**
 * Reset telemetry data (useful for testing)
 */
export function resetTelemetry(): void {
  telemetry.commentsProcessed = 0;
  telemetry.parseErrors = 0;
  telemetry.formattingErrors = 0;
  telemetry.totalTime = 0;
  telemetry.cacheHits = 0;
  telemetry.cacheMisses = 0;
}

/**
 * Get current telemetry data
 */
export function getTelemetry(): Readonly<TelemetryData> {
  return { ...telemetry };
}

/**
 * Check if a comment model represents a standalone file-level block
 * that shouldn't receive automatic release tags.
 */
function isStandaloneFileLevelBlock(model: TSDocCommentModel): boolean {
  // File-level tags that indicate a standalone comment block
  const fileLevelTags = [
    '@packageDocumentation',
    '@fileoverview', // This gets transformed to @packageDocumentation but we check both
    '@license',
    '@module',
  ];

  return model.otherTags.some((tag) => fileLevelTags.includes(tag.tagName));
}

/**
 * Log debug telemetry if debug mode is enabled
 */
function logDebugTelemetry(options: ParserOptions<any>): void {
  if (process.env.PRETTIER_TSDOC_DEBUG !== '1') return;

  const logger = (options as any).logger;
  if (logger?.warn) {
    const avgTime =
      telemetry.commentsProcessed > 0
        ? telemetry.totalTime / telemetry.commentsProcessed
        : 0;
    const cacheHitRate =
      telemetry.cacheHits + telemetry.cacheMisses > 0
        ? (
            (telemetry.cacheHits /
              (telemetry.cacheHits + telemetry.cacheMisses)) *
            100
          ).toFixed(1)
        : '0';

    logger.warn('TSDoc Debug Telemetry:', {
      commentsProcessed: telemetry.commentsProcessed,
      parseErrors: telemetry.parseErrors,
      formattingErrors: telemetry.formattingErrors,
      averageTimeMs: avgTime.toFixed(2),
      cacheHitRate: `${cacheHitRate}%`,
    });
  }
}

const { builders } = doc;
const { hardline, group } = builders;

/**
 * Format a TSDoc comment from raw comment text.
 *
 * @param commentValue - The comment content (without delimiters)
 * @param options - Prettier formatting options
 * @param parser - TSDoc parser instance
 * @param commentPath - Optional AST path for context analysis
 * @returns Formatted comment as Prettier Doc
 */
export async function formatTSDocComment(
  commentValue: string,
  options: any,
  parser: TSDocParser,
  commentPath?: AstPath<any>,
  exportContext?: {
    isExported: boolean;
    followingCode: string;
    isConstEnumProperty?: boolean;
    constEnumHasReleaseTag?: boolean;
    isContainerMember?: boolean;
    containerType?: string;
    shouldInheritReleaseTag?: boolean;
  }
): Promise<Doc> {
  const startTime = performance.now();

  try {
    // Resolve TSDoc-specific options
    const tsdocOptions = resolveOptions(options);

    // Apply legacy transformations before parsing
    // Handle different input formats:
    // 1. Raw comment content: " * This is a comment..."
    // 2. Already formatted comment: "/**\n * This is a comment...\n */"
    let processedCommentValue: string;

    // Check if this is a full formatted comment (ignoring leading/trailing whitespace)
    const trimmedComment = commentValue.trim();
    if (trimmedComment.startsWith('/**') && trimmedComment.endsWith('*/')) {
      // Already a full formatted comment - extract the content
      const rawContent = trimmedComment
        .substring(3, trimmedComment.length - 2) // Remove /** and */
        .replace(/^\n/, '') // Remove leading newline after /**
        .replace(/\n$/, ''); // Remove trailing newline before */

      // Clean up the comment markers from each line and reconstruct properly
      const lines = rawContent.split('\n');
      const cleanedLines: string[] = [];

      for (const line of lines) {
        // Remove leading whitespace and comment asterisk ONLY when followed by whitespace or end of line.
        // Using lookahead (?=\s|$) ensures we don't strip the first * from markdown bold syntax like **text**
        const cleaned = line.replace(/^\s*\*(?=\s|$)\s?/, '');
        cleanedLines.push(cleaned);
      }

      // Filter out empty trailing lines and reconstruct with proper formatting
      while (
        cleanedLines.length > 0 &&
        cleanedLines[cleanedLines.length - 1].trim() === ''
      ) {
        cleanedLines.pop();
      }

      // Reconstruct the content in the format expected by TSDoc parser
      // This should match the format of raw comment content: "\n * content\n * more content\n"
      if (cleanedLines.length > 0) {
        processedCommentValue = '\n * ' + cleanedLines.join('\n * ') + '\n';
      } else {
        processedCommentValue = '';
      }

      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog(
          'Extracted and cleaned comment content:',
          JSON.stringify(processedCommentValue)
        );
      }
    } else if (commentValue.startsWith('*')) {
      // Raw comment content starting with *
      processedCommentValue = commentValue.substring(1);
    } else {
      // Raw comment content without leading *
      processedCommentValue = commentValue;
    }

    // Apply legacy Closure Compiler transformations if enabled
    const legacyOptions = {
      closureCompilerCompat: tsdocOptions.closureCompilerCompat,
    };
    processedCommentValue = applyLegacyTransformations(
      processedCommentValue,
      legacyOptions
    );

    const fullComment = `/**${processedCommentValue}*/`;

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Full comment to parse:', JSON.stringify(fullComment));
    }

    const parserContext = parser.parseString(fullComment);

    // Check for parse errors
    if (parserContext.log.messages.length > 0) {
      telemetry.parseErrors++;

      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog(
          'TSDoc parse warnings:',
          parserContext.log.messages.map((m) => m.text)
        );
      }
    }

    // Build intermediate model
    const model = buildCommentModel(parserContext.docComment, fullComment);

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Built model:', {
        summary: model.summary?.content,
        params: model.params.map((p) => `${p.tagName} ${p.name}`),
        returns: model.returns?.tagName,
        otherTags: model.otherTags.map(
          (t) => `${t.tagName}: ${t.content.substring(0, 50)}`
        ),
      });
    }

    // Apply normalizations and transformations
    const normalizedModel = applyNormalizations(
      model,
      tsdocOptions,
      commentPath,
      commentValue,
      exportContext
    );

    // Convert model to Prettier Doc
    const result = await buildPrettierDoc(
      normalizedModel,
      options,
      tsdocOptions
    );

    // Update telemetry
    telemetry.commentsProcessed++;
    telemetry.totalTime += performance.now() - startTime;

    // Log debug info periodically
    if (telemetry.commentsProcessed % 100 === 0) {
      logDebugTelemetry(options);
    }

    return result;
  } catch (error) {
    telemetry.formattingErrors++;

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      const logger = (options as any).logger;
      if (logger?.warn) {
        logger.warn(
          'TSDoc formatting error:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Return a basic formatted version as fallback
    return createFallbackDoc(commentValue);
  }
}

/**
 * Create a fallback Doc when formatting fails
 */
function createFallbackDoc(commentValue: string): Doc {
  const lines = commentValue.split('\n');
  const result: any[] = [];

  result.push('/**');
  for (const line of lines) {
    result.push(hardline);
    result.push(createCommentLine(line.replace(/^\s*\*?\s?/, '')));
  }
  result.push(hardline);
  result.push('*/');

  return result;
}

/**
 * Apply normalizations and transformations to the comment model.
 */
function applyNormalizations(
  model: TSDocCommentModel,
  options: TSDocPluginOptions,
  commentPath?: AstPath<any>,
  commentValue?: string,
  exportContext?: {
    isExported: boolean;
    followingCode: string;
    isConstEnumProperty?: boolean;
    constEnumHasReleaseTag?: boolean;
    isContainerMember?: boolean;
    containerType?: string;
    shouldInheritReleaseTag?: boolean;
  }
): TSDocCommentModel {
  const normalizedModel: TSDocCommentModel = {
    ...model,
    params: [...model.params],
    typeParams: [...model.typeParams],
    otherTags: [...model.otherTags],
  };

  // Apply tag name normalizations to all tag sections
  normalizedModel.params = normalizedModel.params.map((param) => ({
    ...param,
    tagName: normalizeTagName(param.tagName, options),
  }));

  normalizedModel.typeParams = normalizedModel.typeParams.map((typeParam) => ({
    ...typeParam,
    tagName: normalizeTagName(typeParam.tagName, options),
  }));

  if (normalizedModel.returns) {
    normalizedModel.returns = {
      ...normalizedModel.returns,
      tagName: normalizeTagName(normalizedModel.returns.tagName, options),
    };
  }

  normalizedModel.otherTags = normalizedModel.otherTags.map((tag) => ({
    ...tag,
    tagName: normalizeTagName(tag.tagName, options),
  }));

  // Check if this is a standalone file-level block that shouldn't get release tags
  const isFileLevelBlock = isStandaloneFileLevelBlock(normalizedModel);

  // Store original release tag status before any modifications
  const originalHasReleaseTag = hasReleaseTag(normalizedModel);

  // Apply default release tag insertion using AST-aware analysis
  if (
    options.defaultReleaseTag &&
    !originalHasReleaseTag &&
    !isFileLevelBlock
  ) {
    // Default to false when onlyExportedAPI is true but no AST context is available
    // This ensures we don't add release tags to non-exported code when we can't determine export status
    let shouldInsertTag = !options.onlyExportedAPI;

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Release tag conditions:', {
        defaultReleaseTag: options.defaultReleaseTag,
        hasReleaseTag: hasReleaseTag(normalizedModel),
        onlyExportedAPI: options.onlyExportedAPI,
        hasCommentPath: !!commentPath,
      });
    }

    // Use AST analysis if enabled and context is available
    if (options.onlyExportedAPI && commentPath) {
      try {
        const analysis = analyzeCommentContext(commentPath);
        shouldInsertTag = shouldAddReleaseTag(analysis, false);

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('AST Analysis Result:', {
            isExported: analysis.isExported,
            exportType: analysis.exportType,
            isContainerMember: analysis.isContainerMember,
            containerType: analysis.containerType,
            shouldInheritReleaseTag: analysis.shouldInheritReleaseTag,
            shouldInsertTag,
          });
        }
      } catch (error) {
        // Fallback to heuristic analysis when AST analysis fails
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          console.warn(
            'AST analysis failed, falling back to heuristic analysis:',
            error
          );
        }

        // Use heuristic-based class member detection as fallback
        const isClassMember = commentValue
          ? isLikelyClassMember(commentValue)
          : false;
        shouldInsertTag = !isClassMember;

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('Heuristic Analysis Result:', {
            isLikelyClassMember: isClassMember,
            shouldInsertTag,
          });
        }
      }
    } else if (options.onlyExportedAPI && !commentPath) {
      // When onlyExportedAPI is true but no AST context, use export context if available
      if (exportContext) {
        // Check if this is a const enum property that should inherit
        if (
          exportContext.isConstEnumProperty &&
          exportContext.constEnumHasReleaseTag
        ) {
          shouldInsertTag = false;
          if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
            debugLog(
              'Const enum property inherits release tag from parent - skipping tag insertion'
            );
          }
        } else {
          // Use the export context from preprocessor to determine if we should add tags
          const isClassMember = commentValue
            ? isLikelyClassMember(commentValue)
            : false;

          // Check if this is a container member that should inherit
          const shouldInherit =
            exportContext.isContainerMember &&
            exportContext.shouldInheritReleaseTag;

          // Don't add tags if it should inherit from parent container
          shouldInsertTag =
            exportContext.isExported && !isClassMember && !shouldInherit;

          if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
            debugLog('Using export context for release tag decision:', {
              isExported: exportContext.isExported,
              isLikelyClassMember: isClassMember,
              isContainerMember: exportContext.isContainerMember,
              shouldInheritReleaseTag: exportContext.shouldInheritReleaseTag,
              shouldInherit,
              shouldInsertTag,
              followingCode: exportContext.followingCode.substring(0, 50),
            });
          }
        }
      } else {
        // No export context available, skip tag insertion for safety
        shouldInsertTag = false;

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog(
            'onlyExportedAPI enabled but no AST or export context - skipping tag insertion for safety'
          );
        }
      }
    } else if (options.inheritanceAware) {
      // If inheritance-aware mode is enabled but no AST context, use heuristic
      const isClassMember = commentValue
        ? isLikelyClassMember(commentValue)
        : false;
      shouldInsertTag = !isClassMember;

      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('Inheritance-aware heuristic analysis:', {
          isLikelyClassMember: isClassMember,
          shouldInsertTag,
        });
      }
    } else {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('Skipping analysis - using legacy behavior');
      }
    }

    // Insert default tag if analysis determines it's appropriate
    if (shouldInsertTag) {
      const defaultTag = createDefaultReleaseTag(options.defaultReleaseTag);
      // Add the default release tag to the beginning of otherTags for conventional ordering
      normalizedModel.otherTags.unshift(defaultTag);
    }
  }

  // Remove release tags from container members if inheritance-aware mode is enabled
  // BUT ONLY if they don't have explicit release tags from the original comment
  if (options.inheritanceAware) {
    let shouldRemoveTags = false;

    // Use the original release tag status to determine if we should preserve explicit tags
    // This prevents removing @internal tags that were explicitly set in @public interfaces

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Tag removal check:', {
        hasCommentPath: !!commentPath,
        hasCommentValue: !!commentValue,
        originalHasReleaseTag,
        currentReleaseTags: normalizedModel.otherTags
          .filter((tag) => isReleaseTag(tag.tagName))
          .map((tag) => tag.tagName),
      });
    }

    // Only remove tags from container members that DON'T have original explicit release tags
    // This preserves intentional @internal overrides in @public interfaces
    if (!originalHasReleaseTag) {
      if (commentPath) {
        // Use AST analysis when available (consistent with tag insertion logic)
        try {
          const analysis = analyzeCommentContext(commentPath);
          shouldRemoveTags =
            analysis.isContainerMember && analysis.shouldInheritReleaseTag;

          if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
            debugLog('AST-based tag removal analysis:', {
              isContainerMember: analysis.isContainerMember,
              shouldInheritReleaseTag: analysis.shouldInheritReleaseTag,
              containerType: analysis.containerType,
              shouldRemoveTags,
            });
          }
        } catch (error) {
          // Fallback to heuristic analysis when AST analysis fails
          if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
            console.warn(
              'AST analysis failed for tag removal, falling back to heuristic:',
              error
            );
          }
          shouldRemoveTags = commentValue
            ? isLikelyClassMember(commentValue)
            : false;

          if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
            debugLog('Heuristic fallback result:', {
              isLikelyClassMember: shouldRemoveTags,
            });
          }
        }
      } else {
        // Fallback to heuristic analysis when no AST context
        shouldRemoveTags = commentValue
          ? isLikelyClassMember(commentValue)
          : false;

        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('No AST context, using heuristic:', {
            isLikelyClassMember: shouldRemoveTags,
          });
        }
      }

      if (shouldRemoveTags) {
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('Removing release tags from detected container member');
        }
        // Remove all release tags from container members since they should inherit from container
        normalizedModel.otherTags = normalizedModel.otherTags.filter(
          (tag) => !isReleaseTag(tag.tagName)
        );
      }
    } else {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog(
          'Preserving explicit release tags - not removing from container member'
        );
      }
    }
  }

  // Apply release tag deduplication
  if (options.dedupeReleaseTags) {
    normalizedModel.otherTags = deduplicateReleaseTags(
      normalizedModel.otherTags,
      options.releaseTagStrategy || 'keep-first'
    );
  }

  // Apply tag ordering if enabled
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('normalizeTagOrder option:', options.normalizeTagOrder);
  }
  if (options.normalizeTagOrder) {
    normalizedModel.otherTags = sortTagsByCanonicalOrder(
      normalizedModel.otherTags
    );
  }

  return normalizedModel;
}

/**
 * Deduplicate release tags based on the configured strategy.
 */
function deduplicateReleaseTags(
  tags: any[],
  strategy: 'keep-first' | 'keep-last'
): any[] {
  const seenReleaseTags = new Set<string>();
  const result: any[] = [];

  // Process tags in order based on strategy
  const tagsToProcess = strategy === 'keep-last' ? [...tags].reverse() : tags;

  for (const tag of tagsToProcess) {
    if (isReleaseTag(tag.tagName)) {
      if (!seenReleaseTags.has(tag.tagName)) {
        seenReleaseTags.add(tag.tagName);
        result.push(tag);
      }
      // Skip duplicate release tags
    } else {
      result.push(tag);
    }
  }

  // If we processed in reverse for keep-last, reverse back
  return strategy === 'keep-last' ? result.reverse() : result;
}

/**
 * Sort tags according to canonical order defined in Phase 110 specification.
 * Tags within the same group maintain their relative order.
 */
function sortTagsByCanonicalOrder(tags: any[]): any[] {
  // Create a stable sort that preserves relative order within groups
  return [...tags].sort((a, b) => {
    const priorityA = getTagOrderPriority(a.tagName);
    const priorityB = getTagOrderPriority(b.tagName);

    if (priorityA === priorityB) {
      // Same priority group - maintain relative order (stable sort)
      return 0;
    }

    return priorityA - priorityB;
  });
}

/**
 * Format text content with improved markdown support.
 * Note: Full async Prettier formatting would require architectural changes,
 * so we use enhanced text processing for now.
 */
async function formatTextWithMarkdown(
  text: string,
  options: ParserOptions<any>
): Promise<any> {
  if (!text.trim()) {
    return null;
  }

  try {
    // Strip comment marks for processing
    const cleanText = stripCommentMarks(text);

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      const logger = (options as any).logger;
      if (logger?.warn) {
        logger.warn('formatTextWithMarkdown input:', JSON.stringify(text));
        logger.warn(
          'formatTextWithMarkdown cleanText:',
          JSON.stringify(cleanText)
        );
      }
    }

    // Apply enhanced markdown-aware text formatting
    const formatted = await formatMarkdownText(cleanText, options);

    return formatted;
  } catch (error) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      const logger = (options as any).logger;
      if (logger?.warn) {
        logger.warn(
          'Markdown formatting failed, falling back to basic formatting:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Fallback to the original text formatting
    return formatTextContent(text, options);
  }
}

/**
 * Enhanced markdown text formatting with proper list handling and line wrapping
 */
async function formatMarkdownText(
  text: string,
  options: ParserOptions<any>
): Promise<any> {
  if (!text.trim()) {
    return null;
  }

  const tsdocOptions = resolveOptions(options);
  const embeddedPreference = tsdocOptions.embeddedLanguageFormatting;

  // Preserve inline tags to prevent them from being split during text wrapping
  const { text: textWithTokens, tokens } = preserveInlineTags(text);

  // Split text into lines to process properly
  const lines = textWithTokens.split('\n');
  const result: any[] = [];
  let currentParagraph: string[] = [];
  let _lastWasListItem = false;
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('formatMarkdownText input lines:', JSON.stringify(lines));
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('```')) {
      // Fenced code block start or end
      if (!inCodeBlock) {
        // Starting a code block - end current paragraph first
        if (currentParagraph.length > 0) {
          const paragraphText = currentParagraph.join(' ');
          const wrapped = wrapTextToString(paragraphText, options);
          result.push(wrapped);
          currentParagraph = [];
        }

        // Start code block
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim() || 'text';
        codeBlockLines = [];
        result.push({
          type: 'code-fence-start',
          content: line,
        });
      } else {
        // Ending a code block - format the collected code
        inCodeBlock = false;

        // Format the code block content using Prettier for supported languages
        if (codeBlockLines.length > 0) {
          const codeContent = codeBlockLines.join('\n');
          try {
            const formattedCode = await formatCodeBlock(
              codeContent,
              codeBlockLanguage,
              options,
              embeddedPreference
            );

            // Add the formatted code lines
            const formattedLines = formattedCode.split('\n');
            for (const codeLine of formattedLines) {
              result.push({
                type: 'code-line',
                content: codeLine,
              });
            }
          } catch (error) {
            // Fallback to original code if formatting fails
            if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
              debugLog('Code formatting failed:', error);
            }
            for (const codeLine of codeBlockLines) {
              result.push({
                type: 'code-line',
                content: codeLine,
              });
            }
          }
        }

        // Add closing code fence
        result.push({
          type: 'code-fence-end',
          content: line,
        });
      }
      _lastWasListItem = false;
    } else if (inCodeBlock) {
      // Inside a code block - collect the line (preserve original line with indentation)
      codeBlockLines.push(lines[i]); // Use original line, not trimmed
      _lastWasListItem = false;
    } else if (!line) {
      // Empty line - end current paragraph if any
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        const wrapped = wrapTextToString(paragraphText, options);
        result.push(wrapped);
        currentParagraph = [];
      }

      // Always add empty string for paragraph breaks, regardless of whether we had a current paragraph
      // This ensures proper spacing after lists, code blocks, etc.
      result.push('');
      _lastWasListItem = false;
    } else if (line.match(/^[-*+]\s/)) {
      // List item - end current paragraph first
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        const wrapped = wrapTextToString(paragraphText, options);
        result.push(wrapped);
        currentParagraph = [];
        // Don't add extra empty line before list - spacing will be handled by the existing paragraph breaks
      }

      // Collect all content for this list item (including continuation lines)
      const listContent: string[] = [];
      const match = line.match(/^([-*+])\s(.+)$/);
      if (match) {
        const [, marker, content] = match;
        listContent.push(content);

        // Look ahead for continuation lines
        let j = i + 1;
        let lastConsumedIndex = i; // Track the last line we actually consumed
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (!nextLine) {
            // Empty line ends the list item
            break;
          } else if (nextLine.match(/^[-*+]\s/)) {
            // Another list item ends this one
            break;
          } else {
            // Continuation line - add to this list item
            listContent.push(nextLine);
            lastConsumedIndex = j; // Update the last consumed index
            j++;
          }
        }
        // Set i to the last line we actually consumed, so the main loop continues correctly
        i = lastConsumedIndex;

        // Join all content and wrap
        const fullContent = listContent.join(' ');
        const wrappedLines = wrapListItemContent(fullContent, options);
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          debugLog('List item wrapped lines:', JSON.stringify(wrappedLines));
        }
        result.push({
          type: 'list-item',
          marker,
          lines: wrappedLines,
        });
      }
      _lastWasListItem = true;
    } else {
      // Regular text line - add to current paragraph
      currentParagraph.push(line);
      _lastWasListItem = false;
    }
  }

  // Handle remaining paragraph
  if (currentParagraph.length > 0) {
    const paragraphText = currentParagraph.join(' ');
    const wrapped = wrapTextToString(paragraphText, options);
    result.push(wrapped);
  }

  // Restore inline tags in the final result
  const finalResult =
    result.length > 0 ? result : [wrapTextToString(textWithTokens, options)];

  return finalResult.map((item: any) => {
    if (typeof item === 'string') {
      return restoreInlineTags(item, tokens);
    } else if (item && typeof item === 'object' && item.type === 'list-item') {
      // Restore inline tags in list item lines
      return {
        ...item,
        lines: item.lines.map((line: string) =>
          restoreInlineTags(line, tokens)
        ),
      };
    } else if (
      item &&
      typeof item === 'object' &&
      (item.type === 'code-fence-start' ||
        item.type === 'code-fence-end' ||
        item.type === 'code-line')
    ) {
      // Code block elements - restore inline tags in content
      return {
        ...item,
        content: restoreInlineTags(item.content, tokens),
      };
    }
    return item;
  });
}

/**
 * Wrap text to string format for comment content
 * Preserves inline code spans (backticks) and prevents them from being split across lines
 */
function wrapTextToString(text: string, options: ParserOptions<any>): string {
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3; // Account for "* "

  if (text.length <= availableWidth) {
    return text;
  }

  // Check if text contains backticks - if so, be more careful about wrapping
  if (text.includes('`')) {
    return wrapTextWithBackticks(text, availableWidth);
  }

  // Simple word wrapping for text without backticks
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= availableWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word); // Word is too long, but include it anyway
        currentLine = '';
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Special text wrapping that preserves inline code spans (backticks)
 */
function wrapTextWithBackticks(text: string, availableWidth: number): string {
  // Split on backticks to find code spans
  const parts = text.split('`');
  const result: string[] = [];
  let currentLine = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isCodeSpan = i % 2 === 1; // Odd indices are inside backticks

    if (isCodeSpan) {
      // This is inside backticks - keep it together
      const codeSpan = '`' + part + '`';

      // Check if adding this code span would exceed the line width
      const needsSpaceBeforeBacktick =
        currentLine && !currentLine.endsWith(' ');
      const spaceForBacktick = needsSpaceBeforeBacktick ? 1 : 0;

      if (
        currentLine.length + codeSpan.length + spaceForBacktick <=
        availableWidth
      ) {
        currentLine += (needsSpaceBeforeBacktick ? ' ' : '') + codeSpan;
      } else {
        // Code span is too long for current line
        if (currentLine.trim()) {
          result.push(currentLine);
          currentLine = codeSpan;
        } else {
          // Even on a new line it's too long, but include it anyway
          currentLine = codeSpan;
        }
      }
    } else {
      // Regular text - handle space preservation carefully
      if (!part) continue; // Skip empty parts

      // If this part comes after a backtick (even indices > 0), and the part starts with a space,
      // we need to ensure proper spacing
      const startsWithSpace = part.match(/^\s/);

      // Extract words but preserve the information about leading space
      const words = part
        .trim()
        .split(/\s+/)
        .filter((w) => w);

      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        const word = words[wordIndex];
        let needsSpace = false;

        if (wordIndex === 0) {
          // First word of this part
          if (i > 0 && i % 2 === 0 && startsWithSpace && currentLine) {
            // This part comes after a backtick and starts with space
            needsSpace = true;
          } else if (currentLine && !currentLine.endsWith(' ')) {
            // Normal spacing between words
            needsSpace = true;
          }
        } else {
          // Subsequent words always need space if there's content on the line
          needsSpace = !!(currentLine && !currentLine.endsWith(' '));
        }

        const spaceNeeded = needsSpace ? 1 : 0;

        if (currentLine.length + word.length + spaceNeeded <= availableWidth) {
          currentLine += (needsSpace ? ' ' : '') + word;
        } else {
          if (currentLine.trim()) {
            result.push(currentLine);
            // For wrapped lines, preserve leading space context ONLY if we're starting
            // a new line with the FIRST word from a part that follows a backtick
            const shouldPreserveSpace =
              i > 0 && i % 2 === 0 && startsWithSpace && wordIndex === 0;
            if (shouldPreserveSpace) {
              currentLine = ' ' + word;
            } else {
              currentLine = word;
            }
          } else {
            currentLine = word;
          }
        }
      }
    }
  }

  if (currentLine.trim()) {
    result.push(currentLine);
  }

  return result.join('\n');
}

/**
 * Wrap list item content into an array of lines
 */
function wrapListItemContent(
  text: string,
  options: ParserOptions<any>
): string[] {
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3; // Account for " * " (3 characters) - the "- " is part of content

  // First, normalize the text by collapsing whitespace and newlines
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length <= availableWidth) {
    return [normalizedText];
  }

  // Simple word wrapping
  const words = normalizedText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= availableWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word); // Word is too long, but include it anyway
        currentLine = '';
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Convert the intermediate model to a Prettier Doc structure.
 */
async function buildPrettierDoc(
  model: TSDocCommentModel,
  options: ParserOptions<any>,
  tsdocOptions?: TSDocPluginOptions
): Promise<Doc> {
  const parts: any[] = [];
  const width = effectiveWidth(options);

  // Opening /**
  parts.push('/**');

  // Summary section
  if (model.summary) {
    // Debug: log the raw summary content
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Summary content:', JSON.stringify(model.summary.content));
    }

    const summaryContent = await formatTextWithMarkdown(
      model.summary.content,
      options
    );
    if (summaryContent) {
      parts.push(hardline);
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('Summary content array:', JSON.stringify(summaryContent));
      }
      appendMarkdownSegments(parts, summaryContent);
    }
  }

  // Check if we need blank line before next section
  const hasContent = model.summary || model.remarks;
  const hasParamLikeTags =
    model.params.length > 0 || model.typeParams.length > 0 || model.returns;

  // Check if we have meta-data tags (non-example tags in otherTags)
  const hasMetaDataTags = model.otherTags.some(
    (tag) => tag.tagName !== '@example'
  );
  const hasAnyMetaData = hasParamLikeTags || hasMetaDataTags;

  // Blank line before remarks (if both summary and remarks exist)
  if (model.summary && model.remarks) {
    parts.push(hardline);
    parts.push(createEmptyCommentLine());
  }

  // Remarks section
  if (model.remarks) {
    // If no summary but has remarks, add line after opening
    if (!model.summary) {
      parts.push(hardline);
    }
    const remarksContent = await formatTextWithMarkdown(
      model.remarks.content,
      options
    );
    if (remarksContent) {
      parts.push(hardline);
      appendMarkdownSegments(parts, remarksContent);
    }
  }

  // Blank line before meta-data block (parameters and other annotations)
  // when normalizeTagOrder is enabled (Phase 110 requirement)
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('Blank line decision:', {
      normalizeTagOrder: tsdocOptions?.normalizeTagOrder,
      hasContent,
      hasAnyMetaData,
      condition:
        tsdocOptions?.normalizeTagOrder && hasContent && hasAnyMetaData,
    });
  }
  if (tsdocOptions?.normalizeTagOrder && hasContent && hasAnyMetaData) {
    parts.push(hardline);
    parts.push(createEmptyCommentLine());
  }

  // @param tags
  if (model.params.length > 0) {
    const paramTags: ParamTagInfo[] = model.params.map((p) => ({
      tagName: p.tagName,
      name: p.name,
      description: p.description,
      rawNode: p.rawNode,
    }));
    const alignedParams = printAligned(
      paramTags,
      width,
      tsdocOptions?.alignParamTags ?? false,
      options
    );
    for (const paramLine of alignedParams) {
      parts.push(hardline);
      parts.push(paramLine);
    }
  }

  // @typeParam tags
  if (model.typeParams.length > 0) {
    const typeParamTags: ParamTagInfo[] = model.typeParams.map((tp) => ({
      tagName: tp.tagName,
      name: tp.name,
      description: tp.description,
      rawNode: tp.rawNode,
    }));
    const alignedTypeParams = printAligned(
      typeParamTags,
      width,
      tsdocOptions?.alignParamTags ?? false,
      options
    );
    for (const typeParamLine of alignedTypeParams) {
      parts.push(hardline);
      parts.push(typeParamLine);
    }
  }

  // @returns tag
  if (model.returns) {
    parts.push(hardline);
    parts.push(formatReturnsTag(model.returns));
  }

  // Other tags (like @example, @see, etc.)
  if (model.otherTags.length > 0) {
    // Separate meta-data tags from example tags
    const metaDataTags: any[] = [];
    const exampleTags: any[] = [];

    for (const tag of model.otherTags) {
      if (tag.tagName === '@example') {
        exampleTags.push(tag);
      } else {
        metaDataTags.push(tag);
      }
    }

    // Process meta-data tags (release tags, @deprecated, @see, etc.)
    // These are part of the meta-data block and don't need special spacing
    for (const tag of metaDataTags) {
      parts.push(hardline);
      parts.push(await formatOtherTag(tag, options));
    }

    // Process @example tags with special spacing (Phase 110 requirement)
    for (let i = 0; i < exampleTags.length; i++) {
      const tag = exampleTags[i];

      // Always add blank line before @example tags
      if (i === 0) {
        // First @example tag - check if we need to add initial blank line
        const hasAnyPreviousContent = hasContent || hasAnyMetaData;
        if (hasAnyPreviousContent) {
          parts.push(hardline);
          parts.push(createEmptyCommentLine());
        }
      } else {
        // Not the first @example tag, add blank line before this one
        parts.push(hardline);
        parts.push(createEmptyCommentLine());
      }

      parts.push(hardline);
      parts.push(await formatOtherTag(tag, options));
    }
  }

  // Closing */
  parts.push(hardline);
  parts.push(' */');

  return group(parts);
}

/**
 * Format other tags like `@example`, `@see`, etc.
 */
async function formatOtherTag(
  tag: any,
  options: ParserOptions<any>
): Promise<any> {
  const tagName = tag.tagName.startsWith('@') ? tag.tagName : `@${tag.tagName}`;
  const content = tag.content.trim();

  if (!content) {
    return createCommentLine(tagName);
  }

  // For @example tags, handle embedded code blocks specially
  if (tagName === '@example') {
    return formatExampleTag(tag, options);
  }

  // For other tags, format content with text wrapping
  return createCommentLine([tagName, ' ', formatTextContent(content)]);
}

/**
 * Format @example tags with potential embedded code blocks
 *
 * The `preserveExampleNewline` option controls whether content after @example
 * on a new line should be kept separate or pulled up to the same line:
 * - When `true` (default): Content on a new line stays on a new line
 * - When `false` (legacy): First line of content is pulled up to @example line
 *
 * This distinction matters because TypeDoc and other renderers treat text on
 * the same line as @example as a "title", while content on new lines is treated
 * as the example body.
 */
async function formatExampleTag(
  tag: any,
  options: ParserOptions<any>
): Promise<any> {
  const content = tag.content.trim();
  const resolvedOptions = resolveOptions(options);
  const preserveNewline = resolvedOptions.preserveExampleNewline;

  if (!content) {
    return createCommentLine('@example');
  }

  const parts: any[] = [];
  const lines = content.split('\n');
  const firstLine = lines[0].trim();

  // Check if the first line should be treated as a title (on same line as @example)
  // This happens when:
  // 1. preserveExampleNewline is false (legacy behavior), OR
  // 2. The content was originally on the same line as @example in the source
  //    (indicated by tag.titleOnSameLine if available, otherwise we check
  //    if there's no leading newline in the raw content)
  const hasContentOnSameLine = tag.titleOnSameLine === true;

  if (firstLine && !firstLine.startsWith('```')) {
    // There is text content (not starting with a code fence)
    if (!preserveNewline || hasContentOnSameLine) {
      // Legacy behavior or title was originally on same line: pull first line up
      parts.push(createCommentLine(['@example ', firstLine]));
      // Format the rest as markdown if there's more content
      const remainingContent = lines.slice(1).join('\n').trim();
      if (remainingContent) {
        const formattedContent = await formatExampleWithMarkdown(
          remainingContent,
          options
        );
        if (Array.isArray(formattedContent)) {
          parts.push(...formattedContent);
        } else {
          parts.push(formattedContent);
        }
      }
    } else {
      // New behavior: preserve the newline, keep @example on its own line
      parts.push(createCommentLine('@example'));
      const formattedContent = await formatExampleWithMarkdown(
        content,
        options
      );
      if (Array.isArray(formattedContent)) {
        parts.push(...formattedContent);
      } else {
        parts.push(formattedContent);
      }
    }
  } else {
    // Content starts with a code fence or is empty, keep @example on its own line
    parts.push(createCommentLine('@example'));
    const formattedContent = await formatExampleWithMarkdown(content, options);
    if (Array.isArray(formattedContent)) {
      parts.push(...formattedContent);
    } else {
      parts.push(formattedContent);
    }
  }

  return parts;
}

/**
 * Appends a list item to the target array with proper formatting.
 *
 * @param target - Target array to append formatted lines to
 * @param listItem - List item object containing marker and lines
 */
function appendListItem(target: any[], listItem: any): void {
  target.push(createCommentLine(`${listItem.marker} ${listItem.lines[0]}`));
  for (let i = 1; i < listItem.lines.length; i++) {
    target.push(hardline);
    target.push(` *   ${listItem.lines[i]}`);
  }
}

/**
 * Appends a code fence line to the target array.
 *
 * @param target - Target array to append formatted line to
 * @param codeFenceLine - Code fence line object containing content
 */
function appendCodeFenceLine(target: any[], codeFenceLine: any): void {
  target.push(createCommentLine(codeFenceLine.content));
}

/**
 * Appends string lines to the target array with nested line splitting.
 *
 * @param target - Target array to append formatted lines to
 * @param line - String line to process
 */
function appendStringLines(target: any[], line: string): void {
  const lines = line.split('\n');
  lines.forEach((singleLine, lineIndex) => {
    if (singleLine.trim()) {
      const subLines = singleLine.split('\n');
      subLines.forEach((subLine, subIndex) => {
        if (subLine.trim()) {
          target.push(createCommentLine(subLine));
          if (subIndex < subLines.length - 1) {
            target.push(hardline);
          }
        }
      });
      if (lineIndex < lines.length - 1) {
        target.push(hardline);
      }
    }
  });
}

/**
 * Processes a single line from markdown content and appends it to the target array.
 *
 * @param target - Target array to append formatted content to
 * @param line - Line to process (can be object or string)
 */
function appendSingleLine(target: any[], line: any): void {
  if (typeof line === 'object' && line.type === 'list-item') {
    appendListItem(target, line);
  } else if (
    typeof line === 'object' &&
    (line.type === 'code-fence-start' ||
      line.type === 'code-fence-end' ||
      line.type === 'code-line')
  ) {
    appendCodeFenceLine(target, line);
  } else if (typeof line === 'string' && line.trim()) {
    appendStringLines(target, line);
  } else if (line === '') {
    target.push(createEmptyCommentLine());
  }
}

/**
 * Appends markdown segments to the target array with proper formatting.
 *
 * Handles arrays of markdown content (strings, list items, code blocks) and
 * formats them with appropriate comment line markers and separators.
 *
 * @param target - Target array to append formatted content to
 * @param content - Markdown content to append (array or single value)
 */
function appendMarkdownSegments(target: any[], content: any): void {
  if (!content) {
    return;
  }

  if (Array.isArray(content)) {
    content.forEach((line: any, index: number) => {
      if (index > 0) {
        target.push(hardline);
      }
      appendSingleLine(target, line);
    });
  } else {
    target.push(createCommentLine(content));
  }
}

/**
 * Format @example content using enhanced code block formatting
 */
async function formatExampleWithMarkdown(
  content: string,
  options: ParserOptions<any>
): Promise<any> {
  const tsdocOptions = resolveOptions(options);
  const embeddedPreference = tsdocOptions.embeddedLanguageFormatting;

  const parts: any[] = [];

  // Split content into lines and process each part
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];
  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockLanguage = trimmedLine.slice(3).trim() || 'text';
        codeBlockLines = [];
        parts.push(hardline);
        parts.push(createCommentLine(trimmedLine));
      } else {
        // Ending a code block - format the collected code
        inCodeBlock = false;

        // Format the code block content using Prettier for supported languages
        if (codeBlockLines.length > 0) {
          const codeContent = codeBlockLines.join('\n');
          try {
            const formattedCode = await formatCodeBlock(
              codeContent,
              codeBlockLanguage,
              options,
              embeddedPreference
            );

            // Add the formatted code lines
            const formattedLines = formattedCode.split('\n');
            for (const codeLine of formattedLines) {
              parts.push(hardline);
              parts.push(createCommentLine(codeLine));
            }
          } catch (error) {
            // Fallback to original code if formatting fails
            if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
              debugLog('Code formatting failed:', error);
            }
            for (const codeLine of codeBlockLines) {
              parts.push(hardline);
              parts.push(createCommentLine(codeLine));
            }
          }
        }

        // Add closing code fence
        parts.push(hardline);
        parts.push(createCommentLine(trimmedLine));
      }
    } else if (inCodeBlock) {
      // Inside a code block - collect the line
      codeBlockLines.push(line);
    } else {
      // Regular content outside code blocks
      if (trimmedLine) {
        parts.push(hardline);
        parts.push(createCommentLine(line));
      } else {
        parts.push(hardline);
        parts.push(createEmptyCommentLine());
      }
    }
  }

  return parts;
}

/**
 * Format code block using Prettier with appropriate parser for the language.
 * Falls back to lightweight trimming if the language isn't supported or
 * Prettier throws.
 */
async function formatCodeBlock(
  code: string,
  language: string,
  options: ParserOptions<any>,
  embeddedPreference: 'auto' | 'off'
): Promise<string> {
  // Clean up code and use as fallback
  const fallback = cleanupCodeSnippet(code);

  // For empty or whitespace-only code, return empty string without formatting
  if (fallback === '') {
    return '';
  }

  if (embeddedPreference === 'off') {
    return fallback;
  }

  try {
    const formatted = await formatEmbeddedCode({
      code,
      language,
      parentOptions: options,
      embeddedLanguageFormatting: embeddedPreference,
    });
    return formatted || fallback;
  } catch (error) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        `Embedded formatter failed for language "${language}":`,
        error instanceof Error ? error.message : String(error)
      );
    }
    return fallback;
  }
}

function cleanupCodeSnippet(code: string): string {
  return code.trim().replace(/\s+$/gm, '');
}

/**
 * Extract the raw comment content from a comment node, stripping delimiters.
 */
export function extractCommentContent(commentValue: string): string {
  // Remove leading/trailing whitespace and handle the star prefixes
  const lines = commentValue.split('\n');
  const cleanedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove leading comment asterisk ONLY when followed by whitespace or end of line.
    // Using lookahead (?=\s|$) ensures we don't strip the first * from markdown bold syntax like **text**
    line = line.replace(/^\s*\*(?=\s|$)\s?/, '');

    // For the first line, it might not have leading *
    if (i === 0) {
      line = line.replace(/^\s*/, '');
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').trim();
}
