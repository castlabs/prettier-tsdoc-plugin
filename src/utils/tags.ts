/**
 * Utilities for formatting and aligning parameter-like tags.
 * Handles \@param, \@typeParam, \@returns alignment and hyphen rules.
 */

import { doc } from 'prettier';
import type { DocNode } from '@microsoft/tsdoc';
import type { ParserOptions } from 'prettier';
import { extractTextFromNode } from '../models.js';
import { formatTextContent, createCommentLine } from './text-width.js';
import { preserveInlineTags, restoreInlineTags } from './markdown.js';
import { resolveOptions } from '../config.js';

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
  alignTags: boolean = true,
  options?: Partial<ParserOptions<any>>
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
          // Format description with markdown support
          const formattedContent = options
            ? formatParamDescription(tag.description, options)
            : wrapParamDescription(
                tag.description,
                prefix.length + padding.length + 2
              );

          if (Array.isArray(formattedContent) && formattedContent.length > 0) {
            // Handle the formatted content properly
            const firstItem = formattedContent[0];

            if (typeof firstItem === 'string') {
              // Simple string content
              result.push(
                createCommentLine([prefix, padding, '- ', firstItem])
              );

              // Handle continuation lines
              for (let i = 1; i < formattedContent.length; i++) {
                const item = formattedContent[i];
                if (typeof item === 'string') {
                  if (item === '') {
                    // Empty line for paragraph break
                    result.push(createCommentLine(''));
                  } else {
                    // Regular continuation line
                    const continuationIndent = '  '; // 2 spaces to align with comment content
                    result.push(createCommentLine([continuationIndent, item]));
                  }
                } else if (item && typeof item === 'object') {
                  handleFormattedParameterItem(item, result);
                }
              }
            } else if (firstItem && typeof firstItem === 'object') {
              // First item is a complex object (list, code block, etc.)
              result.push(createCommentLine([prefix, padding, '- ']));
              handleFormattedParameterItem(firstItem, result);

              // Handle remaining items
              for (let i = 1; i < formattedContent.length; i++) {
                const item = formattedContent[i];
                if (typeof item === 'string') {
                  if (item === '') {
                    result.push(createCommentLine(''));
                  } else {
                    const continuationIndent = '  ';
                    result.push(createCommentLine([continuationIndent, item]));
                  }
                } else if (item && typeof item === 'object') {
                  handleFormattedParameterItem(item, result);
                }
              }
            }
          } else {
            // Fallback to legacy behavior
            const wrappedLines = wrapParamDescription(
              tag.description,
              prefix.length + padding.length + 2
            );

            result.push(
              createCommentLine([prefix, padding, '- ', wrappedLines[0]])
            );

            for (let i = 1; i < wrappedLines.length; i++) {
              const continuationIndent = '  ';
              result.push(
                createCommentLine([continuationIndent, wrappedLines[i]])
              );
            }
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
          // Simple non-aligned format with markdown support
          const formattedContent = options
            ? formatParamDescription(tag.description, options)
            : wrapParamDescription(
                tag.description,
                prefix.length + padding.length + 2
              );

          if (Array.isArray(formattedContent) && formattedContent.length > 0) {
            // Handle the formatted content properly
            const firstItem = formattedContent[0];

            if (typeof firstItem === 'string') {
              // Simple string content
              result.push(
                createCommentLine([prefix, padding, '- ', firstItem])
              );

              // Handle continuation lines
              for (let i = 1; i < formattedContent.length; i++) {
                const item = formattedContent[i];
                if (typeof item === 'string') {
                  if (item === '') {
                    result.push(createCommentLine(''));
                  } else {
                    const continuationIndent = '  ';
                    result.push(createCommentLine([continuationIndent, item]));
                  }
                } else if (item && typeof item === 'object') {
                  handleFormattedParameterItem(item, result);
                }
              }
            } else if (firstItem && typeof firstItem === 'object') {
              // First item is a complex object (list, code block, etc.)
              result.push(createCommentLine([prefix, padding, '- ']));
              handleFormattedParameterItem(firstItem, result);

              // Handle remaining items
              for (let i = 1; i < formattedContent.length; i++) {
                const item = formattedContent[i];
                if (typeof item === 'string') {
                  if (item === '') {
                    result.push(createCommentLine(''));
                  } else {
                    const continuationIndent = '  ';
                    result.push(createCommentLine([continuationIndent, item]));
                  }
                } else if (item && typeof item === 'object') {
                  handleFormattedParameterItem(item, result);
                }
              }
            }
          } else {
            // Fallback to legacy behavior
            const wrappedLines = wrapParamDescription(
              tag.description,
              prefix.length + padding.length + 2
            );

            result.push(
              createCommentLine([prefix, padding, '- ', wrappedLines[0]])
            );

            for (let i = 1; i < wrappedLines.length; i++) {
              const continuationIndent = '  ';
              result.push(
                createCommentLine([continuationIndent, wrappedLines[i]])
              );
            }
          }
        }
      }
    } else {
      // No description - check if we should add hyphen based on tag type
      const tsdocOptions = resolveOptions(options);

      // Determine which option to check based on tag type
      // Normalize tag name to handle both '@typeParam' and 'typeParam' formats
      const normalizedTagName = tag.tagName.startsWith('@')
        ? tag.tagName
        : `@${tag.tagName}`;
      const shouldAddHyphen =
        normalizedTagName === '@typeParam'
          ? tsdocOptions.requireTypeParamHyphen
          : tsdocOptions.requireParamHyphen;

      if (shouldAddHyphen) {
        // Add hyphen for TypeDoc compatibility
        if (alignTags && tags.length > 1) {
          // Aligned format - align the hyphen with other tags
          const currentWidth = prefix.length;
          const targetWidth = maxWidth - 3; // maxWidth includes " - ", so subtract it
          const paddingNeeded = Math.max(1, targetWidth - currentWidth + 1);
          const padding = ' '.repeat(paddingNeeded);
          result.push(createCommentLine([prefix, padding, '-']));
        } else {
          // Non-aligned format
          result.push(createCommentLine(`${prefix} -`));
        }
      } else {
        // No description, no hyphen (legacy behavior)
        result.push(createCommentLine(prefix));
      }
    }
  }

  return result;
}

