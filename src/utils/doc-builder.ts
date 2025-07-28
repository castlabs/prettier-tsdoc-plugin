/**
 * Utility functions for building Prettier Doc objects from TSDoc models
 * Decomposed from the large buildPrettierDoc function for better maintainability
 */

import type { Doc, ParserOptions } from 'prettier';
import { doc } from 'prettier';
import type {
  TSDocCommentModel,
  TSDocPluginOptions,
  ParamTag,
  ReturnsTag,
  OtherTag,
} from '../types.js';
import { formatReturnsTag, ParamTagInfo, printAligned } from './tags.js';
import {
  createCommentLine,
  createEmptyCommentLine,
  effectiveWidth,
} from './text-width.js';
import { formatMarkdown } from './markdown.js';
import { isDebugEnabled, debugLog } from './common.js';

const { group, hardline } = doc.builders;

/**
 * Builds the opening comment delimiter
 */
export function buildCommentOpening(): Doc {
  return '/**';
}

/**
 * Builds the closing comment delimiter
 */
export function buildCommentClosing(): Doc {
  return ' */';
}

/**
 * Builds the summary section of a TSDoc comment
 */
export function buildSummarySection(
  summary: { type: 'summary'; content: string } | undefined,
  options: ParserOptions<any>
): Doc[] {
  if (!summary) {
    return [];
  }

  const parts: Doc[] = [];

  debugLog('Summary content:', JSON.stringify(summary.content));

  const summaryContent = formatMarkdown(summary.content, options);
  if (!summaryContent) {
    return parts;
  }

  parts.push(hardline);

  debugLog('Summary content array:', JSON.stringify(summaryContent));

  if (Array.isArray(summaryContent)) {
    summaryContent.forEach((line, index) => {
      if (index > 0) {
        parts.push(hardline);
      }

      parts.push(...buildSummaryLine(line));
    });
  } else {
    parts.push(createCommentLine(summaryContent));
  }

  return parts;
}

/**
 * Builds a single line of summary content
 */
function buildSummaryLine(line: any): Doc[] {
  const parts: Doc[] = [];

  if (typeof line === 'object' && line.type === 'list-item') {
    parts.push(...buildListItem(line));
  } else if (typeof line === 'string' && line.trim()) {
    parts.push(...buildStringLine(line));
  } else if (line === '') {
    parts.push(createEmptyCommentLine());
  }

  return parts;
}

/**
 * Builds a list item with proper indentation
 */
function buildListItem(listItem: any): Doc[] {
  const parts: Doc[] = [];

  // First line with marker
  parts.push(createCommentLine(`${listItem.marker} ${listItem.lines[0]}`));

  // Continuation lines with proper indentation
  for (let i = 1; i < listItem.lines.length; i++) {
    parts.push(hardline);
    parts.push(` *   ${listItem.lines[i]}`); // Space, asterisk, 3 spaces to align with content after "- "
  }

  return parts;
}

/**
 * Builds multiple lines from a string, handling embedded newlines
 */
function buildStringLine(line: string): Doc[] {
  const parts: Doc[] = [];
  const lines = line.split('\n');

  lines.forEach((singleLine, lineIndex) => {
    if (singleLine.trim()) {
      const subLines = singleLine.split('\n');
      subLines.forEach((subLine, subIndex) => {
        if (subLine.trim()) {
          parts.push(createCommentLine(subLine));
          if (subIndex < subLines.length - 1) {
            parts.push(hardline);
          }
        }
      });
      if (lineIndex < lines.length - 1) {
        parts.push(hardline);
      }
    }
  });

  return parts;
}

/**
 * Builds the remarks section of a TSDoc comment
 */
export function buildRemarksSection(
  remarks: { type: 'remarks'; content: string } | undefined,
  options: ParserOptions<any>,
  hasSummary: boolean
): Doc[] {
  if (!remarks) {
    return [];
  }

  const parts: Doc[] = [];

  // Add blank line before remarks if we have both summary and remarks
  if (hasSummary) {
    parts.push(hardline);
    parts.push(createEmptyCommentLine());
  }

  // If no summary but has remarks, add line after opening
  if (!hasSummary) {
    parts.push(hardline);
  }

  parts.push(hardline);
  parts.push(createCommentLine(formatMarkdown(remarks.content, options)));

  return parts;
}

/**
 * Builds parameter tags section (\@param)
 */
export function buildParameterTagsSection(
  params: ParamTag[],
  width: number,
  alignParamTags: boolean,
  hasContentAbove: boolean
): Doc[] {
  if (params.length === 0) {
    return [];
  }

  const parts: Doc[] = [];

  if (!hasContentAbove) {
    parts.push(hardline);
  }

  const paramTags: ParamTagInfo[] = params.map((p) => ({
    tagName: p.tagName,
    name: p.name,
    description: p.description,
    rawNode: p.rawNode,
  }));

  const alignedParams = printAligned(paramTags, width, alignParamTags);

  for (const paramLine of alignedParams) {
    parts.push(hardline);
    parts.push(paramLine);
  }

  return parts;
}

/**
 * Builds type parameter tags section (\@typeParam)
 */
