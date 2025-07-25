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
    const result = buildPrettierDoc(normalizedModel, options, parserContext);

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
      console.log('formatTextWithMarkdown input:', JSON.stringify(text));
      console.log('formatTextWithMarkdown cleanText:', JSON.stringify(cleanText));
    }
    
    // Apply enhanced markdown-aware text formatting
    const formatted = formatMarkdownText(cleanText, options);
    
    
    return formatted;
    
  } catch (error) {
    console.warn('Markdown formatting failed, falling back to basic formatting:', error instanceof Error ? error.message : String(error));
    
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
  
  // Split text into lines to process properly
  const lines = text.split('\n');
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
          console.log('List item wrapped lines:', JSON.stringify(wrappedLines));
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
  
  return result.length > 0 ? result : wrapTextToString(text, options);
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
  parserContext?: any
): Doc {
  const parts: any[] = [];
  const width = effectiveWidth(options);

  // Opening /**
  parts.push('/**');

  // Summary section
  if (model.summary) {
    // Debug: log the raw summary content
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.log('Summary content:', JSON.stringify(model.summary.content));
    }
    
    const summaryContent = formatTextWithMarkdown(
      model.summary.content,
      options
    );
    if (summaryContent) {
      parts.push(hardline);
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        console.log('Summary content array:', JSON.stringify(summaryContent));
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
    const alignedParams = printAligned(paramTags, width);
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
    const alignedTypeParams = printAligned(typeParamTags, width);
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
      parts.push(formatOtherTag(tag));
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
function formatOtherTag(tag: any): any {
  const tagName = tag.tagName.startsWith('@') ? tag.tagName : `@${tag.tagName}`;
  const content = tag.content.trim();

  if (!content) {
    return createCommentLine(tagName);
  }

  // For @example tags, handle embedded code blocks specially
  if (tagName === '@example') {
    return formatExampleTag(tag);
  }

  // For other tags, format content with text wrapping
  return createCommentLine([tagName, ' ', formatTextContent(content)]);
}

/**
 * Format @example tags with potential embedded code blocks
 */
function formatExampleTag(tag: any): any {
  const content = tag.content.trim();
  
  if (!content) {
    return createCommentLine('@example');
  }

  // Use Prettier's markdown formatter for all @example content
  return formatExampleWithMarkdown(content);
}

/**
 * Format @example content using enhanced code block formatting
 */
function formatExampleWithMarkdown(content: string): any {
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
        
        // Format the code block content using Prettier if it's a supported language
        if (codeBlockLines.length > 0) {
          const codeContent = codeBlockLines.join('\n');
          try {
            let formattedCode = codeContent;
            
            // Format TypeScript/JavaScript code blocks using basic formatting
            if (codeBlockLanguage === 'typescript' || codeBlockLanguage === 'ts' || 
                codeBlockLanguage === 'javascript' || codeBlockLanguage === 'js') {
              formattedCode = formatTypeScriptCode(codeContent);
            }
            
            // Add the formatted code lines
            const formattedLines = formattedCode.split('\n');
            for (const codeLine of formattedLines) {
              parts.push(hardline);
              parts.push(createCommentLine(codeLine));
            }
          } catch (error) {
            // Fallback to original code if formatting fails
            if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
              console.warn('Code formatting failed:', error);
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
 * Format TypeScript/JavaScript code with basic formatting rules
 */
function formatTypeScriptCode(code: string): string {
  // Basic TypeScript/JavaScript formatting
  let formatted = code.trim();
  
  // Remove excessive whitespace
  formatted = formatted.replace(/\s+/g, ' ');
  
  // Fix function call spacing: "internal(  )" -> "internal()"
  formatted = formatted.replace(/\(\s+\)/g, '()');
  
  // Fix spacing around operators
  formatted = formatted.replace(/\s*=\s*/g, ' = ');
  formatted = formatted.replace(/\s*;\s*/g, ';');
  
  // Add semicolons to statements that need them
  if (!formatted.endsWith(';') && !formatted.endsWith('}') && formatted.trim()) {
    formatted = formatted + ';';
  }
  
  // Add proper line breaks for statements
  formatted = formatted.replace(/;/g, ';\n');
  
  // Clean up any trailing newlines or extra spaces
  formatted = formatted.trim();
  
  return formatted;
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
