/**
 * Intermediate model types for TSDoc comment sections.
 * These represent the parsed and normalized structure before converting to Prettier Doc.
 */

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

export interface ParamTag {
  tagName: string;
  name: string;
  description: string;
  rawNode: any;
}

export interface ReturnsSection extends CommentSection {
  type: 'returns';
  tagName: string;
  content: string;
  rawNode: any;
}

export interface OtherTag {
  tagName: string;
  content: string;
  rawNode: any;
}

export interface TSDocCommentModel {
  summary?: SummarySection;
  remarks?: RemarksSection;
  params: ParamTag[];
  typeParams: ParamTag[];
  returns?: ReturnsSection;
  otherTags: OtherTag[];
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
    const tagName = node.tagName.startsWith('@') ? node.tagName : `@${node.tagName}`;
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
    return node.nodes.map(extractTextFromNode).join('\n').replace(/\n{3,}/g, '\n\n');
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
function extractFullExampleContent(exampleBlock: any, docComment: any, rawComment?: string): string {
  if (!rawComment) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.log('No raw comment provided, using fallback');
    }
    // Fallback to normal extraction
    return extractTextFromNode(exampleBlock.content);
  }
  
  // Find the @example tag in the raw text (stop at next @ tag or closing comment)
  const exampleTagMatch = rawComment.match(/@example\s+(.*?)(?=@\w+|\*\/\s*$|$)/s);
  
  if (exampleTagMatch) {
    let fullContent = exampleTagMatch[1].trim();
    
    // Clean up comment prefixes from each line
    fullContent = fullContent
      .split('\n')
      .map((line: string) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();
    
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.log('Extracted full @example content:', JSON.stringify(fullContent));
    }
    
    return fullContent;
  }
  
  // Fallback to normal extraction
  return extractTextFromNode(exampleBlock.content);
}

/**
 * Build the intermediate model from a parsed TSDoc comment.
 */
export function buildCommentModel(docComment: any, rawComment?: string): TSDocCommentModel {
  const model: TSDocCommentModel = {
    params: [],
    typeParams: [],
    otherTags: [],
  };

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
        type: 'returns',
        tagName: '@returns',
        content: returnsText.trim(),
        rawNode: docComment.returnsBlock,
      };
    }
  }

  // Extract other custom blocks (for modifier/release tags, etc)
  if (docComment.customBlocks) {
    for (const block of docComment.customBlocks) {
      if (block.blockTag && block.blockTag.tagName) {
        let content = extractTextFromNode(block.content);
        
        // For @example tags, try to get the full content including code blocks
        if (block.blockTag.tagName === '@example') {
          content = extractFullExampleContent(block, docComment, rawComment);
        }
        
        if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
          console.log(`Custom block found: ${block.blockTag.tagName}`);
          console.log(`Content: ${JSON.stringify(content)}`);
        }
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
