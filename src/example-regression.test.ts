import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { format } from 'prettier';

const thisDir = dirname(fileURLToPath(import.meta.url));
const exampleSourcePath = resolve(thisDir, '../example/src/index.ts');

describe('example project regression', () => {
  it('formats the example snippet without changes', async () => {
    const plugin = await import('./index.js');
    const source = await readFile(exampleSourcePath, 'utf8');

    const formattedWithAsyncParser = await format(source, {
      parser: 'typescript',
      filepath: exampleSourcePath,
      plugins: [plugin.default],
    });

    const reformatted = await format(formattedWithAsyncParser, {
      parser: 'typescript',
      filepath: exampleSourcePath,
      plugins: [plugin.default],
    });

    expect(reformatted).toBe(formattedWithAsyncParser);
  });
});
