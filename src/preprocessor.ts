/**
 * Preprocessor for TSDoc comments that integrates with Prettier's parser extension.
 * This module handles AST-aware comment formatting before Prettier processes the AST.
 */

import type { PrettierOptionsWithTSDoc } from './types.js';
import { prepareSourceForTSDocSync } from './tsdoc-preprocess.js';

/**
 * Preprocess TypeScript source code to format TSDoc comments.
 * This function is called by Prettier before parsing the AST.
 */
export function preprocessTypescript(
  text: string,
  options: PrettierOptionsWithTSDoc
): string {
  return prepareSourceForTSDocSync(text, options);
}

/**
 * Preprocess JavaScript source code to format TSDoc comments.
 * Similar to TypeScript preprocessing but for JavaScript files.
 */
export function preprocessJavaScript(
  text: string,
  options: PrettierOptionsWithTSDoc
): string {
  // For JavaScript, we can use the same logic as TypeScript
  // but we might need to handle some differences in the future
  return prepareSourceForTSDocSync(text, options);
}

export { prepareSourceForTSDoc } from './tsdoc-preprocess.js';
export { prepareSourceForTSDocSync } from './tsdoc-preprocess.js';
