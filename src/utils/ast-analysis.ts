/**
 * AST analysis utilities for detecting exported declarations and container inheritance.
 *
 * This module provides functions to analyze TypeScript AST nodes to determine:
 * - Whether a declaration is exported
 * - Whether a comment belongs to a class/interface member (inherits release tag)
 * - Namespace member inheritance rules
 */

import type { AstPath } from 'prettier';
import { debugLog } from './common.js';

export interface ExportAnalysis {
  isExported: boolean;
  exportType: 'named' | 'default' | 'namespace' | 'none';
  isContainerMember: boolean;
  containerType?: 'class' | 'interface' | 'namespace' | 'const-enum';
  shouldInheritReleaseTag: boolean;
}

/**
 * Analyze the AST context around a comment to determine if it needs a release tag.
 *
 * @param commentPath - Prettier AST path for the comment
 * @returns Analysis result with export and inheritance information
 */
export function analyzeCommentContext(
  commentPath: AstPath<any>
): ExportAnalysis {
  try {
    // Get the parent node that this comment is attached to
    const parentNode = getCommentParent(commentPath);

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('AST Analysis - Parent node:', parentNode?.type);
    }

    if (!parentNode) {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('AST Analysis - No parent node found');
      }
      return createDefaultAnalysis();
    }

    // Analyze export status
    const exportInfo = analyzeExportStatus(parentNode, commentPath);

    // Analyze container inheritance
    const inheritanceInfo = analyzeContainerInheritance(
      parentNode,
      commentPath
    );

    const result = {
      isExported: exportInfo.isExported,
      exportType: exportInfo.exportType,
      isContainerMember: inheritanceInfo.isContainerMember,
      containerType: inheritanceInfo.containerType,
      shouldInheritReleaseTag: inheritanceInfo.shouldInherit,
    };

    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('AST Analysis Result:', result);
    }

    return result;
  } catch (error) {
    // Graceful fallback on analysis errors
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.warn('AST analysis failed:', error);
    }
    return createDefaultAnalysis();
  }
}

/**
 * Get the AST node that this comment is documenting.
 *
 * Note: This is a simplified approach since Prettier's comment processing
 * doesn't always provide easy access to the commented declaration.
 * We'll use a heuristic approach by examining parent nodes.
 */
function getCommentParent(commentPath: AstPath<any>): any {
  try {
    const comment = commentPath.getValue();

    // Try to get the immediate parent node
    const parent = commentPath.getParentNode();
    if (!parent) return null;

    // For comments, we need to look at the parent's context
    // Check if parent has leadingComments that include our comment
    if (parent.leadingComments?.includes(comment)) {
      return parent;
    }

    // Check if parent is a declaration node
    if (isDeclarationNode(parent)) {
      return parent;
    }

    // Try to find siblings or related declarations
    if (parent.type === 'Program' && parent.body) {
      // Look for the next declaration after this comment
      for (const child of parent.body) {
        if (child.leadingComments?.includes(comment)) {
          return child;
        }
      }
    }

    return parent;
  } catch (error) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.warn('Error getting comment parent:', error);
    }
    return null;
  }
}

/**
 * Analyze whether a node represents an exported declaration.
 */
function analyzeExportStatus(
  node: any,
  commentPath: AstPath<any>
): {
  isExported: boolean;
  exportType: 'named' | 'default' | 'namespace' | 'none';
} {
  if (!node) {
    return { isExported: false, exportType: 'none' };
  }

  // Check for direct export keywords
  if (node.type === 'ExportNamedDeclaration') {
    return { isExported: true, exportType: 'named' };
  }

  if (node.type === 'ExportDefaultDeclaration') {
    return { isExported: true, exportType: 'default' };
  }

  // Check for export modifiers in TypeScript
  if (
    node.modifiers?.some(
      (mod: any) => mod.type === 'Keyword' && mod.value === 'export'
    )
  ) {
    return { isExported: true, exportType: 'named' };
  }

  // Check for namespace exports
  if (isWithinExportedNamespace(commentPath)) {
    return { isExported: true, exportType: 'namespace' };
  }

  // Check for ambient module declarations (declare module)
  if (isWithinAmbientModule(commentPath)) {
    return { isExported: true, exportType: 'namespace' };
  }

  return { isExported: false, exportType: 'none' };
}

/**
 * Analyze container inheritance (class/interface members inherit from container).
 */
