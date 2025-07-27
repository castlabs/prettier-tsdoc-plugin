/**
 * TSDoc comment formatting logic.
 *
 * This module contains the core formatting implementation for TSDoc comments.
 */

import type { ParserOptions, Doc } from 'prettier';
import { doc, format } from 'prettier';
import type { TSDocParser, ParserContext } from '@microsoft/tsdoc';
import type { TSDocCommentModel } from './models.js';
import { buildCommentModel } from './models.js';
import {
  effectiveWidth,
  formatTextContent,
  createCommentLine,
  createEmptyCommentLine,
  wrapText,
} from './utils/text-width.js';
import { printAligned, formatReturnsTag, ParamTagInfo } from './utils/tags.js';
import {
  extractMarkdownSections,
  formatMarkdown,
  formatFencedCode,
  applyFencedIndent,
  stripCommentMarks,
  formatMarkdownBlock,
  addCommentMarks,
  extractIndentation,
  isMarkdownCapableTag,
  preserveInlineTags,
  restoreInlineTags,
} from './utils/markdown.js';
import {
  resolveOptions,
  normalizeTagName,
  isReleaseTag,
  isModifierTag,
  type TSDocPluginOptions,
} from './config.js';

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
const { join, line, hardline, group } = builders;

/**
 * Format a TSDoc comment from raw comment text.
 *
 * @param commentValue - The comment content (without delimiters)
 * @param options - Prettier formatting options
 * @param parser - TSDoc parser instance
 * @returns Formatted comment as Prettier Doc
 */
export function formatTSDocComment(
  commentValue: string,
  options: ParserOptions<any>,
  parser: TSDocParser
): Doc {
  const startTime = performance.now();

  try {
    // Resolve TSDoc-specific options
    const tsdocOptions = resolveOptions(options);

    // Parse the comment
    const fullComment = `/**${commentValue}*/`;
    const parserContext = parser.parseString(fullComment);

    // Check for parse errors
    if (parserContext.log.messages.length > 0) {
      telemetry.parseErrors++;

      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        const logger = (options as any).logger;
        if (logger?.warn) {
          logger.warn(
            'TSDoc parse warnings:',
            parserContext.log.messages.map((m) => m.text)
          );
        }
      }
    }

    // Build intermediate model
    const model = buildCommentModel(parserContext.docComment, fullComment);

    // Apply normalizations and transformations
    const normalizedModel = applyNormalizations(model, tsdocOptions);

    // Convert model to Prettier Doc
    const result = buildPrettierDoc(normalizedModel, options, parserContext, tsdocOptions);

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
  options: TSDocPluginOptions
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

  // Apply release tag deduplication
  if (options.dedupeReleaseTags) {
    normalizedModel.otherTags = deduplicateReleaseTags(
      normalizedModel.otherTags,
      options.releaseTagStrategy || 'keep-first'
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
 * Format text content with improved markdown support.
 * Note: Full async Prettier formatting would require architectural changes,
 * so we use enhanced text processing for now.
 */
function formatTextWithMarkdown(
  text: string,
  options: ParserOptions<any>,
  originalIndentation: string = ''
): any {
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
        logger.warn('formatTextWithMarkdown cleanText:', JSON.stringify(cleanText));
      }
    }
    
    // Apply enhanced markdown-aware text formatting
    const formatted = formatMarkdownText(cleanText, options);
    
    
    return formatted;
    
  } catch (error) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      const logger = (options as any).logger;
      if (logger?.warn) {
        logger.warn('Markdown formatting failed, falling back to basic formatting:', error instanceof Error ? error.message : String(error));
      }
    }
    
    // Fallback to the original text formatting
    return formatTextContent(text, options);
  }
}

/**
 * Enhanced markdown text formatting with proper list handling and line wrapping
 */
