import type { Parser } from 'prettier';
import type { PrettierOptionsWithTSDoc } from './types.js';

type AsyncPrepareFn = (
  text: string,
  options: PrettierOptionsWithTSDoc
) => Promise<string>;

/**
 * Wraps a Prettier parser so preprocessing can run inside the parse flow.
 * The preprocess hook remains exported for compatibility, but parser
 * registration now relies on this async-aware wrapper.
 */
export function createAsyncParser<T = any>(
  originalParser: Parser<T>,
  prepareSourceForTSDoc: AsyncPrepareFn
): Parser<T> {
  const { preprocess: _unusedPreprocess, ...rest } = originalParser;

  return {
    ...rest,
    async parse(text: string, options: PrettierOptionsWithTSDoc) {
      const prepared = await prepareSourceForTSDoc(text, options);
      options.originalText = prepared;
      return originalParser.parse(prepared, options);
    },
    astFormat: originalParser.astFormat,
    hasPragma: originalParser.hasPragma,
    hasIgnorePragma: originalParser.hasIgnorePragma,
    locStart: originalParser.locStart,
    locEnd: originalParser.locEnd,
  };
}
