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

  // Handle other inline tags like {@inheritDoc}, {@label}, etc.
  if (
    node.kind &&
    typeof node.kind === 'string' &&
    node.kind.endsWith('Tag') &&
    node.tagName
  ) {
    // Generic inline tag handling - preserve the original syntax
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

    if (content) {
      return `{${tagName} ${content}}`;
    } else {
      return `{${tagName}}`;
    }
  }

  if (node.kind === 'Paragraph' && (node.nodes || node._nodes)) {
    const nodes = node.nodes || node._nodes;
    return nodes.map(extractTextFromNode).join('');
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
 * Extract full @example content including code blocks by parsing raw comment text
 *
 * The issue we're solving: TSDoc parser sometimes doesn't capture the full content
 * of @example blocks, especially when they contain code fences. We need to extract
 * the content manually but respect the proper scope boundaries of @example tags.
 */
function extractFullExampleContent(
  exampleBlock: any,
  rawComment?: string
): string {
  // First, try the normal extraction - if it gives us good content, use it
  const normalExtraction = extractTextFromNode(exampleBlock.content);

  if (!rawComment || normalExtraction.includes('```')) {
    // If we have the raw comment but normal extraction already includes code blocks,
    // or if we don't have raw comment, use normal extraction
    debugLog(
      'Using normal extraction for @example:',
      JSON.stringify(normalExtraction)
    );
    return normalExtraction;
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
    return normalExtraction;
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

  // Clean up comment prefixes from each line
  const cleanedContent = exampleContent
    .split('\n')
    .map((line: string) => line.replace(/^\s*\*\s?/, ''))
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
    return cleanedContent;
  }

  // Otherwise, stick with normal extraction
  return normalExtraction;
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

  // Extract other custom blocks (for block tags like @example, @see, etc)
  if (docComment.customBlocks) {
    for (const block of docComment.customBlocks) {
      if (block.blockTag && block.blockTag.tagName) {
        let content = extractTextFromNode(block.content);

        // For @example tags, try to get the full content including code blocks
        if (block.blockTag.tagName === '@example') {
          content = extractFullExampleContent(block, rawComment);
        }

        debugLog(`Custom block found: ${block.blockTag.tagName}`);
        debugLog(`Content: ${JSON.stringify(content)}`);
        model.otherTags.push({
          tagName: block.blockTag.tagName,
          content: content.trim(),
          rawNode: block,
        });
      }
    }
  }

  return model;
}
