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
    // Reconstruct the original {@link URL | text} or {@link URL} syntax
    const urlArgument = node.urlDestination || '';
    const linkText = node.linkText || '';

    if (linkText && linkText !== urlArgument) {
      return `{@link ${urlArgument} | ${linkText}}`;
    } else {
      return `{@link ${urlArgument}}`;
    }
  }

  // Handle other inline tags like {@inheritDoc}, {@label}, etc.
  if (node.kind && node.kind.endsWith('Tag') && node.tagName) {
    // Generic inline tag handling - preserve the original syntax
    const tagName = node.tagName.startsWith('@')
      ? node.tagName
      : `@${node.tagName}`;
    const content = node.content || node.text || '';

    if (content) {
      return `{${tagName} ${content}}`;
    } else {
      return `{${tagName}}`;
    }
  }

  if (node.kind === 'Paragraph' && node.nodes) {
    return node.nodes.map(extractTextFromNode).join('');
  }

  if (node.kind === 'Section' && node.nodes) {
    // For sections, preserve line breaks between different elements
    // Allow up to 2 consecutive newlines (paragraph breaks) but collapse more than that
    return node.nodes
      .map(extractTextFromNode)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  if (node.nodes) {
    // For node collections, try to preserve structure
    return node.nodes.map(extractTextFromNode).join('');
  }

  return node.text || node.content || '';
}

/**
 * Extract full @example content including code blocks by parsing raw comment text
 */
function extractFullExampleContent(
  exampleBlock: any,
  rawComment?: string
): string {
  if (!rawComment) {
    debugLog('No raw comment provided, using fallback');
    // Fallback to normal extraction
    return extractTextFromNode(exampleBlock.content);
  }

  // Find the @example tag in the raw text (stop at next @ tag or closing comment)
  const exampleTagMatch = rawComment.match(
    /@example\s+(.*?)(?=@\w+|\*\/\s*$|$)/s
  );

  if (exampleTagMatch) {
    let fullContent = exampleTagMatch[1].trim();

    // Clean up comment prefixes from each line
    fullContent = fullContent
      .split('\n')
      .map((line: string) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();

    debugLog('Extracted full @example content:', JSON.stringify(fullContent));

    return fullContent;
  }

  // Fallback to normal extraction
  return extractTextFromNode(exampleBlock.content);
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
