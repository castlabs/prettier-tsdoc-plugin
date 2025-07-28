/**
 * Utilities for formatting and aligning parameter-like tags.
 * Handles \@param, \@typeParam, \@returns alignment and hyphen rules.
 */

import { doc } from 'prettier';
import type { DocNode } from '@microsoft/tsdoc';
import { extractTextFromNode } from '../models.js';
import { formatTextContent, createCommentLine } from './text-width.js';

const { builders } = doc;
const { fill: _fill, line: _line } = builders;

export interface ParamTagInfo {
  tagName: string;
  name: string;
  description: string;
  rawNode: DocNode | null;
}

export interface AlignmentGroup {
  tags: ParamTagInfo[];
  maxNameWidth: number;
}

/**
 * Split a parameter-like tag into name and description components.
 */
export function splitParamTag(node: any): { name: string; desc: string } {
  if (!node) {
    return { name: '', desc: '' };
  }

  // Extract the parameter name from the tag
  let name = '';
  let desc = '';

  if (node.parameterName) {
    name = node.parameterName;
  }

  // Extract description from the content
  if (node.content) {
    desc = extractTextFromNode(node.content).trim();
  }

  return { name, desc };
}

/**
 * Compute the maximum column width needed for parameter names in a group.
 */
export function computeColumnWidths(tags: ParamTagInfo[]): number {
  if (tags.length === 0) return 0;

  return Math.max(
    ...tags.map((tag) => {
      const tagName = tag.tagName.startsWith('@')
        ? tag.tagName
        : `@${tag.tagName}`;
      const prefix = `${tagName} ${tag.name}`;
      return prefix.length + (tag.description ? 3 : 0); // +3 for " - "
    })
  );
}

/**
 * Format parameter tags with proper alignment.
 */
export function printAligned(
  tags: ParamTagInfo[],
  effectiveWidth: number,
  alignTags: boolean = true
): any[] {
  if (tags.length === 0) return [];

  const maxWidth = computeColumnWidths(tags);
  const result: any[] = [];

  for (const tag of tags) {
    const tagName = tag.tagName.startsWith('@')
      ? tag.tagName
      : `@${tag.tagName}`;
    const prefix = `${tagName} ${tag.name}`;

    if (tag.description) {
      if (alignTags && tags.length > 1) {
        // Calculate padding needed for alignment
        const currentWidth = prefix.length;
        // Fix: We want to align the "-" characters, so we need to pad to reach the max width
        // The maxWidth already includes the " - " in its calculation, so we subtract the current width
        // and add back 1 for the space before the hyphen
        const targetWidth = maxWidth - 3; // maxWidth includes " - ", so subtract it
        const paddingNeeded = Math.max(1, targetWidth - currentWidth + 1); // +1 for space before hyphen
        const padding = ' '.repeat(paddingNeeded);

        // Check if the header would exceed effective width
        if (currentWidth + paddingNeeded + 2 > effectiveWidth) {
          // Break header and description onto separate lines
          result.push(createCommentLine(`${prefix} -`));
          result.push(
            createCommentLine(`  ${formatTextContent(tag.description)}`)
          );
        } else {
          // Normal aligned format
          // Format description with proper wrapping and continuation indent
          const fullPrefix = `${prefix}${padding}- `;
          const wrappedLines = wrapParamDescription(
            tag.description,
            fullPrefix.length
          );

          // Create the first line with the full prefix
          result.push(
            createCommentLine([prefix, padding, '- ', wrappedLines[0]])
          );

          // Create continuation lines with proper indentation (align with comment content)
          for (let i = 1; i < wrappedLines.length; i++) {
            const continuationIndent = '  '; // 2 spaces to align with comment content
            result.push(
              createCommentLine([continuationIndent, wrappedLines[i]])
            );
          }
        }
      } else {
        // Non-aligned format - each tag is independent
        const padding = ' ';

        // Check if the header would exceed effective width
        if (prefix.length + 3 > effectiveWidth) {
          // Break header and description onto separate lines
          result.push(createCommentLine(`${prefix} -`));
          result.push(
            createCommentLine(`  ${formatTextContent(tag.description)}`)
          );
        } else {
          // Simple non-aligned format
          const fullPrefix = `${prefix}${padding}- `;
          const wrappedLines = wrapParamDescription(
            tag.description,
            fullPrefix.length
          );

          // Create the first line with the full prefix
          result.push(
            createCommentLine([prefix, padding, '- ', wrappedLines[0]])
          );

          // Create continuation lines with proper indentation
          for (let i = 1; i < wrappedLines.length; i++) {
            const continuationIndent = '  '; // 2 spaces to align with comment content
            result.push(
              createCommentLine([continuationIndent, wrappedLines[i]])
            );
          }
        }
      }
    } else {
      // No description, no hyphen
      result.push(createCommentLine(prefix));
    }
  }

  return result;
}

/**
 * Wrap parameter description text into an array of lines
 */
function wrapParamDescription(text: string, prefixLength: number): string[] {
  const printWidth = 80; // Default print width
  const availableWidth = printWidth - 3 - prefixLength; // Account for " * " and prefix

  if (text.length <= availableWidth) {
    return [text];
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

  return lines;
}

/**
 * Format @returns tag (no hyphen, no name).
 */
export function formatReturnsTag(node: any): any {
  const description = extractTextFromNode(node.content || node).trim();

  if (description) {
    return createCommentLine(['@returns ', formatTextContent(description)]);
  } else {
    return createCommentLine('@returns');
  }
}

/**
 * Group consecutive parameter-like tags for alignment.
 */
export function groupParameterTags(tags: ParamTagInfo[]): AlignmentGroup[] {
  if (tags.length === 0) return [];

  const groups: AlignmentGroup[] = [];
  let currentGroup: ParamTagInfo[] = [];
  let lastTagType = '';

  for (const tag of tags) {
    // Group tags of the same type together
    if (tag.tagName === lastTagType || lastTagType === '') {
      currentGroup.push(tag);
      lastTagType = tag.tagName;
    } else {
      // Different tag type, start new group
      if (currentGroup.length > 0) {
        groups.push({
          tags: currentGroup,
          maxNameWidth: computeColumnWidths(currentGroup),
        });
      }
      currentGroup = [tag];
      lastTagType = tag.tagName;
    }
  }

  // Add the last group
  if (currentGroup.length > 0) {
    groups.push({
      tags: currentGroup,
      maxNameWidth: computeColumnWidths(currentGroup),
    });
  }

  return groups;
}
