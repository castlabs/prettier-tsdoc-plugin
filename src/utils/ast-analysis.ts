/**
 * AST analysis utilities for detecting exported declarations and container inheritance.
 * 
 * This module provides functions to analyze TypeScript AST nodes to determine:
 * - Whether a declaration is exported
 * - Whether a comment belongs to a class/interface member (inherits release tag)
 * - Namespace member inheritance rules
 */

import type { AstPath } from 'prettier';

export interface ExportAnalysis {
  isExported: boolean;
  exportType: 'named' | 'default' | 'namespace' | 'none';
  isContainerMember: boolean;
  containerType?: 'class' | 'interface' | 'namespace';
  shouldInheritReleaseTag: boolean;
}

/**
 * Analyze the AST context around a comment to determine if it needs a release tag.
 * 
 * @param commentPath - Prettier AST path for the comment
 * @returns Analysis result with export and inheritance information
 */
export function analyzeCommentContext(commentPath: AstPath<any>): ExportAnalysis {
  try {
    // Get the parent node that this comment is attached to
    const parentNode = getCommentParent(commentPath);
    
    if (!parentNode) {
      return createDefaultAnalysis();
    }

    // Analyze export status
    const exportInfo = analyzeExportStatus(parentNode, commentPath);
    
    // Analyze container inheritance
    const inheritanceInfo = analyzeContainerInheritance(parentNode, commentPath);
    
    return {
      isExported: exportInfo.isExported,
      exportType: exportInfo.exportType,
      isContainerMember: inheritanceInfo.isContainerMember,
      containerType: inheritanceInfo.containerType,
      shouldInheritReleaseTag: inheritanceInfo.shouldInherit,
    };
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
function analyzeExportStatus(node: any, commentPath: AstPath<any>): {
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
  if (node.modifiers?.some((mod: any) => mod.type === 'Keyword' && mod.value === 'export')) {
    return { isExported: true, exportType: 'named' };
  }

  // Check for namespace exports
  if (isWithinExportedNamespace(node, commentPath)) {
    return { isExported: true, exportType: 'namespace' };
  }

  // Check for ambient module declarations (declare module)
  if (isWithinAmbientModule(node, commentPath)) {
    return { isExported: true, exportType: 'namespace' };
  }

  return { isExported: false, exportType: 'none' };
}

/**
 * Analyze container inheritance (class/interface members inherit from container).
 */
function analyzeContainerInheritance(node: any, commentPath: AstPath<any>): {
  isContainerMember: boolean;
  containerType?: 'class' | 'interface' | 'namespace';
  shouldInherit: boolean;
} {
  if (!node) {
    return { isContainerMember: false, shouldInherit: false };
  }

  // Check if this is a class member
  const classContainer = findContainerOfType(node, commentPath, ['ClassDeclaration', 'ClassExpression']);
  if (classContainer) {
    return {
      isContainerMember: true,
      containerType: 'class',
      shouldInherit: true,
    };
  }

  // Check if this is an interface member
  const interfaceContainer = findContainerOfType(node, commentPath, ['TSInterfaceDeclaration']);
  if (interfaceContainer) {
    return {
      isContainerMember: true,
      containerType: 'interface',
      shouldInherit: true,
    };
  }

  // Check if this is a namespace member
  const namespaceContainer = findContainerOfType(node, commentPath, [
    'TSModuleDeclaration',
    'ModuleDeclaration',
  ]);
  if (namespaceContainer) {
    return {
      isContainerMember: true,
      containerType: 'namespace',
      shouldInherit: true,
    };
  }

  return { isContainerMember: false, shouldInherit: false };
}

/**
 * Find a container of specific types in the AST hierarchy.
 * 
 * This is a simplified approach since we can't easily traverse up the AST.
 * We'll check immediate parents and common patterns.
 */
function findContainerOfType(node: any, commentPath: AstPath<any>, containerTypes: string[]): any {
  try {
    // Check the immediate parent
    const parent = commentPath.getParentNode();
    if (!parent) return null;
    
    if (containerTypes.includes(parent.type)) {
      return parent;
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
function isWithinExportedNamespace(node: any, commentPath: AstPath<any>): boolean {
  const namespaceContainer = findContainerOfType(node, commentPath, [
    'TSModuleDeclaration',
    'ModuleDeclaration',
  ]);
  
  if (!namespaceContainer) return false;
  
  // Check if the namespace itself is exported
  return namespaceContainer.modifiers?.some((mod: any) => 
    mod.type === 'Keyword' && mod.value === 'export'
  ) || false;
}

/**
 * Check if a node is within an ambient module declaration.
 */
function isWithinAmbientModule(node: any, commentPath: AstPath<any>): boolean {
  const moduleContainer = findContainerOfType(node, commentPath, [
    'TSModuleDeclaration',
    'ModuleDeclaration',
  ]);
  
  if (!moduleContainer) return false;
  
  // Check for declare keyword
  return moduleContainer.declare === true ||
    moduleContainer.modifiers?.some((mod: any) => 
      mod.type === 'Keyword' && mod.value === 'declare'
    ) || false;
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