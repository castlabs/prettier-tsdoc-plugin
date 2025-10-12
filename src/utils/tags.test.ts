import { expect, test, describe } from 'vitest';
import {
  splitParamTag,
  computeColumnWidths,
  printAligned,
  formatReturnsTag,
  groupParameterTags,
  ParamTagInfo,
} from './tags.js';

describe('Tag Utilities', () => {
  test('splits parameter tag correctly', () => {
    const mockNode = {
      parameterName: 'userName',
      content: {
        kind: 'PlainText',
        text: 'The user name parameter',
      },
    };

    const result = splitParamTag(mockNode);
    expect(result.name).toBe('userName');
    expect(result.desc).toBe('The user name parameter');
  });

  test('handles empty parameter tag', () => {
    const result = splitParamTag(null);
    expect(result.name).toBe('');
    expect(result.desc).toBe('');
  });

  test('computes column widths correctly', () => {
    const tags: ParamTagInfo[] = [
      {
        tagName: 'param',
        name: 'a',
        description: 'Short param',
        rawNode: null,
      },
      {
        tagName: 'param',
        name: 'veryLongParameterName',
        description: 'Long param',
        rawNode: null,
      },
      { tagName: 'param', name: 'b', description: '', rawNode: null }, // No description
    ];

    const width = computeColumnWidths(tags);
    // Longest should be "@param veryLongParameterName - " = 31 chars
    expect(width).toBe(31);
  });

  test('prints aligned parameters', () => {
    const tags: ParamTagInfo[] = [
      {
        tagName: 'param',
        name: 'a',
        description: 'Short param',
        rawNode: null,
      },
      {
        tagName: 'param',
        name: 'longName',
        description: 'Long param',
        rawNode: null,
      },
    ];

    const result = printAligned(tags, 80);
    expect(result).toHaveLength(2);
    // Both results should be arrays representing comment lines
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });

  test('handles parameter without description (legacy behavior with requireParamHyphen: false)', () => {
    const tags: ParamTagInfo[] = [
      { tagName: 'param', name: 'noDesc', description: '', rawNode: null },
    ];

    const result = printAligned(tags, 80, true, {
      tsdoc: { requireParamHyphen: false },
    });
    expect(result).toHaveLength(1);
    // Should not include hyphen when requireParamHyphen is false
    const line = result[0];
    expect(line[1]).toBe('@param noDesc');
  });

  test('formats returns tag', () => {
    const mockNode = {
      content: {
        kind: 'PlainText',
        text: 'The return value',
      },
    };

    const result = formatReturnsTag(mockNode);
    expect(Array.isArray(result)).toBe(true);
    expect(result[1]).toEqual(['@returns ', expect.anything()]);
  });

  test('groups parameter tags by type', () => {
    const tags: ParamTagInfo[] = [
      {
        tagName: 'param',
        name: 'a',
        description: 'First param',
        rawNode: null,
      },
      {
        tagName: 'param',
        name: 'b',
        description: 'Second param',
        rawNode: null,
      },
      {
        tagName: 'typeParam',
        name: 'T',
        description: 'Type param',
        rawNode: null,
      },
      {
        tagName: 'typeParam',
        name: 'U',
        description: 'Another type param',
        rawNode: null,
      },
    ];

    const groups = groupParameterTags(tags);
    expect(groups).toHaveLength(2);
    expect(groups[0].tags).toHaveLength(2); // Two @param tags
    expect(groups[1].tags).toHaveLength(2); // Two @typeParam tags
    expect(groups[0].tags[0].tagName).toBe('param');
    expect(groups[1].tags[0].tagName).toBe('typeParam');
  });

  test('handles extremely long parameter names', () => {
    const veryLongName = 'a'.repeat(100);
    const tags: ParamTagInfo[] = [
      {
        tagName: 'param',
        name: veryLongName,
        description: 'Description',
        rawNode: null,
      },
    ];

    // With a small effective width, should break to next line
    const result = printAligned(tags, 50);
    expect(result).toHaveLength(2); // Header line + description line
  });

  describe('Empty Parameter Hyphen Feature', () => {
    test('should add hyphen to empty param description when requireParamHyphen is true (default)', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@param', name: 'name', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, false, {
        tsdoc: { requireParamHyphen: true },
      });

      expect(result).toHaveLength(1);
      const line = result[0];
      expect(line[1]).toBe('@param name -');
    });

    test('should use default requireParamHyphen: true when not specified', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@param', name: 'value', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, false, {});

      expect(result).toHaveLength(1);
      const line = result[0];
      expect(line[1]).toBe('@param value -');
    });

    test('should omit hyphen from empty param when requireParamHyphen is false', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@param', name: 'name', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, false, {
        tsdoc: { requireParamHyphen: false },
      });

      expect(result).toHaveLength(1);
      const line = result[0];
      expect(line[1]).toBe('@param name');
    });

    test('should add hyphen to empty typeParam description when requireTypeParamHyphen is true', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, false, {
        tsdoc: { requireTypeParamHyphen: true },
      });

      expect(result).toHaveLength(1);
      const line = result[0];
      expect(line[1]).toBe('@typeParam T -');
    });

    test('should omit hyphen from empty typeParam when requireTypeParamHyphen is false', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, false, {
        tsdoc: { requireTypeParamHyphen: false },
      });

      expect(result).toHaveLength(1);
      const line = result[0];
      expect(line[1]).toBe('@typeParam T');
    });

    test('should align hyphens when mixing empty and non-empty descriptions', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@param', name: 'name', description: '', rawNode: null },
        {
          tagName: '@param',
          name: 'id',
          description: 'User identifier',
          rawNode: null,
        },
        { tagName: '@param', name: 'options', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, true, {
        tsdoc: { requireParamHyphen: true },
      });

      expect(result).toHaveLength(3);
      // All results should be arrays representing comment lines
      expect(Array.isArray(result[0])).toBe(true);
      expect(Array.isArray(result[1])).toBe(true);
      expect(Array.isArray(result[2])).toBe(true);

      // Check that hyphens are present in the content (line[1])
      const content0 = result[0][1];
      const content1 = result[1][1];
      const content2 = result[2][1];

      // Check if hyphen is present in each content
      const hasHyphen0 = Array.isArray(content0)
        ? content0.includes('-')
        : typeof content0 === 'string' && content0.includes('-');
      const hasHyphen1 = Array.isArray(content1)
        ? content1.some((part: any) =>
            typeof part === 'string' ? part.includes('-') : part === '-'
          )
        : typeof content1 === 'string' && content1.includes('-');
      const hasHyphen2 = Array.isArray(content2)
        ? content2.includes('-')
        : typeof content2 === 'string' && content2.includes('-');

      expect(hasHyphen0).toBe(true);
      expect(hasHyphen1).toBe(true);
      expect(hasHyphen2).toBe(true);
    });

    test('should handle non-aligned format with empty description', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@param', name: 'x', description: '', rawNode: null },
        { tagName: '@param', name: 'y', description: '', rawNode: null },
      ];
      const result = printAligned(tags, 80, false, {
        tsdoc: { requireParamHyphen: true },
      });

      expect(result).toHaveLength(2);
      expect(result[0][1]).toBe('@param x -');
      expect(result[1][1]).toBe('@param y -');
    });

    test('should handle very long parameter names with empty descriptions', () => {
      const tags: ParamTagInfo[] = [
        {
          tagName: '@param',
          name: 'veryLongParameterNameThatExceedsWidth',
          description: '',
          rawNode: null,
        },
      ];
      const result = printAligned(tags, 40, false, {
        tsdoc: { requireParamHyphen: true },
      });

      expect(result).toHaveLength(1);
      const line = result[0];
      // Should still add hyphen even if it causes line to be long
      expect(line[1]).toBe('@param veryLongParameterNameThatExceedsWidth -');
    });

    test('should respect independent settings for param and typeParam', () => {
      const paramTags: ParamTagInfo[] = [
        { tagName: '@param', name: 'value', description: '', rawNode: null },
      ];
      const typeParamTags: ParamTagInfo[] = [
        { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
      ];

      // Param requires hyphen, typeParam does not
      const paramResult = printAligned(paramTags, 80, false, {
        tsdoc: { requireParamHyphen: true, requireTypeParamHyphen: false },
      });
      const typeParamResult = printAligned(typeParamTags, 80, false, {
        tsdoc: { requireParamHyphen: true, requireTypeParamHyphen: false },
      });

      expect(paramResult[0][1]).toBe('@param value -');
      expect(typeParamResult[0][1]).toBe('@typeParam T');
    });

    test('should produce identical output when formatting twice (idempotency)', () => {
      const tags: ParamTagInfo[] = [
        { tagName: '@param', name: 'name', description: '', rawNode: null },
      ];
      const options = { tsdoc: { requireParamHyphen: true } };

      const result1 = printAligned(tags, 80, false, options);
      const result2 = printAligned(tags, 80, false, options);

      expect(result1).toEqual(result2);
    });
  });
});