function analyzeContainerInheritance(
  node: any,
  commentPath: AstPath<any>
): {
  isContainerMember: boolean;
  containerType?: 'class' | 'interface' | 'namespace' | 'const-enum';
  shouldInherit: boolean;
} {
  if (!node) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Container Analysis - No node provided');
    }
    return { isContainerMember: false, shouldInherit: false };
  }

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('Container Analysis - Analyzing node type:', node.type);
  }

  // Check if this is a class member
  const classContainer = findContainerOfType(commentPath, [
    'ClassDeclaration',
    'ClassExpression',
  ]);
  if (classContainer) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'Container Analysis - Found class container:',
        classContainer.type
      );
    }
    return {
      isContainerMember: true,
      containerType: 'class',
      shouldInherit: true,
    };
  }

  // Check if this is an interface member
  const interfaceContainer = findContainerOfType(commentPath, [
    'TSInterfaceDeclaration',
  ]);
  if (interfaceContainer) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'Container Analysis - Found interface container:',
        interfaceContainer.type
      );
    }
    return {
      isContainerMember: true,
      containerType: 'interface',
      shouldInherit: true,
    };
  }

  // Check if this is a namespace member
  const namespaceContainer = findContainerOfType(commentPath, [
    'TSModuleDeclaration',
    'ModuleDeclaration',
  ]);
  if (namespaceContainer) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'Container Analysis - Found namespace container:',
        namespaceContainer.type
      );
    }
    return {
      isContainerMember: true,
      containerType: 'namespace',
      shouldInherit: true,
    };
  }

  // Check if this is a const enum property
  const constEnumInfo = analyzeConstEnumProperty(node, commentPath);
  if (
    constEnumInfo.isConstEnumProperty &&
    constEnumInfo.parentHasEnumTag &&
    constEnumInfo.parentHasReleaseTag
  ) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'Container Analysis - Found const enum property:',
        constEnumInfo.parentReleaseTag
      );
    }
    return {
      isContainerMember: true,
      containerType: 'const-enum',
      shouldInherit: true,
    };
  }

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('Container Analysis - No container found');
  }
  return { isContainerMember: false, shouldInherit: false };
}

/**
 * Find a container of specific types in the AST hierarchy.
 *
 * This is a simplified approach since we can't easily traverse up the AST.
 * We'll check immediate parents and common patterns.
 */
function findContainerOfType(
  commentPath: AstPath<any>,
  containerTypes: string[]
): any {
  try {
    // Check the immediate parent
    const parent = commentPath.getParentNode();
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'findContainerOfType - Parent:',
        parent?.type,
        'Looking for:',
        containerTypes
      );
    }

    if (!parent) return null;

    if (containerTypes.includes(parent.type)) {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog('findContainerOfType - Found matching parent:', parent.type);
      }
      return parent;
    }

    // Try to get grandparent for more context
    const grandparent = commentPath.getParentNode(1);
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('findContainerOfType - Grandparent:', grandparent?.type);
    }

    if (grandparent && containerTypes.includes(grandparent.type)) {
      if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
        debugLog(
          'findContainerOfType - Found matching grandparent:',
          grandparent.type
        );
      }
      return grandparent;
    }

    // For now, return null - we could implement more sophisticated
    // traversal later if needed, but this covers most common cases
    return null;
  } catch (error) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.warn('Error finding container:', error);
    }
    return null;
  }
}

/**
 * Check if a node is within an exported namespace.
 */
function isWithinExportedNamespace(commentPath: AstPath<any>): boolean {
  const namespaceContainer = findContainerOfType(commentPath, [
    'TSModuleDeclaration',
    'ModuleDeclaration',
  ]);

  if (!namespaceContainer) return false;

  // Check if the namespace itself is exported
  return (
    namespaceContainer.modifiers?.some(
      (mod: any) => mod.type === 'Keyword' && mod.value === 'export'
    ) || false
  );
}

/**
 * Check if a node is within an ambient module declaration.
 */
function isWithinAmbientModule(commentPath: AstPath<any>): boolean {
  const moduleContainer = findContainerOfType(commentPath, [
    'TSModuleDeclaration',
    'ModuleDeclaration',
  ]);

  if (!moduleContainer) return false;

  // Check for declare keyword
  return (
    moduleContainer.declare === true ||
    moduleContainer.modifiers?.some(
      (mod: any) => mod.type === 'Keyword' && mod.value === 'declare'
    ) ||
    false
  );
}

/**
 * Check if a node represents a TypeScript declaration.
 */