function formatMarkdownText(text: string, options: ParserOptions<any>): any {
  if (!text.trim()) {
    return null;
  }
  
  // Preserve inline tags to prevent them from being split during text wrapping
  const { text: textWithTokens, tokens } = preserveInlineTags(text);
  
  // Split text into lines to process properly
  const lines = textWithTokens.split('\n');
  const result: any[] = [];
  let currentParagraph: string[] = [];
  let lastWasListItem = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      // Empty line - end current paragraph if any
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        const wrapped = wrapTextToString(paragraphText, options);
        result.push(wrapped);
        currentParagraph = [];
        
        // Add empty string to represent paragraph break (will become empty comment line)
        result.push('');
      }
      lastWasListItem = false;
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
            i = j; // Skip this line in the main loop
            j++;
          }
        }
        
        // Join all content and wrap
        const fullContent = listContent.join(' ');
        const wrappedLines = wrapListItemContent(fullContent, options);
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          console.debug('List item wrapped lines:', JSON.stringify(wrappedLines));
        }
        result.push({
          type: 'list-item',
          marker,
          lines: wrappedLines
        });
      }
      lastWasListItem = true;
    } else {
      // Regular text line - add to current paragraph
      currentParagraph.push(line);
      lastWasListItem = false;
    }
  }
  
  // Handle remaining paragraph
  if (currentParagraph.length > 0) {
    const paragraphText = currentParagraph.join(' ');
    const wrapped = wrapTextToString(paragraphText, options);
    result.push(wrapped);
  }
  
  // Restore inline tags in the final result
  const finalResult = result.length > 0 ? result : [wrapTextToString(textWithTokens, options)];
  
  return finalResult.map((item: any) => {
    if (typeof item === 'string') {
      return restoreInlineTags(item, tokens);
    } else if (item && typeof item === 'object' && item.type === 'list-item') {
      // Restore inline tags in list item lines
      return {
        ...item,
        lines: item.lines.map((line: string) => restoreInlineTags(line, tokens))
      };
    }
    return item;
  });
}

/**
 * Wrap text to string format for comment content
 */
function wrapTextToString(text: string, options: ParserOptions<any>): string {
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3; // Account for "* "
  
  if (text.length <= availableWidth) {
    return text;
  }
  
  // Simple word wrapping
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
 * Wrap list item content into an array of lines
 */
function wrapListItemContent(text: string, options: ParserOptions<any>): string[] {
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
 * Wrap text for list items with proper continuation indentation (legacy)
 */
function wrapTextForList(text: string, options: ParserOptions<any>, baseIndent: number): string {
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3 - baseIndent; // Account for "* " and base indentation
  
  if (text.length <= availableWidth) {
    return text;
  }
  
  // Simple word wrapping for list items
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
  
  return lines.join('\n' + ' '.repeat(baseIndent + 2)); // Continuation indent
}

/**
 * Convert the intermediate model to a Prettier Doc structure.
 */
function buildPrettierDoc(
  model: TSDocCommentModel,
  options: ParserOptions<any>,
  parserContext?: any,
  tsdocOptions?: TSDocPluginOptions
): Doc {
  const parts: any[] = [];
  const width = effectiveWidth(options);

  // Opening /**
  parts.push('/**');

  // Summary section
  if (model.summary) {
    // Debug: log the raw summary content
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.debug('Summary content:', JSON.stringify(model.summary.content));
    }
    
    const summaryContent = formatTextWithMarkdown(
      model.summary.content,
      options
    );
    if (summaryContent) {
      parts.push(hardline);
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        console.debug('Summary content array:', JSON.stringify(summaryContent));
      }
      if (Array.isArray(summaryContent)) {
        // Handle array of lines/content
        summaryContent.forEach((line, index) => {
          // Add hardline before each element except the first one to ensure proper line separation
          if (index > 0) {
            parts.push(hardline);
          }
          
          if (typeof line === 'object' && line.type === 'list-item') {
            // Handle list items with proper continuation indentation
            const listItem = line as any;
            // First line with marker
            parts.push(createCommentLine(`${listItem.marker} ${listItem.lines[0]}`));
            // Continuation lines with proper indentation - align with the content after the marker
            for (let i = 1; i < listItem.lines.length; i++) {
              parts.push(hardline);
              parts.push(` *   ${listItem.lines[i]}`); // Space, asterisk, 3 spaces to align with content after "- "
            }
            // List item is complete - no additional hardline needed as it's handled globally
          } else if (typeof line === 'string' && line.trim()) {
            // Split multi-line strings into individual lines
            const lines = line.split('\n');
            lines.forEach((singleLine, lineIndex) => {
              if (singleLine.trim()) {
                // Handle embedded newlines in the line (from text wrapping)
                const subLines = singleLine.split('\n');
                subLines.forEach((subLine, subIndex) => {
                  if (subLine.trim()) {
                    parts.push(createCommentLine(subLine));
                    // Add hardline after each subline except the last one
                    if (subIndex < subLines.length - 1) {
                      parts.push(hardline);
                    }
                  }
                });
                // Add hardline after each line except the last one within this element
                if (lineIndex < lines.length - 1) {
                  parts.push(hardline);
                }
              }
            });
          } else if (line === '') {
            // Empty string represents paragraph break - add empty comment line for spacing
            parts.push(createEmptyCommentLine());
          }
        });
      } else {
        parts.push(createCommentLine(summaryContent));
      }
    }
  }

  // Check if we need blank line before next section
  const hasContent = model.summary || model.remarks;
  const hasParamLikeTags =
    model.params.length > 0 || model.typeParams.length > 0 || model.returns;

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
    parts.push(hardline);
    parts.push(
      createCommentLine(formatTextWithMarkdown(model.remarks.content, options))
    );
  }

  // Blank line before parameters (if we have content above and param tags below)
  if (hasContent && hasParamLikeTags) {
    parts.push(hardline);
    parts.push(createEmptyCommentLine());
  }

  // @param tags
  if (model.params.length > 0) {
    if (!hasContent) {
      parts.push(hardline);
    }
    const paramTags: ParamTagInfo[] = model.params.map((p) => ({
      tagName: p.tagName,
      name: p.name,
      description: p.description,
      rawNode: p.rawNode,
    }));
    const alignedParams = printAligned(paramTags, width, tsdocOptions?.alignParamTags ?? false);
    for (const paramLine of alignedParams) {
      parts.push(hardline);
      parts.push(paramLine);
    }
  }

  // @typeParam tags
  if (model.typeParams.length > 0) {
    if (!hasContent && model.params.length === 0) {
      parts.push(hardline);
    }
    const typeParamTags: ParamTagInfo[] = model.typeParams.map((tp) => ({
      tagName: tp.tagName,
      name: tp.name,
      description: tp.description,
      rawNode: tp.rawNode,
    }));
    const alignedTypeParams = printAligned(typeParamTags, width, tsdocOptions?.alignParamTags ?? false);
    for (const typeParamLine of alignedTypeParams) {
      parts.push(hardline);
      parts.push(typeParamLine);
    }
  }

  // @returns tag
  if (model.returns) {
    if (
      !hasContent &&
      model.params.length === 0 &&
      model.typeParams.length === 0
    ) {
      parts.push(hardline);
    }
    parts.push(hardline);
    parts.push(formatReturnsTag(model.returns));
  }

  // Other tags (like @example, @see, etc.)
  if (model.otherTags.length > 0) {
    const needsLineBeforeOtherTags = hasContent || hasParamLikeTags || model.returns;
    
    for (const tag of model.otherTags) {
      if (needsLineBeforeOtherTags) {
        parts.push(hardline);
        parts.push(createEmptyCommentLine());
      }
      parts.push(hardline);
      parts.push(formatOtherTag(tag, options));
    }
  }

  // Closing */
  parts.push(hardline);
  parts.push(' */');

  return group(parts);
}

