import { expect, test, describe } from 'vitest';
import {
  effectiveWidth,
  formatTextContent,
  createCommentLine,
  createEmptyCommentLine,
} from './text-width.js';

describe('Text Width Utilities', () => {
  test('calculates effective width correctly', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    };

    // With no indentation, effective width = 80 - 3 (for "* ") = 77
    expect(effectiveWidth(options as any, 0)).toBe(77);

    // With indentation level 1 (2 spaces), effective width = 80 - 2 - 3 = 75
    expect(effectiveWidth(options as any, 1)).toBe(75);
  });

  test('enforces minimum width', () => {
    const options = {
      printWidth: 20,
      tabWidth: 2,
      useTabs: false,
    };

    // Even with large indentation, should maintain minimum width of 20
    expect(effectiveWidth(options as any, 10)).toBe(20);
  });

  test('handles tabs vs spaces', () => {
    const spacesOptions = {
      printWidth: 80,
      tabWidth: 4,
      useTabs: false,
    };

    const tabsOptions = {
      printWidth: 80,
      tabWidth: 4,
      useTabs: true,
    };

    // With spaces: 80 - (1 * 4) - 3 = 73
    expect(effectiveWidth(spacesOptions as any, 1)).toBe(73);

    // With tabs: 80 - 1 - 3 = 76
    expect(effectiveWidth(tabsOptions as any, 1)).toBe(76);
  });

  test('formats text content', () => {
    const result = formatTextContent('This is some text');
    expect(result).toBeDefined();

    const emptyResult = formatTextContent('   ');
    expect(emptyResult).toBeNull();
  });

  test('creates comment lines', () => {
    const line = createCommentLine('content');
    expect(line).toEqual([' * ', 'content']);

    const emptyLine = createCommentLine(null);
    expect(emptyLine).toBe(' * ');
  });

  test('creates empty comment line', () => {
    const line = createEmptyCommentLine();
    expect(line).toBe(' *');
  });
});
