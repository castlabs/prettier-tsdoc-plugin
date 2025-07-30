import { describe, it, expect } from 'vitest';
import { parse, buildCommentModel } from './test-utils.js';
import type { OtherTag } from './types.js';

describe('fileoverview transformation', () => {
  it('should transform @fileoverview to @packageDocumentation and move content to summary', () => {
    const comment = `/**
 * @fileoverview This is the file overview.
 * It has multiple lines.
 */`;
    const parsed = parse(comment);
    const model = buildCommentModel(parsed.docComment);

    expect(model.summary?.content).toBe(
      'This is the file overview.\nIt has multiple lines.'
    );
    expect(
      model.otherTags.some(
        (tag: OtherTag) => tag.tagName === '@packageDocumentation'
      )
    ).toBe(true);
    expect(
      model.otherTags.some((tag: OtherTag) => tag.tagName === '@fileoverview')
    ).toBe(false);
  });
});