/**
 * Format parameter description with Markdown support
 */
function formatParamDescription(
  text: string,
  options: Partial<ParserOptions<any>>
): any {
  if (!text.trim()) {
    return [];
  }

  // Check if this looks like multi-line markdown content
  if (hasMarkdownFeatures(text)) {
    return formatMarkdownParamContent(text, options);
  }

  // For simple text, use basic wrapping
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3; // Account for " * "

  if (text.length <= availableWidth) {
    return [text];
  }

  // Simple word wrapping for plain text
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
 * Check if text contains markdown features that need special processing
 */
function hasMarkdownFeatures(text: string): boolean {
  // Check for multiple paragraphs (double newlines)
  if (text.includes('\n\n')) return true;

  // Check for lists
  if (/^\s*[-*+]\s/m.test(text)) return true;

  // Check for numbered lists
  if (/^\s*\d+\.\s/m.test(text)) return true;

  // Check for code blocks
  if (text.includes('```')) return true;

  // Check for multiple lines (could be complex content)
  const lines = text.split('\n').filter((line) => line.trim());
  return lines.length > 2;
}

/**
 * Format markdown content in parameter descriptions
 */
function formatMarkdownParamContent(
  text: string,
  options: Partial<ParserOptions<any>>
): any[] {
  // Preserve inline tags to prevent them from being split during text wrapping
  const { text: textWithTokens, tokens } = preserveInlineTags(text);

  // Split text into lines to process properly
  const lines = textWithTokens.split('\n');
  const result: any[] = [];
  let currentParagraph: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('```')) {
      // Fenced code block start or end
      if (!inCodeBlock) {
        // Starting a code block - end current paragraph first
        if (currentParagraph.length > 0) {
          const paragraphText = currentParagraph.join(' ');
          const wrapped = wrapTextToLines(paragraphText, options);
          result.push(...wrapped);
          currentParagraph = [];

          // Add empty line for separation between paragraph and code block
          result.push('');
        }

        // Start code block
        inCodeBlock = true;
        const _codeBlockLanguage = line.slice(3).trim() || 'text';
        codeBlockLines = [];
        result.push({
          type: 'code-fence-start',
          content: line,
        });
      } else {
        // Ending a code block - format the collected code
        inCodeBlock = false;

        // Add the collected code lines (basic formatting)
        for (const codeLine of codeBlockLines) {
          result.push({
            type: 'code-line',
            content: codeLine,
          });
        }

        // Add closing code fence
        result.push({
          type: 'code-fence-end',
          content: line,
        });
      }
    } else if (inCodeBlock) {
      // Inside a code block - collect the line
      // Remove leading whitespace since code blocks should not be indented in TSDoc comments
      const trimmedCodeLine = lines[i].replace(/^\s+/, '');
      codeBlockLines.push(trimmedCodeLine);
    } else if (!line) {
      // Empty line - end current paragraph if any
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        const wrapped = wrapTextToLines(paragraphText, options);
        result.push(...wrapped);
        currentParagraph = [];
      }

      // Add empty line for paragraph break
      result.push('');
    } else if (line.match(/^[-*+]\s/) || line.match(/^\d+\.\s/)) {
      // List item - end current paragraph first
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ');
        const wrapped = wrapTextToLines(paragraphText, options);
        result.push(...wrapped);
        currentParagraph = [];
      }

      // Collect all content for this list item (including continuation lines)
      const listContent: string[] = [];
      const match = line.match(/^([-*+])\s(.+)$/);
      let marker = '';

      if (match) {
        [, marker] = match;
        const [, , content] = match;
        listContent.push(content);
      } else {
        // Try numbered list
        const numberedMatch = line.match(/^(\d+\.)\s(.+)$/);
        if (numberedMatch) {
          [, marker] = numberedMatch;
          const [, , content] = numberedMatch;
          listContent.push(content);
        }
      }

      if (marker) {
        // Look ahead for continuation lines
        let j = i + 1;
        let lastConsumedIndex = i;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (!nextLine) {
            // Empty line ends the list item
            break;
          } else if (nextLine.match(/^[-*+]\s/) || nextLine.match(/^\d+\.\s/)) {
            // Another list item ends this one
            break;
          } else {
            // Continuation line - add to this list item
            listContent.push(nextLine);
            lastConsumedIndex = j;
            j++;
          }
        }
        i = lastConsumedIndex;

        // Join all content and wrap
        const fullContent = listContent.join(' ');
        const wrappedLines = wrapListItemContent(fullContent, options);
        result.push({
          type: 'list-item',
          marker,
          lines: wrappedLines,
        });
      }
    } else {
      // Regular text line - add to current paragraph
      currentParagraph.push(line);
    }
  }

  // Handle remaining paragraph
  if (currentParagraph.length > 0) {
    const paragraphText = currentParagraph.join(' ');
    const wrapped = wrapTextToLines(paragraphText, options);
    result.push(...wrapped);
  }

  // Restore inline tags in the final result
  return result.map((item: any) => {
    if (typeof item === 'string') {
      return restoreInlineTags(item, tokens);
    } else if (item && typeof item === 'object' && item.type === 'list-item') {
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
      return {
        ...item,
        content: restoreInlineTags(item.content, tokens),
      };
    }
    return item;
  });
}

