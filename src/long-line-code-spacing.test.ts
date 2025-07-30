import { describe, it, expect } from 'vitest';
import { format } from 'prettier';
import TSDocPlugin from './index.js';

describe('Code tag spacing with long lines', () => {
  it('should preserve space after a {@code} tag in a long line', async () => {
    const comment = `/**
 * Let me also add some {@code let x = 1;} code to the example. And is there a problem with \`let y=2;\`
 */`;
    const expected = `/**
 * Let me also add some \`let x = 1;\` code to the example. And is there a problem
 * with \`let y=2;\`
 */
`;
    const formatted = await format(comment, {
      parser: 'typescript',
      plugins: [TSDocPlugin],
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: true,
    });

    expect(formatted).toBe(expected);
  });
});