export function buildTypeParameterTagsSection(
  typeParams: ParamTag[],
  width: number,
  alignParamTags: boolean,
  hasContentAbove: boolean,
  hasParamsAbove: boolean
): Doc[] {
  if (typeParams.length === 0) {
    return [];
  }

  const parts: Doc[] = [];

  if (!hasContentAbove && !hasParamsAbove) {
    parts.push(hardline);
  }

  const typeParamTags: ParamTagInfo[] = typeParams.map((tp) => ({
    tagName: tp.tagName,
    name: tp.name,
    description: tp.description,
    rawNode: tp.rawNode,
  }));

  const alignedTypeParams = printAligned(typeParamTags, width, alignParamTags);

  for (const typeParamLine of alignedTypeParams) {
    parts.push(hardline);
    parts.push(typeParamLine);
  }

  return parts;
}

/**
 * Builds returns tag section (\@returns)
 */
export function buildReturnsSection(
  returns: ReturnsTag | undefined,
  hasContentAbove: boolean,
  hasParamLikeTags: boolean
): Doc[] {
  if (!returns) {
    return [];
  }

  const parts: Doc[] = [];

  if (!hasContentAbove && !hasParamLikeTags) {
    parts.push(hardline);
  }

  parts.push(hardline);
  parts.push(formatReturnsTag(returns));

  return parts;
}

/**
 * Builds other tags section (\@example, \@see, etc.)
 */
export function buildOtherTagsSection(
  otherTags: OtherTag[],
  hasContentAbove: boolean,
  hasParamLikeTags: boolean,
  hasReturns: boolean
): Doc[] {
  if (otherTags.length === 0) {
    return [];
  }

  const parts: Doc[] = [];
  const needsLineBeforeOtherTags =
    hasContentAbove || hasParamLikeTags || hasReturns;

  for (const tag of otherTags) {
    if (needsLineBeforeOtherTags) {
      parts.push(hardline);
      parts.push(createEmptyCommentLine());
    }
    parts.push(hardline);
    parts.push(formatOtherTag(tag));
  }

  return parts;
}

/**
 * Formats other tags like \@example, \@see, etc.
 */
function formatOtherTag(tag: OtherTag): Doc {
  const tagName = tag.tagName.startsWith('@') ? tag.tagName : `@${tag.tagName}`;
  const content = tag.content.trim();

  if (!content) {
    return createCommentLine(tagName);
  }

  // Handle multi-line content
  const lines = content.split('\n');
  if (lines.length === 1) {
    return createCommentLine(`${tagName} ${content}`);
  }

  // Multi-line content
  const parts: Doc[] = [];
  parts.push(createCommentLine(tagName));

  for (const line of lines) {
    parts.push(hardline);
    if (line.trim()) {
      parts.push(createCommentLine(line));
    } else {
      parts.push(createEmptyCommentLine());
    }
  }

  return group(parts);
}

/**
 * Adds a blank line separator between sections when needed
 */
export function buildSectionSeparator(condition: boolean): Doc[] {
  if (!condition) {
    return [];
  }

  return [hardline, createEmptyCommentLine()];
}

/**
 * Main function to build a complete Prettier Doc from a TSDoc model
 * Refactored to use smaller, focused functions
 */
export function buildPrettierDoc(
  model: TSDocCommentModel,
  options: ParserOptions<any>,
  tsdocOptions?: TSDocPluginOptions
): Doc {
  const parts: Doc[] = [];
  const width = effectiveWidth(options);
  const alignParamTags = tsdocOptions?.alignParamTags ?? false;

  // Opening delimiter
  parts.push(buildCommentOpening());

  // Summary section
  parts.push(...buildSummarySection(model.summary, options));

  // Check for content and param-like tags
  const hasContent = !!(model.summary || model.remarks);
  const hasParamLikeTags =
    model.params.length > 0 || model.typeParams.length > 0 || !!model.returns;

  // Remarks section
  parts.push(...buildRemarksSection(model.remarks, options, !!model.summary));

  // Blank line before parameters if needed
  parts.push(...buildSectionSeparator(hasContent && hasParamLikeTags));

  // @param tags
  parts.push(
    ...buildParameterTagsSection(
      model.params,
      width,
      alignParamTags,
      hasContent
    )
  );

  // @typeParam tags
  parts.push(
    ...buildTypeParameterTagsSection(
      model.typeParams,
      width,
      alignParamTags,
      hasContent,
      model.params.length > 0
    )
  );

  // @returns tag
  parts.push(
    ...buildReturnsSection(
      model.returns,
      hasContent,
      model.params.length > 0 || model.typeParams.length > 0
    )
  );

  // Other tags
  parts.push(
    ...buildOtherTagsSection(
      model.otherTags,
      hasContent,
      hasParamLikeTags,
      !!model.returns
    )
  );

  // Closing delimiter
  parts.push(hardline);
  parts.push(buildCommentClosing());

  return group(parts);
}

/**
 * Safe version of buildPrettierDoc that handles errors gracefully
 */
export function safeBuildPrettierDoc(
  model: TSDocCommentModel,
  options: ParserOptions<any>,
  tsdocOptions?: TSDocPluginOptions,
  fallback?: Doc
): Doc {
  try {
    return buildPrettierDoc(model, options, tsdocOptions);
  } catch (error) {
    if (isDebugEnabled()) {
      console.warn('[TSDoc Plugin] Error building Prettier doc:', error);
    }

    // Return a simple fallback doc
    return (
      fallback ||
      group([
        buildCommentOpening(),
        hardline,
        createCommentLine('Error formatting comment'),
        hardline,
        buildCommentClosing(),
      ])
    );
  }
}
