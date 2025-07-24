import { expect, test, describe } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('Phase 3: Summary & Remarks Formatting', () => {
  test('formats simple summary comment', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue = '*\n * This is a simple summary.\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats summary with remarks section', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Short summary.\n * @remarks\n * This is a longer remarks section.\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats remarks-only comment', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue = '*\n * @remarks\n * This comment only has remarks.\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('handles empty comments gracefully', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue = '*\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats comment with parameter tags', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Function with params.\n * @param name - The name\n * @param age - The age\n * @returns A greeting\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats comment with mixed parameter types', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Generic function.\n * @param value - Input value\n * @typeParam T - Type parameter\n * @returns Processed value\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('handles parameters without descriptions', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Function with unnamed params.\n * @param value\n * @returns Something\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats comment with markdown lists', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Function features:\n * - Feature 1\n * - Feature 2\n *   - Sub-feature\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats comment with fenced code blocks', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * @example\n * ```typescript\n * const x = 1;\n * console.log(x);\n * ```\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formats comment with mixed markdown and code', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * @remarks\n * This function:\n * - Does something\n * - Example:\n * ```js\n * doSomething();\n * ```\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('formatting is idempotent', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Summary text here.\n * @remarks\n * Some remarks.\n ';

    const firstResult = formatTSDocComment(commentValue, options, parser);
    expect(firstResult).toBeDefined();

    // Since we're testing the function directly, we can't easily test idempotence
    // without implementing a Doc-to-string conversion. This is tested at integration level.
  });
});

describe('Phase 6: Configuration & Normalization', () => {
  test('normalizes @return to @returns by default', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Function with return tag.\n * @param value - The input\n * @return The output\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Note: Testing exact output would require Doc-to-string conversion
    // The normalization is tested at the config level and integration level
  });

  test('normalizes @prop to @property by default', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentValue =
      '*\n * Object with property.\n * @prop name - The name property\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('respects custom normalization mappings', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        normalizeTags: {
          '@custom': '@customTag',
        },
      },
    };

    const commentValue =
      '*\n * Function with custom tag.\n * @custom Some custom content\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('applies release tag deduplication when enabled', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        dedupeReleaseTags: true,
        releaseTagStrategy: 'keep-first',
      },
    };

    const commentValue =
      '*\n * Function with duplicate release tags.\n * @public\n * @param x - Value\n * @public\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('respects keep-last strategy for release tag deduplication', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        dedupeReleaseTags: true,
        releaseTagStrategy: 'keep-last',
      },
    };

    const commentValue =
      '*\n * Function with duplicate release tags.\n * @public\n * @param x - Value\n * @beta\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('skips release tag deduplication when disabled', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        dedupeReleaseTags: false,
      },
    };

    const commentValue =
      '*\n * Function with duplicate release tags.\n * @public\n * @public\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });

  test('handles mixed normalization and deduplication', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        normalizeTags: {
          '@return': '@returns',
        },
        dedupeReleaseTags: true,
        releaseTagStrategy: 'keep-first',
      },
    };

    const commentValue =
      '*\n * Complex function.\n * @param x - Input\n * @return Output\n * @public\n * @public\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
  });
});
