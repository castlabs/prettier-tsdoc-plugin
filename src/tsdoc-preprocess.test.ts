import { describe, expect, it, vi } from 'vitest';
import {
  prepareSourceForTSDoc,
  prepareSourceForTSDocSync,
} from './tsdoc-preprocess.js';
import type { PrettierOptionsWithTSDoc } from './types.js';

const baseOptions = {
  tsdoc: {},
  logger: { warn: vi.fn(), debug: vi.fn() },
} as unknown as PrettierOptionsWithTSDoc;

describe('prepareSourceForTSDoc helpers', () => {
  it('returns the original source when no TSDoc comments are present', async () => {
    const source = 'const answer = 42;';

    const syncResult = prepareSourceForTSDocSync(source, baseOptions);
    expect(syncResult).toBe(source);

    const asyncResult = await prepareSourceForTSDoc(source, baseOptions);
    expect(asyncResult).toBe(source);
  });

  it('does not mutate string literals that contain "=" characters', async () => {
    const source = `
/**
 * @example This is an example
 * \`\`\`typescript
 * const beacon: TrackingBeacon = {
 *   type: 'start',
 *   url: 'https://tracking.example.com/start?id=[AD_ID]&cb=[CACHE_BUSTER]'
 * };
 * \`\`\`
 */
export const beacon = {};
`.trimStart();

    const syncResult = prepareSourceForTSDocSync(source, baseOptions);
    expect(syncResult).toBe(source);

    const asyncResult = await prepareSourceForTSDoc(source, baseOptions);
    expect(asyncResult).toContain('id=[AD_ID]');
    expect(asyncResult).toContain('cb=[CACHE_BUSTER]');
    expect(asyncResult).not.toContain('id = [AD_ID]');
    expect(asyncResult).not.toContain('cb = [CACHE_BUSTER]');
  });
});
