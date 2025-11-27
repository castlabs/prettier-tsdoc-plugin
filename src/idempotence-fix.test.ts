import { describe, it, expect } from 'vitest';
import { format } from 'prettier';

/**
 * Format TypeScript code with TSDoc plugin.
 */
async function formatCode(
  code: string,
  options: {
    tsdoc?: Record<string, any>;
    parser?: string;
    printWidth?: number;
  } = {}
): Promise<string> {
  const plugin = await import('./index.js');
  return format(code, {
    parser: options.parser || 'typescript',
    plugins: [plugin.default],
    printWidth: options.printWidth || 80,
    ...options,
  });
}

describe('Release Tag Inheritance - Idempotence Fix', () => {
  it('should preserve explicit @internal tags in @public interfaces across multiple runs', async () => {
    const input = `
/**
 * Public interface
 * @public
 */
export interface TestInterface {
  /**
   * Property that should stay @internal
   * @internal
   */
  internalProp: string;

  /**
   * Property without explicit tag (should inherit)
   */
  publicProp: string;
}
`;

    const firstRun = await formatCode(input, {
      tsdoc: {
        defaultReleaseTag: '@internal',
        inheritanceAware: true,
      },
    });

    const secondRun = await formatCode(firstRun, {
      tsdoc: {
        defaultReleaseTag: '@internal',
        inheritanceAware: true,
      },
    });

    // Both runs should produce identical results
    expect(firstRun).toBe(secondRun);

    // The explicit @internal tag should be preserved
    expect(firstRun).toContain('@internal');

    // Count the @internal tags - should be consistent
    const internalCount = (firstRun.match(/@internal/g) || []).length;
    expect(internalCount).toBe(1); // Only the explicit one
  });

  it('should handle complex interface with mixed explicit @internal tags - reproduces release-annotations.ts issue', async () => {
    // This replicates the exact structure that causes issues in release-annotations.ts
    const input = `
/**
 * Event payload
 * @public
 */
export interface TestEvent {
  /**
   * Property without explicit tag
   */
  normalProp: string;

  /**
   * The playback position (in seconds) when this beacon was triggered. This value
   * should be accurate to within ±50ms of the actual currentTime.
   * @internal
   */
  playbackPosition: number;

  /**
   * Another property without tag
   */
  anotherProp: string;

  /**
   * Current playback position within the creative (seconds, relative to creative
   * start).
   * @internal
   */
  position: number;
}
`;

    const firstRun = await formatCode(input, {
      tsdoc: {
        defaultReleaseTag: '@internal',
        inheritanceAware: true,
      },
    });

    const secondRun = await formatCode(firstRun, {
      tsdoc: {
        defaultReleaseTag: '@internal',
        inheritanceAware: true,
      },
    });

    const thirdRun = await formatCode(secondRun, {
      tsdoc: {
        defaultReleaseTag: '@internal',
        inheritanceAware: true,
      },
    });

    // All runs should produce identical results
    expect(firstRun).toBe(secondRun);
    expect(secondRun).toBe(thirdRun);

    // Both explicit @internal tags should be preserved
    const internalCount = (firstRun.match(/@internal/g) || []).length;
    expect(internalCount).toBe(2); // The two explicit @internal tags

    // Verify specific properties have their tags
    expect(firstRun).toMatch(/playbackPosition.*@internal/s);
    expect(firstRun).toMatch(/position.*@internal/s);
  });
});
