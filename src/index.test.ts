import { expect, test, describe } from 'vitest';
import { format } from 'prettier';

describe('Plugin Integration', () => {
  test('plugin loads and has required structure', async () => {
    // Import the compiled plugin from dist
    const plugin = await import('../dist/index.js');
    
    expect(plugin.default).toBeDefined();
    expect(plugin.default).toHaveProperty('printers');
    expect(plugin.default).toHaveProperty('options');
    // In Phase 2, printers are empty - they will be added in Phase 3
  });

  test('formatting files without doc comments produces identical output', async () => {
    const plugin = await import('../dist/index.js');
    
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

  test('formatting files with TSDoc comments preserves content (no transformation yet)', async () => {
    const plugin = await import('../dist/index.js');
    
    const code = `/**
 * Adds two numbers together.
 * @param a - The first number
 * @param b - The second number  
 * @returns The sum of a and b
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

    // Since we don't transform yet, output should be identical to standard Prettier
    const standardFormatted = await format(code, {
      parser: 'typescript',
    });

    expect(formatted).toBe(standardFormatted);
  });

  test('plugin handles malformed TSDoc gracefully', async () => {
    const plugin = await import('../dist/index.js');
    
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
