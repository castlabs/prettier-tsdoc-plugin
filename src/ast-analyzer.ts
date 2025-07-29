/**
 * AST analyzer for TypeScript code that can detect export contexts
 * and associate TSDoc comments with their declarations.
 */

import * as ts from 'typescript';

export interface CommentContext {
  comment: ts.CommentRange;
  declaration: ts.Declaration | null;
  isExported: boolean;
  isClassMember: boolean;
  container: ts.ClassDeclaration | ts.InterfaceDeclaration | null;
  exportType: 'direct' | 'namespace' | 'default' | 'none';
}

export interface SourceAnalysis {
  sourceFile: ts.SourceFile;
  comments: CommentContext[];
  sourceText: string;
}

/**
 * Analyze TypeScript source code to find TSDoc comments and their contexts.
 */
export function analyzeSourceForTSDoc(
  sourceText: string,
  fileName: string = 'temp.ts'
): SourceAnalysis {
  // Create TypeScript source file
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true // setParentNodes
  );

  // Get all comments from the source file
  const comments = getCommentsFromSourceFile(sourceFile, sourceText);

  // Analyze each comment's context
  const commentContexts: CommentContext[] = comments.map((comment) =>
    analyzeCommentContext(comment, sourceFile)
  );

  return {
    sourceFile,
    comments: commentContexts,
    sourceText,
  };
}

/**
 * Extract all comments from a TypeScript source file.
 */
function getCommentsFromSourceFile(
  sourceFile: ts.SourceFile,
  sourceText: string
): ts.CommentRange[] {
  const comments: ts.CommentRange[] = [];

  // Get leading comments from the source file
  const leadingComments = ts.getLeadingCommentRanges(sourceText, 0);
  if (leadingComments) {
    comments.push(...leadingComments);
  }

  // Walk the AST to find all comments
  function visitNode(node: ts.Node) {
    // Get leading comments for this node
    const nodeLeadingComments = ts.getLeadingCommentRanges(
      sourceText,
      node.getFullStart()
    );
    if (nodeLeadingComments) {
      comments.push(...nodeLeadingComments);
    }

    // Get trailing comments for this node
    const nodeTrailingComments = ts.getTrailingCommentRanges(
      sourceText,
      node.getEnd()
    );
    if (nodeTrailingComments) {
      comments.push(...nodeTrailingComments);
    }

    ts.forEachChild(node, visitNode);
  }

  ts.forEachChild(sourceFile, visitNode);

  // Filter to only TSDoc comments (/** ... */) and deduplicate by position
  const tsdocComments = comments.filter((comment) => {
    if (comment.kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
      return false;
    }
    const commentText = sourceText.substring(comment.pos, comment.end);
    return commentText.startsWith('/**') && commentText.includes('\n');
  });

  // Deduplicate comments by position (pos, end)
  const uniqueComments = new Map<string, ts.CommentRange>();
  for (const comment of tsdocComments) {
    const key = `${comment.pos}-${comment.end}`;
    if (!uniqueComments.has(key)) {
      uniqueComments.set(key, comment);
    }
  }

  return Array.from(uniqueComments.values());
}

/**
 * Analyze the context of a specific comment.
 */
function analyzeCommentContext(
  comment: ts.CommentRange,
  sourceFile: ts.SourceFile
): CommentContext {
  // Find the declaration that follows this comment
  const declaration = findDeclarationAfterComment(comment, sourceFile);

  let isExported = false;
  let exportType: 'direct' | 'namespace' | 'default' | 'none' = 'none';
  let isClassMember = false;
  let container: ts.ClassDeclaration | ts.InterfaceDeclaration | null = null;

  if (declaration) {
    // Check if this declaration is exported
    const exportInfo = analyzeExportStatus(declaration, sourceFile);
    isExported = exportInfo.isExported;
    exportType = exportInfo.exportType;

    // Check if this is a class or interface member
    const memberInfo = analyzeClassMemberStatus(declaration);
    isClassMember = memberInfo.isClassMember;
    container = memberInfo.container;
  }

  return {
    comment,
    declaration,
    isExported,
    isClassMember,
    container,
    exportType,
  };
}

/**
 * Find the declaration that immediately follows a comment.
 */
