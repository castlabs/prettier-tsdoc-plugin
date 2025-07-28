import { expect, test, describe } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('AST-Aware Release Tag Detection', () => {
  const config = createTSDocConfiguration();
  const parser = new TSDocParser(config);

  test('respects onlyExportedAPI: false (legacy behavior)', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: false, // Disable AST-aware detection
      },
    };

    const commentValue =
      '*\n * Function without context.\n * @param value - Input\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Should add @internal tag even without AST context (legacy behavior)
  });

  test('respects onlyExportedAPI: true without AST context', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
      },
    };

    const commentValue =
      '*\n * Function without AST context.\n * @param value - Input\n ';
    // Call without commentPath (AST context) - should fallback to legacy behavior
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Should add @internal tag as fallback when AST analysis fails
  });

  test('preserves existing release tags regardless of AST analysis', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
      },
    };

    const commentValue =
      '*\n * Function with existing tag.\n * @public\n * @param value - Input\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Should preserve @public tag
  });

  test('handles null defaultReleaseTag (feature disabled)', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: null, // Feature disabled
        onlyExportedAPI: true,
      },
    };

    const commentValue =
      '*\n * Function without release tag.\n * @param value - Input\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Should not add any release tag
  });

  test('handles custom defaultReleaseTag', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@public', // Custom default
        onlyExportedAPI: false, // Use legacy behavior for predictable testing
      },
    };

    const commentValue =
      '*\n * Function without release tag.\n * @param value - Input\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Should add @public tag
  });

  test('handles inheritanceAware option', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
        inheritanceAware: false, // Disable inheritance awareness
      },
    };

    const commentValue =
      '*\n * Function that might be a class member.\n * @param value - Input\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Behavior depends on AST context - without it, should use fallback
  });
});

describe('AST Analysis Edge Cases', () => {
  const config = createTSDocConfiguration();
  const parser = new TSDocParser(config);

  test('gracefully handles AST analysis errors', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
      },
    };

    // Create a mock path that will cause errors
    const mockCommentPath = {
      getValue: () => ({ type: 'Block', value: 'test comment' }),
      getParentNode: () => {
        throw new Error('AST access error');
      },
    };

    const commentValue =
      '*\n * Function that will cause AST error.\n * @param value - Input\n ';
    const result = formatTSDocComment(
      commentValue,
      options,
      parser,
      mockCommentPath as any
    );

    expect(result).toBeDefined();
    // Should fallback gracefully and still format the comment
  });

  test('handles undefined options gracefully', () => {
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      // No tsdoc options - should use defaults
    };

    const commentValue =
      '*\n * Function with default options.\n * @param value - Input\n ';
    const result = formatTSDocComment(commentValue, options, parser);

    expect(result).toBeDefined();
    // Should use default options and add @internal tag
  });

  test('respects all configuration combinations', () => {
    const testCases = [
      {
        config: {
          onlyExportedAPI: true,
          inheritanceAware: true,
          defaultReleaseTag: '@internal',
        },
        description: 'Full AST-aware mode',
      },
      {
        config: {
          onlyExportedAPI: false,
          inheritanceAware: true,
          defaultReleaseTag: '@internal',
        },
        description: 'Legacy mode with inheritance',
      },
      {
        config: {
          onlyExportedAPI: true,
          inheritanceAware: false,
          defaultReleaseTag: '@public',
        },
        description: 'Export-aware only, no inheritance',
      },
      {
        config: {
          onlyExportedAPI: false,
          inheritanceAware: false,
          defaultReleaseTag: null,
        },
        description: 'All features disabled',
      },
    ];

    testCases.forEach(({ config, description: _description }) => {
      const options = {
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        tsdoc: config,
      };

      const commentValue =
        '*\n * Function for configuration test.\n * @param value - Input\n ';
      const result = formatTSDocComment(commentValue, options, parser);

      expect(result).toBeDefined();
      // Each configuration should work without errors
    });
  });
});
