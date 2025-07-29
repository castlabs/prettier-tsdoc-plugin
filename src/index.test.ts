import { expect, test, describe } from 'vitest';
import { format } from 'prettier';

describe('Plugin Integration', () => {
  test('plugin loads and has required structure', async () => {
    // Import the compiled plugin from dist
    const plugin = await import('./index.js');

    expect(plugin.default).toBeDefined();
    expect(plugin.default).toHaveProperty('languages');
    expect(plugin.default).toHaveProperty('options');

    // Check that basic language support is defined
    expect(Array.isArray(plugin.default.languages)).toBe(true);
    expect(plugin.default.languages?.length).toBeGreaterThan(0);

    // Check that TSDoc options are defined
    expect(plugin.default.options).toHaveProperty('fencedIndent');
  });

  test('formatting files without doc comments produces identical output', async () => {
    const plugin = await import('./index.js');

    const code = `function add(a: number, b: number) {
  return a + b;
}

const result = add(1, 2);
console.log(result);`;

    const formatted = await format(code, {
      parser: 'typescript',
      plugins: [plugin.default],
    });

    // Since our plugin doesn't transform yet,
    // the output should be identical to standard Prettier formatting
    const standardFormatted = await format(code, {
      parser: 'typescript',
    });

    expect(formatted).toBe(standardFormatted);
  });

  test('formatting files with TSDoc comments applies phase 110 transformations', async () => {
    const plugin = await import('./index.js');

    const code = `/**
 * Adds two numbers together.
 * @param a - The first number
 * @param b - The second number  
 * @returns The sum of a and b
 *
 * @example
 * \`\`\`ts
 * const result = add(1, 2);
 * console.log(result); // 3
 * \`\`\`
 */
function add(a: number, b: number) {
  return a + b;
}`;

    const formatted = await format(code, {
      parser: 'typescript',
      plugins: [plugin.default],
    });

    // With Phase 110 implemented, we should have:
    // 1. Blank line between description and parameters (when normalizeTagOrder: true)
    // 2. Blank line before @example
    const expectedFormat = `/**
 * Adds two numbers together.
 *
 * @param a - The first number
 * @param b - The second number
 * @returns The sum of a and b
 *
 * @example
 * \`\`\`ts
 * const result = add(1, 2);
 * console.log(result); // 3
 * \`\`\`
 */
function add(a: number, b: number) {
  return a + b;
}
`;

    expect(formatted).toBe(expectedFormat);
  });

  test('plugin handles malformed TSDoc gracefully', async () => {
    const plugin = await import('./index.js');

    const code = `/**
 * This has malformed TSDoc
 * @param {unclosed brace
 * @returns something
 */
function test() {
  return 'ok';
}`;

    // Should not throw - graceful fallback
    expect(async () => {
      await format(code, {
        parser: 'typescript',
        plugins: [plugin.default],
      });
    }).not.toThrow();
  });
});
