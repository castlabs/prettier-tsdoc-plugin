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
 * Extract text content from TSDoc nodes, handling various node types.
 */
export function extractTextFromNode(node: any): string {
  if (!node) return '';
  
  if (typeof node === 'string') {
    return node;
  }
  
  if (node.kind === 'PlainText') {
    return node.text || '';
  }
  
  if (node.kind === 'Paragraph' && node.nodes) {
    return node.nodes.map(extractTextFromNode).join('');
  }
  
  if (node.kind === 'Section' && node.nodes) {
    return node.nodes.map(extractTextFromNode).join('');
  }
  
  if (node.nodes) {
    return node.nodes.map(extractTextFromNode).join('');
  }
  
  return node.text || node.content || '';
}

/**
 * Build the intermediate model from a parsed TSDoc comment.
 */
export function buildCommentModel(docComment: any): TSDocCommentModel {
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
    const remarksText = extractTextFromNode(docComment.remarksBlock._content || docComment.remarksBlock.content);
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
    const returnsText = extractTextFromNode(docComment.returnsBlock._content || docComment.returnsBlock.content);
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
        const content = extractTextFromNode(block.content);
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