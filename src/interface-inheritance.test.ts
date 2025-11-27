import { describe, test, expect } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';
import { safeDocToString } from './utils/doc-to-string.js';

describe('Interface Inheritance', () => {
  const parser = new TSDocParser(createTSDocConfiguration());

  test('should not add release tags to interface members when they should inherit', async () => {
    const commentValue = 'Property without explicit release tag';
    const options = {
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
        inheritanceAware: true,
      },
    };

    // Simulate interface member context
    const exportContext = {
      isExported: false, // interface member itself is not directly exported
      followingCode: 'prop: string;',
      isContainerMember: true,
      containerType: 'interface',
      shouldInheritReleaseTag: true,
    };

    const result = await formatTSDocComment(
      commentValue,
      options,
      parser,
      undefined,
      exportContext
    );

    const resultString = safeDocToString(result, '', {});

    // The interface member should NOT have a release tag added
    expect(resultString).not.toContain('@internal');
    expect(resultString).not.toContain('@public');
    expect(resultString).toContain('Property without explicit release tag');
  });

  test('should preserve explicit release tags on interface members', async () => {
    const commentValue = 'Property with explicit internal tag\n@internal';
    const options = {
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: true,
        inheritanceAware: true,
      },
    };

    const exportContext = {
      isExported: false,
      followingCode: 'prop: string;',
      isContainerMember: true,
      containerType: 'interface',
      shouldInheritReleaseTag: true,
    };

    const result = await formatTSDocComment(
      commentValue,
      options,
      parser,
      undefined,
      exportContext
    );

    const resultString = safeDocToString(result, '', {});

    // The explicit @internal should be preserved
    expect(resultString).toContain('@internal');
    expect(resultString).toContain('Property with explicit internal tag');
  });

  test('should add release tags to interface members when inheritance is disabled', async () => {
    const commentValue = 'Property without explicit release tag';
    const options = {
      tsdoc: {
        defaultReleaseTag: '@internal',
        onlyExportedAPI: false, // Disable export-only mode
        inheritanceAware: false, // Disable inheritance awareness
      },
    };

    const result = await formatTSDocComment(commentValue, options, parser);

    const resultString = safeDocToString(result, '', {});

    // Should add the default release tag when inheritance is disabled
    expect(resultString).toContain('@internal');
    expect(resultString).toContain('Property without explicit release tag');
  });
});