/**
 * Format other tags like @example, @see, etc.
 */
function formatOtherTag(tag: any, options: ParserOptions<any>): any {
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
 */
function formatExampleTag(tag: any, options: ParserOptions<any>): any {
  const content = tag.content.trim();
  
  if (!content) {
    return createCommentLine('@example');
  }

  // Use Prettier's markdown formatter for all @example content
  return formatExampleWithMarkdown(content, options);
}

/**
 * Format @example content using enhanced code block formatting
 */
function formatExampleWithMarkdown(content: string, options: ParserOptions<any>): any {
  const parts: any[] = [];
  
  // Split content into lines and process each part
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];
  let firstTextLine = true;
  
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
            const formattedCode = formatCodeBlock(codeContent, codeBlockLanguage, options);
            
            // Add the formatted code lines
            const formattedLines = formattedCode.split('\n');
            for (const codeLine of formattedLines) {
              parts.push(hardline);
              parts.push(createCommentLine(codeLine));
            }
          } catch (error) {
            // Fallback to original code if formatting fails
            if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
              console.debug('Code formatting failed:', error);
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
        if (firstTextLine) {
          // First text line goes on same line as @example
          parts.push(createCommentLine(`@example ${line}`));
          firstTextLine = false;
        } else {
          parts.push(hardline);
          parts.push(createCommentLine(line));
        }
      } else {
        parts.push(hardline);
        parts.push(createEmptyCommentLine());
      }
    }
  }
  
  return parts;
}

/**
 * Fallback @example formatting when Prettier markdown fails
 */
function formatExampleFallback(content: string): any {
  const parts: any[] = [];
  parts.push(createCommentLine('@example'));
  
  const lines = content.split('\n');
  for (const line of lines) {
    parts.push(hardline);
    if (line.trim()) {
      parts.push(createCommentLine(line));
    } else {
      parts.push(createEmptyCommentLine());
    }
  }
  
  return parts;
}

