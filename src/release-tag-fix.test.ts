import { describe, test, expect } from 'vitest';
import { format } from 'prettier';

describe('Release Tag and Example Tag Fixes', () => {
  test('should not duplicate @example tags', async () => {
    const plugin = await import('./index.js');

    const code = `/**
 * A function with an example.
 * @example This is an example
 * \`\`\`typescript
 * const result = test();
 * \`\`\`
 */
function test() {
  return true;
}`;

    const formatted = await format(code, {
      parser: 'typescript',
      plugins: [plugin.default],
    });

    // Should not have duplicated @example tags
    expect(formatted).not.toMatch(/@example.*@example/);
    // Should contain the example content
    expect(formatted).toMatch(/@example This is an example/);
    expect(formatted).toMatch(/const result = test\(\);/);
  });

  test('should handle exported functions with onlyExportedAPI', async () => {
    const plugin = await import('./index.js');

    const code = `/**
 * An exported function.
 */
export function exported() {
  return true;
}

/**
 * A non-exported function.
 */
function internal() {
  return false;
}`;

    const formatted = await format(code, {
      parser: 'typescript',
      plugins: [plugin.default],
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
      },
    });

    // Should add release tag to exported function but not internal function
    expect(formatted).toMatch(/export function exported\(\) \{/);
    expect(formatted).toMatch(/@internal/);

    // Count @internal occurrences - should be exactly 1 (for the exported function)
    const internalMatches = formatted.match(/@internal/g);
    expect(internalMatches).toHaveLength(1);
  });

  test('should handle class members correctly', async () => {
    const plugin = await import('./index.js');

    const code = `/**
 * A class.
 */
export class TestClass {
  /**
   * A method.
   */
  method() {
    return true;
  }
}`;

    const formatted = await format(code, {
      parser: 'typescript',
      plugins: [plugin.default],
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
        inheritanceAware: true,
      },
    });

    // Exported class should get @internal tag, but method should not
    // (because methods inherit from class)
    expect(formatted).toMatch(/@internal/);

    // Should have exactly one @internal tag (on the class, not the method)
    const internalMatches = formatted.match(/@internal/g);
    expect(internalMatches).toHaveLength(1);
  });

  test('should handle multiple @example tags without content loss', async () => {
    const plugin = await import('./index.js');

    const code = `/**
 * Function with HTML example.
 * @example HTML example
 * \`\`\`html
 * <div>Hello</div>
 * \`\`\`
 */
function htmlTest() {
  return '<div>test</div>';
}`;

    const formatted = await format(code, {
      parser: 'typescript',
      plugins: [plugin.default],
    });

    // Should not have duplicated tags
    expect(formatted).not.toMatch(/@example.*@example/);
    // Should contain the formatted HTML
    expect(formatted).toMatch(/<div>/);
    expect(formatted).toMatch(/Hello/);
  });
});