/**
 * Wrap text to lines for parameter content
 */
function wrapTextToLines(
  text: string,
  options: Partial<ParserOptions<any>>
): string[] {
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3; // Account for " * "

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
 * Wrap list item content into an array of lines
 */
function wrapListItemContent(
  text: string,
  options: Partial<ParserOptions<any>>
): string[] {
  const printWidth = options.printWidth || 80;
  const availableWidth = printWidth - 3; // Account for " * "

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
 * Wrap parameter description text into an array of lines (legacy function for backward compatibility)
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
 * Handle formatted parameter items (lists, code blocks, etc.)
 */
function handleFormattedParameterItem(item: any, result: any[]): void {
  const continuationIndent = '  '; // 2 spaces to align with comment content

  if (item.type === 'list-item') {
    // Handle list items with proper continuation indentation
    const listItem = item as any;
    // First line with marker
    result.push(
      createCommentLine([
        continuationIndent,
        `${listItem.marker} ${listItem.lines[0]}`,
      ])
    );
    // Continuation lines with proper indentation - align with the content after the marker
    for (let i = 1; i < listItem.lines.length; i++) {
      result.push(
        createCommentLine([continuationIndent, '  ', listItem.lines[i]]) // 2 extra spaces to align with content after "- "
      );
    }
  } else if (
    item.type === 'code-fence-start' ||
    item.type === 'code-fence-end' ||
    item.type === 'code-line'
  ) {
    // Handle code block elements - fenced code blocks should not be indented
    // as this breaks compatibility with linters and TypeDoc
    result.push(createCommentLine(item.content));
  }
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
