import { describe, expect, it } from 'vitest';
import type { ParserOptions } from 'prettier';
import { formatEmbeddedCode } from './formatter.js';

describe('formatEmbeddedCode', () => {
  it('falls back to trimmed snippet when prettier throws', async () => {
    const invalidSnippet = 'const = ;';

    const result = await formatEmbeddedCode({
      code: invalidSnippet,
      language: 'typescript',
      parentOptions: {} as ParserOptions<any>,
    });

    expect(result).toBe('const = ;');
  });

  it('formats supported languages when embedded formatting is auto', async () => {
    const result = await formatEmbeddedCode({
      code: 'const value   =   42;\n',
      language: 'typescript',
      parentOptions: {} as ParserOptions<any>,
      embeddedLanguageFormatting: 'auto',
    });

    expect(result).toBe('const value = 42;');
  });

  it('skips formatting when embedded formatting is disabled', async () => {
    const result = await formatEmbeddedCode({
      code: 'const value   =   42;\n',
      language: 'typescript',
      parentOptions: {} as ParserOptions<any>,
      embeddedLanguageFormatting: 'off',
    });

    expect(result).toBe('const value   =   42;');
  });
});