/**
 * Map language identifiers to Prettier parser names
 */
const LANGUAGE_TO_PARSER: Record<string, string> = {
  // TypeScript/JavaScript
  'typescript': 'typescript',
  'ts': 'typescript', 
  'javascript': 'babel',
  'js': 'babel',
  'jsx': 'babel',
  'tsx': 'typescript',
  
  // Web technologies
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  
  // Data formats
  'json': 'json',
  'json5': 'json5',
  'yaml': 'yaml',
  'yml': 'yaml',
  
  // Other
  'markdown': 'markdown',
  'md': 'markdown',
  'graphql': 'graphql',
};

/**
 * Format code block using Prettier with appropriate parser for the language
 */
function formatCodeBlock(code: string, language: string, options: ParserOptions<any>): string {
  if (!code.trim()) {
    return code;
  }
  
  const parser = LANGUAGE_TO_PARSER[language.toLowerCase()];
  
  if (!parser) {
    // For unsupported languages, return as-is but with basic whitespace cleanup
    return code.trim();
  }
  
  // Since Prettier's format functions are async and we're in a sync context,
  // we use enhanced basic formatting for now
  // TODO: In the future, consider restructuring to support async formatting
  
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    console.debug(`Formatting ${language} code with basic formatter:`, JSON.stringify(code.substring(0, 50)));
  }
  
  const formatted = formatCodeBasic(code, language);
  
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    console.debug(`Formatted ${language} code result:`, JSON.stringify(formatted.substring(0, 50)));
  }
  
  return formatted;
}

/**
 * Basic code formatting fallback for when Prettier fails
 */
function formatCodeBasic(code: string, language: string): string {
  let formatted = code.trim();
  
  // Basic whitespace normalization for all languages
  formatted = formatted.replace(/\s+$/gm, ''); // Remove trailing whitespace from lines
  
  // Language-specific basic formatting
  if (['typescript', 'ts', 'javascript', 'js', 'jsx', 'tsx'].includes(language)) {
    // JavaScript/TypeScript basic formatting
    formatted = formatted.replace(/\(\s+\)/g, '()'); // Fix function call spacing
    formatted = formatted.replace(/\s*=\s*/g, ' = '); // Fix assignment spacing
    formatted = formatted.replace(/\s*;\s*$/gm, ';'); // Fix semicolon spacing
  } else if (language === 'html') {
    // HTML basic formatting - add proper indentation and line breaks
    formatted = formatHtmlBasic(formatted);
  }
  
  return formatted;
}

/**
 * Basic HTML formatting with proper indentation and line breaks
 */
function formatHtmlBasic(html: string): string {
  // Remove all existing whitespace between tags
  let formatted = html.replace(/>\s+</g, '><').trim();
  
  // Add line breaks and indentation
  const indent = '  '; // 2 spaces
  let level = 0;
  let result = '';
  let i = 0;
  
  while (i < formatted.length) {
    if (formatted[i] === '<') {
      const tagEnd = formatted.indexOf('>', i);
      if (tagEnd === -1) break;
      
      const tag = formatted.slice(i, tagEnd + 1);
      const isClosingTag = tag.startsWith('</');
      const isSelfClosing = tag.endsWith('/>') || 
                           ['<br>', '<hr>', '<img', '<input', '<meta', '<link'].some(t => tag.startsWith(t));
      
      if (isClosingTag) {
        level--;
      }
      
      // Add indentation
      if (result && !result.endsWith('\n')) {
        result += '\n';
      }
      result += indent.repeat(Math.max(0, level)) + tag;
      
      if (!isClosingTag && !isSelfClosing) {
        level++;
      }
      
      i = tagEnd + 1;
    } else {
      // Text content between tags
      const nextTag = formatted.indexOf('<', i);
      const textContent = formatted.slice(i, nextTag === -1 ? formatted.length : nextTag).trim();
      
      if (textContent) {
        if (result && !result.endsWith('\n')) {
          result += '\n';
        }
        result += indent.repeat(level) + textContent;
      }
      
      i = nextTag === -1 ? formatted.length : nextTag;
    }
  }
  
  return result;
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

    // Remove leading asterisk and whitespace
    line = line.replace(/^\s*\*\s?/, '');

    // For the first line, it might not have leading *
    if (i === 0) {
      line = line.replace(/^\s*/, '');
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').trim();
}
