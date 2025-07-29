/**
 * Tests for Phase 110 - Newline and Tag Group Management
 *
 * This file tests:
 * 1. Blank lines before @example tags
 * 2. Canonical tag ordering when normalizeTagOrder is enabled
 * 3. Tag group definitions and ordering logic
 */

import { describe, it, expect } from 'vitest';
import { format } from 'prettier';
import plugin from './index.js';

const formatTSDoc = (code: string, options: any = {}) => {
  return format(code, {
    parser: 'typescript',
    plugins: [plugin],
    printWidth: 80,
    ...options,
  });
};

describe('Phase 110 - Newline and Tag Management', () => {
  describe('Blank Line Before Examples', () => {
    it('should add blank line before single @example tag', async () => {
      const input = `
/**
 * A simple function.
 * @param name The name to greet.
 * @returns A greeting string.
 * @example
 * \`\`\`ts
 * aSimpleFunction('world'); // "Hello, world"
 * \`\`\`
 */
function aSimpleFunction(name: string): string {
  return \`Hello, \${name}\`;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      expect(result).toContain(
        '* @returns A greeting string.\n *\n * @example'
      );
    });

    it('should add blank line before multiple @example tags', async () => {
      const input = `
/**
 * A function with multiple examples.
 * @param input The string to process.
 * @returns A processed string.
 * @example
 * **Basic Usage**
 * \`\`\`ts
 * multiExample('test');
 * \`\`\`
 * @example
 * **Advanced Usage**
 * \`\`\`ts
 * multiExample('test', { advanced: true });
 * \`\`\`
 */
function multiExample(input: string): string {
  return input;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      // Should have blank lines before both @example tags
      expect(result).toContain(
        '* @returns A processed string.\n *\n * @example'
      );
      expect(result).toContain('* ```\n *\n * @example');
    });

    it("should add blank line before @example even when it's the only other tag", async () => {
      const input = `
/**
 * A simple function with only example.
 * @example
 * \`\`\`ts
 * simpleFunction();
 * \`\`\`
 */
function simpleFunction(): void {}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      expect(result).toContain(
        '* A simple function with only example.\n *\n * @example'
      );
    });
  });

  describe('Canonical Tag Ordering', () => {
    it('should reorder tags according to canonical order', async () => {
      const input = `
/**
 * A more complex function.
 * @see https://example.com for more info.
 * @beta
 * @example
 * \`\`\`ts
 * aComplexFunction(1, 2);
 * \`\`\`
 * @throws {Error} If the input is invalid.
 * @returns The result of the operation.
 * @param a The first number.
 * @deprecated Use \`newShinyFunction\` instead.
 * @param b The second number.
 */
function aComplexFunction(a: number, b: number): number {
  return a + b;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      // Expected order: @param, @returns, @throws, @deprecated, @see, @beta, @example
      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      expect(tagLines[0]).toContain('@param a');
      expect(tagLines[1]).toContain('@param b');
      expect(tagLines[2]).toContain('@returns');
      expect(tagLines[3]).toContain('@throws');
      expect(tagLines[4]).toContain('@deprecated');
      expect(tagLines[5]).toContain('@see');
      expect(tagLines[6]).toContain('@beta');
      expect(tagLines[7]).toContain('@example');
    });

    it('should preserve tag order when normalizeTagOrder is false', async () => {
      const input = `
/**
 * A function with mixed tags.
 * @see First reference.
 * @deprecated Old function.
 * @see Second reference.
 * @param x The input.
 */
function testFunction(x: number): number {
  return x;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: false });

      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      // TSDoc structure is preserved (@param first, then other tags in original category order)
      // The exact cross-category order cannot be preserved due to TSDoc parsing structure,
      // but within the same tag category, order is preserved
      expect(tagLines[0]).toContain('@param');
      expect(tagLines[1]).toContain('@deprecated'); // Special block, processed first
      expect(tagLines[2]).toContain('@see First reference'); // See blocks, in original order
      expect(tagLines[3]).toContain('@see Second reference');
    });

    it('should group @param and @typeParam tags together', async () => {
      const input = `
/**
 * Generic function.
 * @returns The result.
 * @typeParam T The type parameter.
 * @param value The input value.
 * @typeParam U Another type parameter.
 * @param config The configuration.
 */
function genericFunction<T, U>(value: T, config: U): T {
  return value;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      // Should group all params/typeParams first, then returns
      expect(tagLines[0]).toContain('@param value');
      expect(tagLines[1]).toContain('@param config');
      expect(tagLines[2]).toContain('@typeParam T');
      expect(tagLines[3]).toContain('@typeParam U');
      expect(tagLines[4]).toContain('@returns');
    });

    it('should place release tags in correct position', async () => {
      const input = `
/**
 * API function.
 * @example
 * \`\`\`ts
 * apiFunction();
 * \`\`\`
 * @param input The input.
 * @public
 * @returns The output.
 * @internal
 */
function apiFunction(input: string): string {
  return input;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      // Expected order: @param, @returns, release tags (@public, @internal), @example
      expect(tagLines[0]).toContain('@param');
      expect(tagLines[1]).toContain('@returns');
      expect(tagLines[2]).toContain('@public');
      expect(tagLines[3]).toContain('@internal');
      expect(tagLines[4]).toContain('@example');
    });
  });

  describe('Tag Group Priority Logic', () => {
    it('should handle @throws tags in correct position', async () => {
      const input = `
/**
 * Function that might throw.
 * @returns The result.
 * @throws {Error} When something goes wrong.
 * @param input The input.
 * @throws {TypeError} When type is wrong.
 */
function throwingFunction(input: any): string {
  return String(input);
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      // Expected order: @param, @returns, @throws (multiple @throws should maintain relative order)
      expect(tagLines[0]).toContain('@param');
      expect(tagLines[1]).toContain('@returns');
      expect(tagLines[2]).toContain('@throws {Error}');
      expect(tagLines[3]).toContain('@throws {TypeError}');
    });

    it('should place @deprecated in correct position', async () => {
      const input = `
/**
 * Old function.
 * @returns Something.
 * @deprecated Use newFunction instead.
 * @param x Input.
 * @see NewFunction
 */
function oldFunction(x: number): number {
  return x;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      // Expected order: @param, @returns, @deprecated, @see
      expect(tagLines[0]).toContain('@param');
      expect(tagLines[1]).toContain('@returns');
      expect(tagLines[2]).toContain('@deprecated');
      expect(tagLines[3]).toContain('@see');
    });

    it('should handle mixed block and modifier tags correctly', async () => {
      const input = `
/**
 * Function with mixed tags.
 * @returns The result.
 * @param input The input.
 * @beta
 * @example
 * \`\`\`ts
 * mixedFunction('test');
 * \`\`\`
 * @see https://example.com
 */
function mixedFunction(input: string): string {
  return input;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      // Expected order: @param, @returns, @see, @beta, @example
      expect(tagLines[0]).toContain('@param');
      expect(tagLines[1]).toContain('@returns');
      expect(tagLines[2]).toContain('@see');
      expect(tagLines[3]).toContain('@beta');
      expect(tagLines[4]).toContain('@example');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tags correctly', async () => {
      const input = `
/**
 * Function with empty tags.
 * @deprecated
 * @param input The input.
 * @internal
 * @example
 * \`\`\`ts
 * emptyTagFunction('test');
 * \`\`\`
 */
function emptyTagFunction(input: string): void {}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      expect(result).toContain('@param input');
      expect(result).toContain('@deprecated');
      expect(result).toContain('@internal');
      expect(result).toContain('@example');
    });

    it('should handle only @example tags', async () => {
      const input = `
/**
 * Function with only examples.
 * @example
 * First example.
 * @example  
 * Second example.
 */
function onlyExamples(): void {}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      // Should have blank lines before both examples
      expect(result).toContain(
        '* Function with only examples.\n *\n * @example'
      );

      // Count the number of @example tags - should be 2
      const exampleMatches = result.match(/ \* @example/g);
      expect(exampleMatches).toHaveLength(2);

      // Verify blank line structure
      expect(result).toMatch(
        /\* Function with only examples\.\n \*\n \* @example/
      );
    });

    it('should work with mixed content and examples', async () => {
      const input = `
/**
 * Complex function with everything.
 * 
 * Some additional description here.
 * @param a First param.
 * @param b Second param.
 * @returns The sum.
 * @throws {Error} On error.
 * @deprecated Use newAdd instead.
 * @see https://example.com
 * @beta
 * @example
 * Basic usage:
 * \`\`\`ts
 * add(1, 2); // returns 3
 * \`\`\`
 * @example
 * Advanced usage:
 * \`\`\`ts
 * const result = add(x, y);
 * \`\`\`
 */
function add(a: number, b: number): number {
  return a + b;
}
`;

      const result = await formatTSDoc(input, { normalizeTagOrder: true });

      // Verify the canonical order is maintained
      const lines = result.split('\n');
      const tagLines = lines.filter((line) => line.includes(' * @'));

      expect(tagLines[0]).toContain('@param a');
      expect(tagLines[1]).toContain('@param b');
      expect(tagLines[2]).toContain('@returns');
      expect(tagLines[3]).toContain('@throws');
      expect(tagLines[4]).toContain('@deprecated');
      expect(tagLines[5]).toContain('@see');
      expect(tagLines[6]).toContain('@beta');
      expect(tagLines[7]).toContain('@example');

      // Verify blank lines before examples
      expect(result).toContain('@beta\n *\n * @example');
      expect(result).toContain('* ```\n *\n * @example');
    });
  });
});