function isDeclarationNode(node: any): boolean {
  if (!node || !node.type) return false;

  const declarationTypes = [
    'FunctionDeclaration',
    'ClassDeclaration',
    'ClassExpression',
    'InterfaceDeclaration',
    'TSInterfaceDeclaration',
    'TypeAliasDeclaration',
    'TSTypeAliasDeclaration',
    'EnumDeclaration',
    'TSEnumDeclaration',
    'VariableDeclaration',
    'TSModuleDeclaration',
    'ModuleDeclaration',
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
    'MethodDefinition',
    'PropertyDefinition',
    'TSMethodSignature',
    'TSPropertySignature',
  ];

  return declarationTypes.includes(node.type);
}

/**
 * Create a default analysis result (safe fallback).
 */
function createDefaultAnalysis(): ExportAnalysis {
  return {
    isExported: false,
    exportType: 'none',
    isContainerMember: false,
    shouldInheritReleaseTag: false,
  };
}

/**
 * Determine if a comment should receive an automatic release tag based on API Extractor rules.
 *
 * @param analysis - Result from analyzeCommentContext
 * @param hasExistingReleaseTag - Whether the comment already has a release tag
 * @returns Whether to add a default release tag
 */
export function shouldAddReleaseTag(
  analysis: ExportAnalysis,
  hasExistingReleaseTag: boolean
): boolean {
  // Never add if already has a release tag
  if (hasExistingReleaseTag) {
    return false;
  }

  // Only add to exported declarations
  if (!analysis.isExported) {
    return false;
  }

  // Skip if this is a container member that should inherit
  if (analysis.shouldInheritReleaseTag) {
    return false;
  }

  // Add to exported top-level constructs
  return true;
}

/**
 * Simple heuristic-based approach to detect class members from comment context.
 * This is a fallback when AST analysis is not available.
 *
 * @param commentContent - The raw comment content including surrounding context
 * @returns Whether this appears to be a class member
 */
export function isLikelyClassMember(commentContent: string): boolean {
  if (!commentContent) return false;

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog(
      'Analyzing comment for class member heuristics:',
      JSON.stringify(commentContent.substring(0, 100))
    );
  }

  // Split into lines and look for indentation patterns
  const lines = commentContent.split('\n');

  // Look for asterisk lines that have significant indentation
  // Class members typically have comments indented by 2+ spaces beyond the base indentation
  let hasSignificantIndentation = false;
  let indentedLineCount = 0;

  for (const line of lines) {
    // Skip the first line which might be just "*"
    if (line.trim() === '*' || line.trim() === '') continue;

    // Look for lines that start with spaces followed by asterisk
    const match = line.match(/^(\s+)\*/);
    if (match) {
      const spaces = match[1];
      // Class members typically have 2+ spaces of indentation before the asterisk
      if (spaces.length >= 2) {
        hasSignificantIndentation = true;
        indentedLineCount++;
      }
    }
  }

  // If multiple lines show significant indentation, likely a class member
  if (hasSignificantIndentation && indentedLineCount >= 2) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('Detected likely class member based on indentation pattern:', {
        indentedLineCount,
        hasSignificantIndentation,
      });
    }
    return true;
  }

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('No class member indentation pattern detected:', {
      indentedLineCount,
      hasSignificantIndentation,
    });
  }

  return false;
}

/**
 * Check if a comment string contains an `@enum` tag.
 *
 * @param comment - The comment text to analyze
 * @returns Whether `@enum` tag is present
 */
function hasEnumTag(comment: string): boolean {
  if (!comment) return false;
  return /@enum\b/.test(comment);
}

/**
 * Extract release tag from a comment string.
 *
 * @param comment - The comment text to analyze
 * @returns The release tag if found, or undefined
 */
function extractReleaseTag(comment: string): string | undefined {
  if (!comment) return undefined;

  // Match release tags: @public, @internal, @beta, @alpha
  const match = comment.match(/@(public|internal|beta|alpha)\b/);
  return match ? `@${match[1]}` : undefined;
}

/**
 * Get leading comment from an AST node.
 *
 * @param node - The AST node to check
 * @returns The leading comment text, or undefined
 */
function getLeadingComment(node: any): string | undefined {
  if (!node) return undefined;

  // Check for leadingComments array
  if (node.leadingComments && node.leadingComments.length > 0) {
    // Get the last leading comment (closest to the node)
    const comment = node.leadingComments[node.leadingComments.length - 1];
    return comment.value || '';
  }

  // Check for comments property (alternative location)
  if (node.comments && node.comments.length > 0) {
    const comment = node.comments[node.comments.length - 1];
    return comment.value || '';
  }

  return undefined;
}

