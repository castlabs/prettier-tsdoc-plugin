/**
 * Intermediate model types for TSDoc comment sections.
 * These represent the parsed and normalized structure before converting to Prettier Doc.
 */

import type {
  TSDocCommentModel,
  ParamTag,
  ReturnsTag,
  OtherTag,
} from './types.js';
import { TSDocTagSyntaxKind } from '@microsoft/tsdoc';
import { debugLog } from './utils/common.js';

// Re-export types for backward compatibility
export type {
  TSDocCommentModel,
  ParamTag,
  ReturnsTag as ReturnsSection,
  OtherTag,
};

// Legacy interfaces for backward compatibility
export interface CommentSection {
  type: string;
}

export interface SummarySection extends CommentSection {
  type: 'summary';
  content: string;
}

export interface RemarksSection extends CommentSection {
  type: 'remarks';
  content: string;
}

/**
 * Extract text content from TSDoc nodes, handling various node types and preserving structure.
 */
export function extractTextFromNode(node: any): string {
  if (!node) return '';

  if (typeof node === 'string') {
    return node;
  }

  if (node.kind === 'PlainText') {
    return node.text || '';
  }

  if (node.kind === 'SoftBreak') {
    return '\n';
  }

  // Handle CodeSpan nodes (existing backticks from previous formatting)
  if (node.kind === 'CodeSpan') {
    // Try to get the code content from the excerpt
    if (node._codeExcerpt) {
      const code = node._codeExcerpt._content.toString();
      return `\`${code}\``;
    }
    // Fallback - return empty backticks if no content found
    return '``';
  }

  // Handle inline tags like {@link} - preserve the original syntax
  if (node.kind === 'LinkTag') {
    // Try to get the link destination from different sources
    let linkDestination = '';

    // 1. Check for URL destination (for http/https links)
    if (node._urlDestinationExcerpt) {
      linkDestination = node._urlDestinationExcerpt._content.toString();
    } else if (node.urlDestination) {
      // Fallback to old property name for compatibility
      linkDestination = node.urlDestination;
    }
    // 2. Check for code destination (for symbol references like "hello", "MyClass")
    else if (
      node._codeDestination &&
      node._codeDestination._memberReferences &&
      node._codeDestination._memberReferences.length > 0
    ) {
      // Build the full member reference path (e.g., "MyNamespace.MyClass.method")
      const memberRefParts = [];
      for (const memberRef of node._codeDestination._memberReferences) {
        if (
          memberRef._memberIdentifier &&
          memberRef._memberIdentifier._identifierExcerpt
        ) {
          memberRefParts.push(
            memberRef._memberIdentifier._identifierExcerpt._content.toString()
          );
        }
      }
      linkDestination = memberRefParts.join('.');
    } else if (
      node.codeDestination &&
      node.codeDestination.memberReferences &&
      node.codeDestination.memberReferences.length > 0
    ) {
      // Fallback to old property names for compatibility
      const memberRef = node.codeDestination.memberReferences[0];
      if (memberRef.memberIdentifier && memberRef.memberIdentifier.identifier) {
        linkDestination = memberRef.memberIdentifier.identifier;
      }
    }

    // Get the link text (for syntax like {@link URL | text})
    let linkText = '';
    if (node._linkTextExcerpt) {
      linkText = node._linkTextExcerpt._content.toString();
    } else if (node.linkText) {
      // Fallback to old property name for compatibility
      linkText = node.linkText;
    }

    if (linkText && linkText !== linkDestination) {
      return `{@link ${linkDestination} | ${linkText}}`;
    } else {
      return `{@link ${linkDestination}}`;
    }
  }

  // Handle other inline tags like {@inheritDoc}, {@label}, {@code}, etc.
  if (
    node.kind &&
    typeof node.kind === 'string' &&
    node.kind.endsWith('Tag') &&
    node.tagName
  ) {
    // Get the tag name
    const tagName = node.tagName.startsWith('@')
      ? node.tagName
      : `@${node.tagName}`;

    // Try to get content from different sources
    let content = '';
    if (node._tagContentExcerpt) {
      content = node._tagContentExcerpt._content.toString();
    } else if (node.content) {
      content = node.content;
    } else if (node.text) {
      content = node.text;
    }

    // Special handling for {@code} tags - convert directly to backticks
    if (tagName === '@code' && content) {
      return `\`${content}\``;
    }

    // Dynamically determine if this is an inline tag by checking the TSDoc configuration
    // This works for both built-in tags and custom tags defined in tsdoc.json
    let isInlineTag = false;
    if (node.configuration) {
      const tagDefinition = node.configuration.tryGetTagDefinition(tagName);
      if (tagDefinition) {
        isInlineTag = tagDefinition.syntaxKind === TSDocTagSyntaxKind.InlineTag;
      }
    }

    if (isInlineTag) {
      // Inline tag - wrap in curly braces: {@tag content}
      if (content) {
        return `{${tagName} ${content}}`;
      } else {
        return `{${tagName}}`;
      }
    } else {
      // Block or modifier tag - format without braces: @tag content
      // This handles cases like @namespace, @module, @public, etc.
      if (content) {
        return `${tagName} ${content}`;
      } else {
        return tagName;
      }
    }
  }

  // Handle DocFencedCode nodes (code blocks like ```typescript)
  if (
    node.kind === 'FencedCode' ||
    (node._openingFenceExcerpt &&
      node._codeExcerpt &&
      node._closingFenceExcerpt)
  ) {
    // Extract the language if available
    let language = '';
    if (node._languageExcerpt) {
      language = node._languageExcerpt._content.toString().trim();
    }

    // Extract the code content
    let code = '';
    if (node._codeExcerpt) {
      code = node._codeExcerpt._content.toString();
    }

    // Return the formatted code block
    if (language) {
      return `\`\`\`${language}\n${code}\`\`\``;
    } else {
      return `\`\`\`\n${code}\`\`\``;
    }
  }

  if (node.kind === 'Paragraph' && (node.nodes || node._nodes)) {
    const nodes = node.nodes || node._nodes;
    const extractedTexts = nodes.map(extractTextFromNode);
    const result = extractedTexts.join('');
    return result;
  }

  if (node.kind === 'Section' && (node.nodes || node._nodes)) {
    // For sections, preserve line breaks between different elements
    // Allow up to 2 consecutive newlines (paragraph breaks) but collapse more than that
    const nodes = node.nodes || node._nodes;
    return nodes
      .map(extractTextFromNode)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  if (node.nodes || node._nodes) {
    // For node collections, try to preserve structure
    const nodes = node.nodes || node._nodes;
    return nodes.map(extractTextFromNode).join('');
  }

  return node.text || node.content || '';
}

/**
 * Result of extracting @example content
 */
interface ExampleExtractionResult {
  /** The extracted content */
  content: string;
  /** Whether the title/first content was on the same line as @example */
  titleOnSameLine: boolean;
}

/**
 * Extract full @example content including code blocks by parsing raw comment text
 *
 * The issue we're solving: TSDoc parser sometimes doesn't capture the full content
 * of @example blocks, especially when they contain code fences. We need to extract
 * the content manually but respect the proper scope boundaries of @example tags.
 *
 * Also detects whether the first line of content was on the same line as the
 * `@example` tag, which is semantically significant (same-line content is treated
 * as a "title" by TypeDoc and other renderers).
 */
function extractFullExampleContent(
  exampleBlock: any,
  rawComment?: string
): ExampleExtractionResult {
  // First, try the normal extraction - if it gives us good content, use it
  const normalExtraction = extractTextFromNode(exampleBlock.content);

  // Helper to detect if title was on same line from the block's raw text
  // This uses the block tag's excerpt to find the exact position in the source
  const detectTitleOnSameLine = (): boolean => {
    // Try to get the raw text from the block tag's excerpt
    // The TSDoc parser stores the original source text in excerpts
    try {
      const blockTag = exampleBlock.blockTag;
      if (blockTag && blockTag._excerpt) {
        // Get the content after this specific @example tag
        const excerpt = blockTag._excerpt;
        const parcel = excerpt._parcel;
        if (parcel && parcel._buffer) {
          const buffer = parcel._buffer;
          const endIndex = excerpt._endIndex || buffer.length;

          // Find the @example tag end position
          const tagEndPos = endIndex;

          // Look at what comes after the tag on the same line
          let pos = tagEndPos;
          while (pos < buffer.length && buffer[pos] !== '\n') {
            const char = buffer[pos];
            // Skip whitespace
            if (char !== ' ' && char !== '\t' && char !== '*') {
              // Found non-whitespace content on the same line
              return true;
            }
            pos++;
          }
        }
      }
    } catch {
      // If we can't access the excerpt, fall back to content-based heuristic
    }

    // Fallback: Check if the content section starts with a SoftBreak
    // If it does NOT start with a SoftBreak, the content was on the same line as @example
    if (normalExtraction.trim()) {
      // Get the first node from the content section
      // The content is typically a DocSection which has a nodes/_nodes array
      const contentSection = exampleBlock.content;
      if (contentSection) {
        const nodes = contentSection.nodes || contentSection._nodes;
        if (nodes && nodes.length > 0) {
          const firstNode = nodes[0];
          // Check if first node is a Paragraph (which contains the actual content nodes)
          if (firstNode && firstNode.kind === 'Paragraph') {
            const paragraphNodes = firstNode.nodes || firstNode._nodes;
            if (paragraphNodes && paragraphNodes.length > 0) {
              const firstParagraphNode = paragraphNodes[0];
              // If the first node in the paragraph is NOT a SoftBreak, content was on same line
              if (
                firstParagraphNode &&
                firstParagraphNode.kind !== 'SoftBreak'
              ) {
                return true;
              }
            }
          } else if (firstNode && firstNode.kind !== 'SoftBreak') {
            // Direct content (not in a paragraph) that isn't a SoftBreak
            return true;
          }
        }
      }
    }

    return false;
  };

  const titleOnSameLine = detectTitleOnSameLine();

  if (!rawComment || normalExtraction.includes('```')) {
    // If we have the raw comment but normal extraction already includes code blocks,
    // or if we don't have raw comment, use normal extraction
    debugLog(
      'Using normal extraction for @example:',
      JSON.stringify(normalExtraction)
    );
    return {
      content: normalExtraction,
      titleOnSameLine,
    };
  }

  debugLog('Normal extraction lacks code blocks, trying raw extraction');
  debugLog(
    'Raw comment snippet:',
    JSON.stringify(rawComment.substring(0, 200))
  );

  // Only do manual extraction if normal extraction seems incomplete
  // Find the @example tag in the raw comment
  const exampleTagIndex = rawComment.indexOf('@example');
  if (exampleTagIndex === -1) {
    debugLog('Could not find @example in raw comment, using normal extraction');
    return {
      content: normalExtraction,
      titleOnSameLine,
    };
  }

  // Extract from @example to the end of comment
  const contentAfterExample = rawComment.substring(exampleTagIndex);

  // Find the next block-level tag that would terminate this @example
  const blockTerminatorTags = [
    '@param',
    '@typeParam',
    '@returns',
    '@return',
    '@remarks',
    '@example',
    '@see',
    '@throws',
    '@deprecated',
    '@category',
    '@categoryDescription',
    '@group',
    '@groupDescription',
    '@default',
    '@document',
    '@expandType',
    '@import',
    '@inlineType',
    '@license',
    '@module',
    '@property',
    '@prop',
    '@since',
    '@sortStrategy',
    '@summary',
    '@template',
    '@type',
    '@abstract',
    '@alpha',
    '@beta',
    '@public',
    '@internal',
    '@experimental',
    '@event',
    '@eventProperty',
    '@hidden',
    '@inline',
    '@override',
    '@readonly',
    '@sealed',
    '@virtual',
    '@preventExpand',
    '@preventInline',
  ];

  // Look for the next tag after the first @example
  let nextTagIndex = -1;
  let nextTag = '';

  // Start looking after the first line of @example
  const firstLineEnd = contentAfterExample.indexOf('\n');
  const searchStart = firstLineEnd > 0 ? firstLineEnd : 0;

  for (const tag of blockTerminatorTags) {
    const tagPattern = new RegExp(
      `^\\s*\\*\\s*${tag.replace('@', '\\@')}\\b`,
      'm'
    );
    const match = contentAfterExample.substring(searchStart).match(tagPattern);
    if (match && match.index !== undefined) {
      const actualIndex = searchStart + match.index;
      if (nextTagIndex === -1 || actualIndex < nextTagIndex) {
        nextTagIndex = actualIndex;
        nextTag = tag;
      }
    }
  }

  // Extract content up to the next tag (or end if no tag found)
  let exampleContent;
  if (nextTagIndex > 0) {
    exampleContent = contentAfterExample.substring(0, nextTagIndex);
    debugLog(`Found terminating tag ${nextTag} at index ${nextTagIndex}`);
  } else {
    // Look for comment end
    const commentEndIndex = contentAfterExample.lastIndexOf('*/');
    exampleContent =
      commentEndIndex > 0
        ? contentAfterExample.substring(0, commentEndIndex)
        : contentAfterExample;
    debugLog('No terminating tag found, using content until comment end');
  }

  // Remove the @example tag itself and clean up
  exampleContent = exampleContent.replace(/^@example\s*/, '');

  // Clean up comment prefixes from each line.
  // Using lookahead (?=\s|$) ensures we don't strip the first * from markdown bold syntax like **text**
  const cleanedContent = exampleContent
    .split('\n')
    .map((line: string) => line.replace(/^\s*\*(?=\s|$)\s?/, ''))
    .join('\n')
    .trim();

  debugLog(
    'Extracted @example content via raw parsing:',
    JSON.stringify(cleanedContent)
  );

  // If the manually extracted content is substantially longer and contains code blocks,
  // prefer it over normal extraction
  if (
    cleanedContent.length > normalExtraction.length &&
    cleanedContent.includes('```')
  ) {
    return {
      content: cleanedContent,
      titleOnSameLine,
    };
  }

  // Otherwise, stick with normal extraction
  return {
    content: normalExtraction,
    titleOnSameLine,
  };
}

/**
 * Build the intermediate model from a parsed TSDoc comment.
 */
export function buildCommentModel(
  docComment: any,
  rawComment?: string
): TSDocCommentModel {
  const model: TSDocCommentModel = {
    params: [],
    typeParams: [],
    otherTags: [],
  };

  debugLog('DocComment structure:', {
    summarySection: !!docComment.summarySection,
    remarksBlock: !!docComment.remarksBlock,
    params: !!docComment.params,
    typeParams: !!docComment.typeParams,
    returnsBlock: !!docComment.returnsBlock,
    customBlocks: docComment.customBlocks?.length || 0,
    modifierTagSet: docComment.modifierTagSet?.nodes?.length || 0,
    deprecatedBlock: !!docComment.deprecatedBlock,
    seeBlocks: docComment.seeBlocks?.length || 0,
  });

  // List all properties to find where @see might be stored
  debugLog('All docComment properties:', Object.keys(docComment));

  // Extract summary from the summary section
  if (docComment.summarySection) {
    const summaryText = extractTextFromNode(docComment.summarySection);
    if (summaryText.trim()) {
      model.summary = {
        type: 'summary',
        content: summaryText.trim(),
      };
    }
  }

  // Extract remarks from the remarksBlock property
  if (docComment.remarksBlock) {
    const remarksText = extractTextFromNode(
      docComment.remarksBlock._content || docComment.remarksBlock.content
    );
    if (remarksText.trim()) {
      model.remarks = {
        type: 'remarks',
        content: remarksText.trim(),
      };
    }
  }

  // Extract @param tags
  if (docComment.params) {
    for (const param of docComment.params.blocks) {
      if (param.parameterName) {
        const description = extractTextFromNode(param.content);
        model.params.push({
          tagName: '@param',
          name: param.parameterName,
          description: description.trim(),
          rawNode: param,
        });
      }
    }
  }

  // Extract @typeParam tags
  if (docComment.typeParams) {
    for (const typeParam of docComment.typeParams.blocks) {
      if (typeParam.parameterName) {
        const description = extractTextFromNode(typeParam.content);
        model.typeParams.push({
          tagName: '@typeParam',
          name: typeParam.parameterName,
          description: description.trim(),
          rawNode: typeParam,
        });
      }
    }
  }

  // Extract @returns tag
  if (docComment.returnsBlock) {
    const returnsText = extractTextFromNode(
      docComment.returnsBlock._content || docComment.returnsBlock.content
    );
    if (returnsText.trim()) {
      model.returns = {
        tagName: '@returns',
        content: returnsText.trim(),
        rawNode: docComment.returnsBlock,
      };
    }
  }

  // Extract @deprecated tag (TSDoc treats this as a special block)
  if (docComment.deprecatedBlock) {
    const deprecatedText = extractTextFromNode(
      docComment.deprecatedBlock._content || docComment.deprecatedBlock.content
    );
    debugLog('Deprecated block found:', JSON.stringify(deprecatedText));
    model.otherTags.push({
      tagName: '@deprecated',
      content: deprecatedText.trim(),
      rawNode: docComment.deprecatedBlock,
    });
  }

  // Extract @see tags (TSDoc treats these as special blocks)
  if (docComment.seeBlocks && docComment.seeBlocks.length > 0) {
    for (const seeBlock of docComment.seeBlocks) {
      const seeText = extractTextFromNode(
        seeBlock._content || seeBlock.content
      );
      debugLog('See block found:', JSON.stringify(seeText));
      model.otherTags.push({
        tagName: '@see',
        content: seeText.trim(),
        rawNode: seeBlock,
      });
    }
  }

  // Extract modifier tags from modifierTagSet (includes release tags like @public, @internal, etc)
  if (docComment.modifierTagSet && docComment.modifierTagSet.nodes) {
    for (const modifierTag of docComment.modifierTagSet.nodes) {
      if (modifierTag.tagName) {
        debugLog(`Modifier tag found: ${modifierTag.tagName}`);
        model.otherTags.push({
          tagName: modifierTag.tagName,
          content: '', // Modifier tags typically have no content
          rawNode: modifierTag,
        });
      }
    }
  }

  // Handle @fileoverview transformation first
  let fileoverviewContent = '';

  // Extract other custom blocks (for block tags like @example, @see, etc)
  if (docComment.customBlocks) {
    for (const block of docComment.customBlocks) {
      if (block.blockTag && block.blockTag.tagName) {
        let content = extractTextFromNode(block.content);

        // Special handling for @fileoverview - transform to @packageDocumentation
        if (block.blockTag.tagName === '@fileoverview') {
          fileoverviewContent = content.trim();
          debugLog(
            `@fileoverview found, content: ${JSON.stringify(fileoverviewContent)}`
          );

          // Add @packageDocumentation tag instead
          model.otherTags.push({
            tagName: '@packageDocumentation',
            content: '',
            rawNode: block,
          });
          continue; // Skip adding @fileoverview to otherTags
        }

        // For @example tags, try to get the full content including code blocks
        // and track whether title was on the same line
        let titleOnSameLine: boolean | undefined;
        if (block.blockTag.tagName === '@example') {
          const exampleResult = extractFullExampleContent(block, rawComment);
          content = exampleResult.content;
          titleOnSameLine = exampleResult.titleOnSameLine;
        }

        debugLog(`Custom block found: ${block.blockTag.tagName}`);
        debugLog(`Content: ${JSON.stringify(content)}`);
        model.otherTags.push({
          tagName: block.blockTag.tagName,
          content: content.trim(),
          rawNode: block,
          ...(titleOnSameLine !== undefined && { titleOnSameLine }),
        });
      }
    }
  }

  // If @fileoverview content was found, move it to summary (or append to existing summary)
  if (fileoverviewContent) {
    if (model.summary) {
      // Append fileoverview content to existing summary
      model.summary.content =
        model.summary.content + '\n' + fileoverviewContent;
    } else {
      // Create new summary from fileoverview content
      model.summary = {
        type: 'summary',
        content: fileoverviewContent,
      };
    }
  }

  return model;
}