function findDeclarationAfterComment(
  comment: ts.CommentRange,
  sourceFile: ts.SourceFile
): ts.Declaration | null {
  let foundDeclaration: ts.Declaration | null = null;
  let minDistance = Infinity;

  function visitNode(node: ts.Node) {
    // Check if this node is a declaration
    if (isDeclaration(node)) {
      const declaration = node as ts.Declaration;
      const nodeStart = node.getStart();

      // Check if this declaration comes after the comment
      if (nodeStart > comment.end) {
        const distance = nodeStart - comment.end;
        if (distance < minDistance) {
          minDistance = distance;
          foundDeclaration = declaration;
        }
      }
    }

    ts.forEachChild(node, visitNode);
  }

  ts.forEachChild(sourceFile, visitNode);

  return foundDeclaration;
}

/**
 * Check if a node is a declaration.
 */
function isDeclaration(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/**
 * Analyze the export status of a declaration.
 */
function analyzeExportStatus(
  declaration: ts.Declaration,
  sourceFile: ts.SourceFile
): {
  isExported: boolean;
  exportType: 'direct' | 'namespace' | 'default' | 'none';
} {
  // Check for direct export modifiers
  if (ts.canHaveModifiers(declaration)) {
    const modifiers = ts.getModifiers(declaration);
    if (modifiers) {
      const hasExportModifier = modifiers.some(
        (modifier: ts.Modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );

      if (hasExportModifier) {
        // Check if it's a default export
        const hasDefaultModifier = modifiers.some(
          (modifier: ts.Modifier) =>
            modifier.kind === ts.SyntaxKind.DefaultKeyword
        );

        return {
          isExported: true,
          exportType: hasDefaultModifier ? 'default' : 'direct',
        };
      }
    }
  }

  // Check for export statements that reference this declaration
  const declarationName = getDeclarationName(declaration);
  if (declarationName) {
    let foundExport = false;
    let exportType: 'direct' | 'namespace' | 'default' | 'none' = 'none';

    function visitNode(node: ts.Node) {
      if (ts.isExportDeclaration(node) && node.exportClause) {
        if (ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            if (element.name.text === declarationName) {
              foundExport = true;
              exportType = 'direct';
            }
          }
        }
      } else if (ts.isExportAssignment(node)) {
        // Handle export = or export default
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === declarationName
        ) {
          foundExport = true;
          exportType = node.isExportEquals ? 'namespace' : 'default';
        }
      }

      ts.forEachChild(node, visitNode);
    }

    ts.forEachChild(sourceFile, visitNode);

    if (foundExport) {
      return { isExported: true, exportType };
    }
  }

  return { isExported: false, exportType: 'none' };
}

/**
 * Analyze if a declaration is a class or interface member.
 */
function analyzeClassMemberStatus(declaration: ts.Declaration): {
  isClassMember: boolean;
  container: ts.ClassDeclaration | ts.InterfaceDeclaration | null;
} {
  let parent: ts.Node | undefined = declaration.parent;

  while (parent) {
    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      return {
        isClassMember: true,
        container: parent,
      };
    }
    parent = parent.parent;
  }

  return {
    isClassMember: false,
    container: null,
  };
}

/**
 * Get the name of a declaration.
 */
function getDeclarationName(declaration: ts.Declaration): string | null {
  // Check specific declaration types that have names
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isClassDeclaration(declaration) ||
    ts.isInterfaceDeclaration(declaration) ||
    ts.isTypeAliasDeclaration(declaration) ||
    ts.isEnumDeclaration(declaration) ||
    ts.isModuleDeclaration(declaration)
  ) {
    if (declaration.name && ts.isIdentifier(declaration.name)) {
      return declaration.name.text;
    }
  } else if (ts.isVariableDeclaration(declaration)) {
    if (ts.isIdentifier(declaration.name)) {
      return declaration.name.text;
    }
  } else if (
    ts.isMethodDeclaration(declaration) ||
    ts.isPropertyDeclaration(declaration) ||
    ts.isGetAccessorDeclaration(declaration) ||
    ts.isSetAccessorDeclaration(declaration)
  ) {
    if (declaration.name && ts.isIdentifier(declaration.name)) {
      return declaration.name.text;
    }
  }

  return null;
}

/**
 * Replace comments in source text while preserving positions.
 */
export function replaceCommentsInSource(
  sourceText: string,
  commentReplacements: Array<{
    comment: ts.CommentRange;
    newContent: string;
  }>
): string {
  // Sort replacements by position (descending) to avoid position shifts
  const sortedReplacements = [...commentReplacements].sort(
    (a, b) => b.comment.pos - a.comment.pos
  );

  let result = sourceText;

  for (const replacement of sortedReplacements) {
    const { comment, newContent } = replacement;

    // Replace the comment content
    result =
      result.substring(0, comment.pos) +
      newContent +
      result.substring(comment.end);
  }

  return result;
}
