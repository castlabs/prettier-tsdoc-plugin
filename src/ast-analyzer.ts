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
  isConstEnumProperty: boolean;
  constEnumHasReleaseTag: boolean;
  constEnumReleaseTag?: string;
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

  let isConstEnumProperty = false;
  let constEnumHasReleaseTag = false;
  let constEnumReleaseTag: string | undefined;

  if (declaration) {
    // Check if this declaration is exported
    const exportInfo = analyzeExportStatus(declaration, sourceFile);
    isExported = exportInfo.isExported;
    exportType = exportInfo.exportType;

    // Check if this is a class or interface member
    const memberInfo = analyzeClassMemberStatus(declaration);
    isClassMember = memberInfo.isClassMember;
    container = memberInfo.container;

    // Check if this is a const enum property
    const constEnumInfo = analyzeConstEnumProperty(
      declaration,
      comment,
      sourceFile
    );
    isConstEnumProperty = constEnumInfo.isConstEnumProperty;
    constEnumHasReleaseTag = constEnumInfo.parentHasReleaseTag;
    constEnumReleaseTag = constEnumInfo.parentReleaseTag;
  }

  return {
    comment,
    declaration,
    isExported,
    isClassMember,
    container,
    exportType,
    isConstEnumProperty,
    constEnumHasReleaseTag,
    constEnumReleaseTag,
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
    ts.isSetAccessorDeclaration(node) ||
    ts.isPropertyAssignment(node) // Add support for object literal properties
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

  // For VariableDeclaration, check the parent VariableStatement for export modifier
  if (ts.isVariableDeclaration(declaration)) {
    const parent = declaration.parent;
    if (parent && ts.isVariableDeclarationList(parent)) {
      const grandparent = parent.parent;
      if (grandparent && ts.isVariableStatement(grandparent)) {
        if (ts.canHaveModifiers(grandparent)) {
          const modifiers = ts.getModifiers(grandparent);
          if (modifiers) {
            const hasExportModifier = modifiers.some(
              (modifier: ts.Modifier) =>
                modifier.kind === ts.SyntaxKind.ExportKeyword
            );

            if (hasExportModifier) {
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

/**
 * Analyze if a declaration is a property within a const enum pattern.
 * A const enum is a const object with `@enum` annotation and a release tag.
 */
function analyzeConstEnumProperty(
  declaration: ts.Declaration,
  _comment: ts.CommentRange,
  sourceFile: ts.SourceFile
): {
  isConstEnumProperty: boolean;
  parentHasReleaseTag: boolean;
  parentReleaseTag?: string;
} {
  const defaultResult = {
    isConstEnumProperty: false,
    parentHasReleaseTag: false,
  };

  if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
    console.log(
      '[TSDoc Plugin] Analyzing const enum property, declaration kind:',
      ts.SyntaxKind[declaration.kind]
    );
  }

  // Check if this is a property declaration
  if (!ts.isPropertyAssignment(declaration)) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      console.log('[TSDoc Plugin] Not a PropertyAssignment, skipping');
    }
    return defaultResult;
  }

  // Try to find the parent object literal
  let parent: ts.Node | undefined = declaration.parent;
  if (!parent || !ts.isObjectLiteralExpression(parent)) {
    return defaultResult;
  }

  // Move up to find the variable declarator containing this object literal
  parent = parent.parent;

  if (!parent || !ts.isVariableDeclaration(parent)) {
    return defaultResult;
  }

  const variableDeclaration = parent;

  // Find the variable declaration list
  parent = parent.parent;
  if (!parent || !ts.isVariableDeclarationList(parent)) {
    return defaultResult;
  }

  const variableDeclarationList = parent;

  // Check if it's a const declaration
  if (
    !(variableDeclarationList.flags & ts.NodeFlags.Const) &&
    !(variableDeclarationList.flags & ts.NodeFlags.Let)
  ) {
    return defaultResult;
  }

  // Find the variable statement
  parent = parent.parent;
  let variableStatement: ts.VariableStatement | null = null;
  if (parent && ts.isVariableStatement(parent)) {
    variableStatement = parent;
  }

  // The comment for the const enum would be attached to the variable statement
  // Get the source text and find comments
  const sourceText = sourceFile.getFullText();

  // Get the start position of the variable statement or the first variable declaration
  const searchNode = variableStatement || variableDeclaration;
  const nodeStart = searchNode.getFullStart();

  // Get leading comments for this node
  const leadingComments = ts.getLeadingCommentRanges(sourceText, nodeStart);

  if (!leadingComments || leadingComments.length === 0) {
    return defaultResult;
  }

  // Get the last leading comment (closest to the declaration)
  const parentComment = leadingComments[leadingComments.length - 1];
  const parentCommentText = sourceText.substring(
    parentComment.pos,
    parentComment.end
  );

  // Check if the parent comment has @enum tag
  if (!/@enum\b/.test(parentCommentText)) {
    return defaultResult;
  }

  // Check if the parent comment has a release tag
  const releaseTagMatch = parentCommentText.match(
    /@(public|internal|beta|alpha)\b/
  );

  return {
    isConstEnumProperty: true,
    parentHasReleaseTag: !!releaseTagMatch,
    parentReleaseTag: releaseTagMatch ? `@${releaseTagMatch[1]}` : undefined,
  };
}
