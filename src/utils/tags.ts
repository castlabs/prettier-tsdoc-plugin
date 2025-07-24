/**
 * Utilities for formatting and aligning parameter-like tags.
 * Handles @param, @typeParam, @returns alignment and hyphen rules.
 */

import { doc } from 'prettier';
import { extractTextFromNode } from '../models.js';
import { formatTextContent, createCommentLine } from './text-width.js';

const { builders } = doc;
const { fill, line } = builders;

export interface ParamTagInfo {
  tagName: string;
  name: string;
  description: string;
  rawNode: any;
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
      const tagName = tag.tagName.startsWith('@') ? tag.tagName : `@${tag.tagName}`;
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
  effectiveWidth: number
): any[] {
  if (tags.length === 0) return [];

  const maxWidth = computeColumnWidths(tags);
  const result: any[] = [];

  for (const tag of tags) {
    const tagName = tag.tagName.startsWith('@') ? tag.tagName : `@${tag.tagName}`;
    const prefix = `${tagName} ${tag.name}`;

    if (tag.description) {
      // Calculate padding needed for alignment
      const currentWidth = prefix.length;
      const paddingNeeded = Math.max(1, maxWidth - currentWidth - 3); // -3 for " - "
      const padding = ' '.repeat(paddingNeeded);

      // Check if the header would exceed effective width
      if (currentWidth + 3 > effectiveWidth) {
        // Break header and description onto separate lines
        result.push(createCommentLine(`${prefix} -`));
        result.push(
          createCommentLine(`  ${formatTextContent(tag.description)}`)
        );
      } else {
        // Normal aligned format
        const content = [
          prefix,
          padding,
          '- ',
          formatTextContent(tag.description),
        ];
        result.push(createCommentLine(content));
      }
    } else {
      // No description, no hyphen
      result.push(createCommentLine(prefix));
    }
  }

  return result;
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
