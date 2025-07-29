/**
 * Legacy Closure Compiler annotation transformation utilities.
 *
 * This module handles automatic modernization of legacy Google Closure Compiler
 * annotations to standard TSDoc/JSDoc syntax during the formatting process.
 */

/**
 * Configuration for legacy transformations
 */
export interface LegacyTransformOptions {
  /**
   * Whether to enable Closure Compiler compatibility transformations.
   * @defaultValue true
   */
  closureCompilerCompat?: boolean;
}

/**
 * Apply legacy Closure Compiler transformations to raw comment text.
 * This function should be called very early in the formatting pipeline,
 * before TSDoc parsing, to ensure all subsequent logic operates on
 * normalized modern TSDoc comments.
 *
 * @param comment - Raw comment text
 * @param options - Transformation options
 * @returns Transformed comment text
 */
export function applyLegacyTransformations(
  comment: string,
  options: LegacyTransformOptions = {}
): string {
  // If legacy transformations are disabled, return original comment
  if (options.closureCompilerCompat === false) {
    return comment;
  }

  let transformed = comment;

  // Protect code blocks from transformation by replacing them with placeholders
  const { text: protectedText, codeBlocks } = protectCodeBlocks(transformed);
  transformed = protectedText;

  // Apply transformations in order
  transformed = transformVisibilityTags(transformed);
  transformed = transformTypedTags(transformed);
  transformed = transformClassHeritageTags(transformed);
  transformed = transformRedundantTags(transformed);
  transformed = transformSeeTag(transformed);

  // Restore code blocks
  transformed = restoreCodeBlocks(transformed, codeBlocks);

  return transformed;
}

/**
 * Protect code blocks from transformation by replacing them with placeholders
 */
function protectCodeBlocks(comment: string): {
  text: string;
  codeBlocks: string[];
} {
  const codeBlocks: string[] = [];
  let text = comment;

  // Find and replace code blocks with placeholders
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${index}__`;
  });

  return { text, codeBlocks };
}

/**
 * Restore code blocks from placeholders
 */
function restoreCodeBlocks(comment: string, codeBlocks: string[]): string {
  let text = comment;

  for (let i = 0; i < codeBlocks.length; i++) {
    text = text.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
  }

  return text;
}

/**
 * Transform visibility and export tags:
 * - \@export → @public
 * - \@protected → @internal
 * - \@private → @internal
 */
function transformVisibilityTags(comment: string): string {
  let transformed = comment;

  // Transform @export to @public
  transformed = transformed.replace(
    /^(\s*\*\s*)@export(\s|$)/gm,
    '$1@public$2'
  );

  // Transform @protected to @internal
  transformed = transformed.replace(
    /^(\s*\*\s*)@protected(\s|$)/gm,
    '$1@internal$2'
  );

  // Transform @private to @internal
  transformed = transformed.replace(
    /^(\s*\*\s*)@private(\s|$)/gm,
    '$1@internal$2'
  );

  return transformed;
}

/**
 * Transform typed tags by removing the \{type\} portion:
 * - \@param \{type\} name → @param name
 * - @throws \{type\} → @throws
 * - \@this \{type\} → \@this
 */
function transformTypedTags(comment: string): string {
  let transformed = comment;

  // Transform @param {type} name to @param name
  // Handle both regular and optional parameters
  transformed = transformed.replace(
    /^(\s*\*\s*)@param\s+\{[^}]+\}\s+(\[?[^\s\]-]+\]?)/gm,
    '$1@param $2'
  );

  // Transform @throws {type} to @throws (only when type is the only content)
  transformed = transformed.replace(
    /^(\s*\*\s*)@throws\s+\{[^}]+\}\s*$/gm,
    '$1@throws'
  );

  // Transform @this {type} to @this
  transformed = transformed.replace(
    /^(\s*\*\s*)@this\s+\{[^}]+\}/gm,
    '$1@this'
  );

  return transformed;
}

/**
 * Transform class heritage tags by removing them entirely:
 * - \@extends \{type\} → (removed)
 * - \@implements \{type\} → (removed)
 *
 * Note: Only removes annotations with curly-brace syntax.
 * Annotations without braces are preserved as modern TypeDoc overrides.
 */
function transformClassHeritageTags(comment: string): string {
  let transformed = comment;

  // Remove @extends {type} lines entirely
  transformed = transformed.replace(/^\s*\*\s*@extends\s+\{[^}]+\}\s*\n/gm, '');

  // Remove @implements {type} lines entirely
  transformed = transformed.replace(
    /^\s*\*\s*@implements\s+\{[^}]+\}\s*\n/gm,
    ''
  );

  return transformed;
}

/**
 * Transform redundant language and compiler tags by removing them:
 * - \@constructor → (removed)
 * - \@const → (removed)
 * - \@define → (removed)
 * - \@noalias → (removed)
 * - \@nosideeffects → (removed)
 */
function transformRedundantTags(comment: string): string {
  let transformed = comment;

  const redundantTags = [
    'constructor',
    'const',
    'define',
    'noalias',
    'nosideeffects',
  ];

  for (const tag of redundantTags) {
    // Remove the tag line entirely
    const regex = new RegExp(`^\\s*\\*\\s*@${tag}\\s*\\n`, 'gm');
    transformed = transformed.replace(regex, '');
  }

  return transformed;
}

/**
 * Transform @see tag to use \{\@link\} inline tag when appropriate:
 * - @see http://example.com → @see {@link http://example.com}
 * - @see MyClass → @see {@link MyClass}
 * - @see descriptive text → (unchanged)
 */
function transformSeeTag(comment: string): string {
  let transformed = comment;

  // Transform @see with URL
  transformed = transformed.replace(
    /^(\s*\*\s*)@see\s+(https?:\/\/[^\s]+)(\s|$)/gm,
    '$1@see {@link $2}$3'
  );

  // Transform @see with single word (code construct)
  // This matches a single word that doesn't contain whitespace or common sentence indicators
  transformed = transformed.replace(
    /^(\s*\*\s*)@see\s+([^\s{@]+)(.*)$/gm,
    (match, prefix, content, rest) => {
      // Only transform if it's a single word/symbol (no whitespace) and doesn't look like prose
      // Exclude common English words that start sentences and check for typical code patterns
      const proseIndicators =
        /^(also|for|when|if|the|a|an|this|that|these|those|see|check|visit|refer|read|first|second|third|some|many|all|here|there|with|without)\b/i;
      const codePatterns = /^[A-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/; // ClassName, MyNamespace.MyClass, Thing.hello

      if (
        content.trim() &&
        !content.includes(' ') &&
        !proseIndicators.test(content) &&
        (codePatterns.test(content) || /^[a-z][a-zA-Z0-9]*$/.test(content))
      ) {
        return `${prefix}@see {@link ${content}}${rest}`;
      }
      return match;
    }
  );

  return transformed;
}
