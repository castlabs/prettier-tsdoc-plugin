import { expect, test, describe } from 'vitest';
import { splitParamTag, computeColumnWidths, printAligned, formatReturnsTag, groupParameterTags, ParamTagInfo } from './tags.js';

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
      { tagName: 'param', name: 'a', description: 'Short param', rawNode: null },
      { tagName: 'param', name: 'veryLongParameterName', description: 'Long param', rawNode: null },
      { tagName: 'param', name: 'b', description: '', rawNode: null }, // No description
    ];

    const width = computeColumnWidths(tags);
    // Longest should be "@param veryLongParameterName - " = 31 chars
    expect(width).toBe(31);
  });

  test('prints aligned parameters', () => {
    const tags: ParamTagInfo[] = [
      { tagName: 'param', name: 'a', description: 'Short param', rawNode: null },
      { tagName: 'param', name: 'longName', description: 'Long param', rawNode: null },
    ];

    const result = printAligned(tags, 80);
    expect(result).toHaveLength(2);
    // Both results should be arrays representing comment lines
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });

  test('handles parameter without description', () => {
    const tags: ParamTagInfo[] = [
      { tagName: 'param', name: 'noDesc', description: '', rawNode: null },
    ];

    const result = printAligned(tags, 80);
    expect(result).toHaveLength(1);
    // Should not include hyphen when there's no description
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
      { tagName: 'param', name: 'a', description: 'First param', rawNode: null },
      { tagName: 'param', name: 'b', description: 'Second param', rawNode: null },
      { tagName: 'typeParam', name: 'T', description: 'Type param', rawNode: null },
      { tagName: 'typeParam', name: 'U', description: 'Another type param', rawNode: null },
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
      { tagName: 'param', name: veryLongName, description: 'Description', rawNode: null },
    ];

    // With a small effective width, should break to next line
    const result = printAligned(tags, 50);
    expect(result).toHaveLength(2); // Header line + description line
  });
});