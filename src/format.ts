/**
 * TSDoc comment formatting logic.
 * 
 * This module contains the core formatting implementation for TSDoc comments.
 */

import type { ParserOptions, Doc } from 'prettier';
import { doc } from 'prettier';
import type { TSDocParser, ParserContext } from '@microsoft/tsdoc';
import type { TSDocCommentModel } from './models.js';
import { buildCommentModel } from './models.js';
import { effectiveWidth, formatTextContent, createCommentLine, createEmptyCommentLine } from './utils/text-width.js';
import { printAligned, formatReturnsTag, ParamTagInfo } from './utils/tags.js';
import { extractMarkdownSections, formatMarkdown, formatFencedCode, applyFencedIndent } from './utils/markdown.js';
import { resolveOptions, normalizeTagName, isReleaseTag, isModifierTag, type TSDocPluginOptions } from './config.js';

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
  // Resolve TSDoc-specific options
  const tsdocOptions = resolveOptions(options);
  
  // Parse the comment
  const fullComment = `/**${commentValue}*/`;
  const parserContext = parser.parseString(fullComment);
  
  // Build intermediate model
  const model = buildCommentModel(parserContext.docComment);
  
  // Apply normalizations and transformations
  const normalizedModel = applyNormalizations(model, tsdocOptions);
  
  // Convert model to Prettier Doc
  return buildPrettierDoc(normalizedModel, options, parserContext);
}

/**
 * Apply normalizations and transformations to the comment model.
 */
function applyNormalizations(model: TSDocCommentModel, options: TSDocPluginOptions): TSDocCommentModel {
  const normalizedModel: TSDocCommentModel = {
    ...model,
    params: [...model.params],
    typeParams: [...model.typeParams],
    otherTags: [...model.otherTags],
  };
  
  // Apply tag name normalizations to all tag sections
  normalizedModel.params = normalizedModel.params.map(param => ({
    ...param,
    tagName: normalizeTagName(param.tagName, options),
  }));
  
  normalizedModel.typeParams = normalizedModel.typeParams.map(typeParam => ({
    ...typeParam,
    tagName: normalizeTagName(typeParam.tagName, options),
  }));
  
  if (normalizedModel.returns) {
    normalizedModel.returns = {
      ...normalizedModel.returns,
      tagName: normalizeTagName(normalizedModel.returns.tagName, options),
    };
  }
  
  normalizedModel.otherTags = normalizedModel.otherTags.map(tag => ({
    ...tag,
    tagName: normalizeTagName(tag.tagName, options),
  }));
  
  // Apply release tag deduplication
  if (options.dedupeReleaseTags) {
    normalizedModel.otherTags = deduplicateReleaseTags(normalizedModel.otherTags, options.releaseTagStrategy || 'keep-first');
  }
  
  return normalizedModel;
}

/**
 * Deduplicate release tags based on the configured strategy.
 */
function deduplicateReleaseTags(tags: any[], strategy: 'keep-first' | 'keep-last'): any[] {
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
 * Format text content with markdown and fenced code support.
 */
function formatTextWithMarkdown(text: string, options: ParserOptions<any>): any {
  if (!text.trim()) {
    return null;
  }
  
  const config = resolveOptions(options);
  const sections = extractMarkdownSections(text);
  
  if (sections.length <= 1 && sections[0]?.type === 'markdown') {
    // Simple text without fenced code blocks
    return formatTextContent(text, options);
  }
  
  // Complex content with fenced code blocks
  const result: any[] = [];
  
  for (const section of sections) {
    if (section.type === 'markdown') {
      const formatted = formatMarkdown(section.content, options);
      result.push(formatTextContent(formatted, options));
    } else if (section.type === 'fenced-code') {
      // Format the fenced code block
      const formatted = formatFencedCode(section.content, section.language || 'text', options);
      const indented = applyFencedIndent(formatted, config.fencedIndent);
      
      // Add fenced code block markers
      result.push('```' + (section.language || ''));
      result.push(hardline);
      
      // Add each line of code
      const codeLines = indented.split('\n');
      for (const codeLine of codeLines) {
        result.push(createCommentLine(codeLine));
        result.push(hardline);
      }
      
      result.push(createCommentLine('```'));
    }
  }
  
  return result.length > 0 ? result : formatTextContent(text, options);
}

/**
 * Convert the intermediate model to a Prettier Doc structure.
 */
function buildPrettierDoc(model: TSDocCommentModel, options: ParserOptions<any>, parserContext?: any): Doc {
  const parts: any[] = [];
  const width = effectiveWidth(options);
  
  // Opening /**
  parts.push('/**');
  
  // Summary section
  if (model.summary) {
    const summaryContent = formatTextWithMarkdown(model.summary.content, options);
    if (summaryContent) {
      parts.push(hardline);
      parts.push(createCommentLine(summaryContent));
    }
  }
  
  // Check if we need blank line before next section
  const hasContent = model.summary || model.remarks;
  const hasParamLikeTags = model.params.length > 0 || model.typeParams.length > 0 || model.returns;
  
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
    parts.push(createCommentLine(formatTextWithMarkdown(model.remarks.content, options)));
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
    const paramTags: ParamTagInfo[] = model.params.map(p => ({
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
    const typeParamTags: ParamTagInfo[] = model.typeParams.map(tp => ({
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
    if (!hasContent && model.params.length === 0 && model.typeParams.length === 0) {
      parts.push(hardline);
    }
    parts.push(hardline);
    parts.push(formatReturnsTag(model.returns));
  }
  
  // Closing */
  parts.push(hardline);
  parts.push(' */');
  
  return group(parts);
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