/**
 * Check if a node is a property within a const enum pattern.
 *
 * @param node - The AST node to check
 * @param commentPath - The comment's AST path
 * @returns Analysis of const enum membership
 */
export function analyzeConstEnumProperty(
  node: any,
  commentPath: AstPath<any>
): {
  isConstEnumProperty: boolean;
  parentHasEnumTag: boolean;
  parentHasReleaseTag: boolean;
  parentReleaseTag?: string;
} {
  const defaultResult = {
    isConstEnumProperty: false,
    parentHasEnumTag: false,
    parentHasReleaseTag: false,
  };

  if (!node || !commentPath) {
    return defaultResult;
  }

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('analyzeConstEnumProperty - Node type:', node.type);
  }

  // Check if this node is a Property
  if (node.type !== 'Property' && node.type !== 'ObjectProperty') {
    return defaultResult;
  }

  // Try to find the parent ObjectExpression
  const parent = commentPath.getParentNode();
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('analyzeConstEnumProperty - Parent type:', parent?.type);
  }

  if (
    !parent ||
    (parent.type !== 'ObjectExpression' && parent.type !== 'ObjectLiteral')
  ) {
    return defaultResult;
  }

  // Try to find the VariableDeclarator that contains this ObjectExpression
  // The hierarchy is typically: VariableDeclarator -> ObjectExpression -> Property
  const grandparent = commentPath.getParentNode(1);
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('analyzeConstEnumProperty - Grandparent type:', grandparent?.type);
  }

  if (!grandparent || grandparent.type !== 'VariableDeclarator') {
    return defaultResult;
  }

  // Look for the VariableDeclaration that contains the declarator
  const greatGrandparent = commentPath.getParentNode(2);
  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog(
      'analyzeConstEnumProperty - Great-grandparent type:',
      greatGrandparent?.type
    );
  }

  let variableDeclaration = greatGrandparent;

  // If the great-grandparent is not VariableDeclaration, try one more level
  // to handle ExportNamedDeclaration wrapping
  if (greatGrandparent?.type === 'VariableDeclaration') {
    variableDeclaration = greatGrandparent;
  } else {
    const greatGreatGrandparent = commentPath.getParentNode(3);
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'analyzeConstEnumProperty - Great-great-grandparent type:',
        greatGreatGrandparent?.type
      );
    }

    if (greatGreatGrandparent?.type === 'ExportNamedDeclaration') {
      // The VariableDeclaration might be in the declaration property
      if (greatGreatGrandparent.declaration?.type === 'VariableDeclaration') {
        variableDeclaration = greatGreatGrandparent.declaration;
      }
    } else if (greatGreatGrandparent?.type === 'VariableDeclaration') {
      variableDeclaration = greatGreatGrandparent;
    }
  }

  // Also check if there's an ExportNamedDeclaration wrapping the VariableDeclaration
  const exportNode = commentPath.getParentNode(3);
  if (exportNode?.type === 'ExportNamedDeclaration' && exportNode.declaration) {
    variableDeclaration = exportNode.declaration;
  }

  if (
    !variableDeclaration ||
    variableDeclaration.type !== 'VariableDeclaration'
  ) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog('analyzeConstEnumProperty - No VariableDeclaration found');
    }
    return defaultResult;
  }

  // Get the comment from the VariableDeclaration or its parent ExportNamedDeclaration
  let parentComment = getLeadingComment(variableDeclaration);

  // If no comment on VariableDeclaration, check ExportNamedDeclaration
  if (!parentComment && exportNode?.type === 'ExportNamedDeclaration') {
    parentComment = getLeadingComment(exportNode);
  }

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog(
      'analyzeConstEnumProperty - Parent comment:',
      parentComment?.substring(0, 100)
    );
  }

  if (!parentComment) {
    return defaultResult;
  }

  // Check for @enum tag
  const hasEnum = hasEnumTag(parentComment);
  if (!hasEnum) {
    return defaultResult;
  }

  // Check for release tag
  const releaseTag = extractReleaseTag(parentComment);

  const result = {
    isConstEnumProperty: true,
    parentHasEnumTag: true,
    parentHasReleaseTag: !!releaseTag,
    parentReleaseTag: releaseTag,
  };

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    debugLog('analyzeConstEnumProperty - Result:', result);
  }

  return result;
}
