import { describe, expect, it, vi } from 'vitest';
import type { Parser } from 'prettier';
import { createAsyncParser } from './parser-wrappers.js';
import type { PrettierOptionsWithTSDoc } from './types.js';

describe('createAsyncParser', () => {
  it('awaits prepareSourceForTSDoc before calling parse', async () => {
    const callOrder: string[] = [];

    const prepare = vi.fn(async (text: string) => {
      callOrder.push(`prepare:${text}`);
      await Promise.resolve();
      return `${text}-prepared`;
    });

    const parse = vi.fn((text: string) => {
      callOrder.push(`parse:${text}`);
      return { ast: text };
    });

    const hasPragma = () => true;
    const hasIgnorePragma = () => false;

    const originalParser: Parser = {
      parse,
      astFormat: 'estree',
      hasPragma,
      hasIgnorePragma,
      locStart: () => 0,
      locEnd: () => 0,
    };

    const asyncParser = createAsyncParser(originalParser, prepare);

    const options = {} as PrettierOptionsWithTSDoc;
    const result = await asyncParser.parse('source-code', options);

    expect(result).toStrictEqual({ ast: 'source-code-prepared' });
    expect(prepare).toHaveBeenCalledOnce();
    expect(parse).toHaveBeenCalledWith('source-code-prepared', options);
    expect(callOrder).toEqual([
      'prepare:source-code',
      'parse:source-code-prepared',
    ]);
    expect(options.originalText).toBe('source-code-prepared');

    expect(asyncParser.astFormat).toBe(originalParser.astFormat);
    expect(asyncParser.hasPragma).toBe(hasPragma);
    expect(asyncParser.hasIgnorePragma).toBe(hasIgnorePragma);
    expect(asyncParser.locStart).toBe(originalParser.locStart);
    expect(asyncParser.locEnd).toBe(originalParser.locEnd);
  });
});
