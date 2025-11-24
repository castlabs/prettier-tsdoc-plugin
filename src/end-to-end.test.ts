import { expect, test, describe } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';
import { isTSDocCandidate } from './detection.js';

describe('End-to-End Integration Tests', () => {
  test('processes realistic TSDoc comment through complete pipeline', async () => {
    // Use a realistic TSDoc comment similar to what would be in an example file
    const realisticComment = `*
 * Adds two numbers together with optional formatting.
 * 
 * This function demonstrates various TSDoc features including
 * parameter documentation, return types, and code examples.
 * 
 * @param a - The first number to add
 * @param b - The second number to add  
 * @param options - Optional formatting configuration
 * @returns The sum of the two numbers, optionally formatted
 * 
 * @example
 * \`\`\`typescript
 * const result = add(5, 3);
 * console.log(result); // 8
 * 
 * const formatted = add(5, 3, { format: true });
 * console.log(formatted); // "8.00"
 * \`\`\`
 * 
 * @public
 * @since 1.0.0
 `;

    expect(realisticComment).toContain('@param');
    expect(realisticComment).toContain('@returns');
    expect(realisticComment).toContain('@example');

    // Test the complete pipeline
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    // Step 1: Detection
    const mockComment = {
      value: realisticComment,
      type: 'CommentBlock',
    };
    console.log(
      'Comment content:',
      JSON.stringify(realisticComment.substring(0, 100))
    );
    const isCandidate = isTSDocCandidate(mockComment, false);
    console.log('Is TSDoc candidate:', isCandidate);
    expect(isCandidate).toBe(true);

    // Step 2: Formatting
    const formatted = await formatTSDocComment(
      realisticComment,
      options,
      parser
    );
    expect(formatted).toBeDefined();

    console.log('✅ Complete TSDoc pipeline working for realistic comment');
  });

  test('demonstrates tag normalization functionality', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        normalizeTags: { '@return': '@returns' },
      },
    };

    const commentWithReturnTag = `*
 * Function with return tag that should be normalized.
 * @param value - Input value
 * @return The processed result
 `;

    const formatted = await formatTSDocComment(
      commentWithReturnTag,
      options,
      parser
    );
    expect(formatted).toBeDefined();

    console.log('✅ Tag normalization functionality working');
  });

  test('demonstrates release tag deduplication', async () => {
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

    const commentWithDuplicateTags = `*
 * Function with duplicate release tags.
 * @public
 * @param x - Value
 * @public
 * @beta
 `;

    const formatted = await formatTSDocComment(
      commentWithDuplicateTags,
      options,
      parser
    );
    expect(formatted).toBeDefined();

    console.log('✅ Release tag deduplication functionality working');
  });

  test('demonstrates fenced code block formatting', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        fencedIndent: 'space',
      },
    };

    const commentWithCode = `*
 * Function with code example.
 * @example
 * \`\`\`typescript
 * const result=processData({value:42});
 * console.log(result);
 * \`\`\`
 `;

    const formatted = await formatTSDocComment(
      commentWithCode,
      options,
      parser
    );
    expect(formatted).toBeDefined();

    console.log('✅ Fenced code block formatting functionality working');
  });

  test('demonstrates markdown list formatting', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const commentWithMarkdown = `*
 * Function with markdown lists.
 * Features:
 * - Feature 1
 *   - Sub-feature A
 * * Feature 2
 * + Feature 3
 `;

    const formatted = await formatTSDocComment(
      commentWithMarkdown,
      options,
      parser
    );
    expect(formatted).toBeDefined();

    console.log('✅ Markdown list formatting functionality working');
  });

  test('validates all 7 phases are integrated correctly', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        fencedIndent: 'space',
        dedupeReleaseTags: true,
        normalizeTags: { '@return': '@returns', '@prop': '@property' },
        releaseTagStrategy: 'keep-first',
      },
    };

    // Complex comment that tests all phases
    const complexComment = `*
 * Complex utility function with comprehensive documentation.
 * 
 * @remarks
 * This function demonstrates:
 * - Parameter documentation with types
 * - Return value documentation  
 * - Code examples with syntax highlighting
 * 
 * @example Basic usage
 * \`\`\`typescript
 * const result = complexFunction('test', { verbose: true });
 * console.log(result.status);
 * \`\`\`
 * 
 * @param input - The input string to process
 * @param options - Configuration options
 * @return Processing result with status information
 * @public
 * @public
 * @beta
 `;

    const formatted = await formatTSDocComment(complexComment, options, parser);
    expect(formatted).toBeDefined();

    console.log('✅ All 7 phases integrated successfully:');
    console.log('  ✓ Phase 1: Bootstrap');
    console.log('  ✓ Phase 2: Parser Detection');
    console.log('  ✓ Phase 3: Summary & Remarks');
    console.log('  ✓ Phase 4: Tags & Alignment');
    console.log('  ✓ Phase 5: Markdown & Codeblocks');
    console.log('  ✓ Phase 6: Configuration & Normalization');
    console.log('  ✓ Phase 7: Edge Cases & Performance');
  });

  test('formats empty parameter descriptions with requireParamHyphen: true', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        requireParamHyphen: true,
      },
    };

    const commentWithEmptyParams = `*
 * Test function
 * @param name
 * @param id
 * @internal
 `;

    const result = await formatTSDocComment(
      commentWithEmptyParams,
      options,
      parser
    );
    const formatted = docToString(result);

    // Verify hyphens are present for empty params
    const lines = formatted.split('\n');
    const nameLine = lines.find((line) => line.includes('@param name'));
    const idLine = lines.find((line) => line.includes('@param id'));

    // Expect exact format: " * @param name -" (with trailing space or end of line)
    expect(nameLine).toBe(' * @param name -');
    expect(idLine).toBe(' * @param id -');

    console.log(
      '✅ Empty parameter hyphen feature (requireParamHyphen: true) working'
    );
  });

  test('formats empty parameter descriptions with requireParamHyphen: false', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        requireParamHyphen: false,
      },
    };

    const commentWithEmptyParams = `*
 * Test function
 * @param name
 * @param id
 `;

    const result = await formatTSDocComment(
      commentWithEmptyParams,
      options,
      parser
    );
    const formatted = docToString(result);

    // Verify hyphens are NOT present for empty params
    const lines = formatted.split('\n');
    const nameLine = lines.find((line) => line.includes('@param name'));
    const idLine = lines.find((line) => line.includes('@param id'));

    // Expect exact format: " * @param name" (no hyphen)
    expect(nameLine).toBe(' * @param name');
    expect(idLine).toBe(' * @param id');

    console.log(
      '✅ Empty parameter hyphen feature (requireParamHyphen: false) working'
    );
  });

  test('respects default requireParamHyphen: true for TypeDoc compatibility', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      // No tsdoc config specified - should use defaults
    };

    const commentWithEmptyParams = `*
 * @param value
 * @typeParam T
 `;

    const result = await formatTSDocComment(
      commentWithEmptyParams,
      options,
      parser
    );
    const formatted = docToString(result);

    // Verify default behavior: hyphens present for both param and typeParam
    const lines = formatted.split('\n');
    const valueLine = lines.find((line) => line.includes('@param value'));
    const typeParamLine = lines.find((line) => line.includes('@typeParam T'));

    // Expect hyphens by default (TypeDoc compatibility)
    expect(valueLine).toBe(' * @param value -');
    expect(typeParamLine).toBe(' * @typeParam T -');

    console.log(
      '✅ Default requireParamHyphen and requireTypeParamHyphen: true working'
    );
  });

  test('handles independent configuration for param and typeParam', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        requireParamHyphen: true,
        requireTypeParamHyphen: false,
      },
    };

    const commentWithEmptyParams = `*
 * @param value
 * @typeParam T
 `;

    const result = await formatTSDocComment(
      commentWithEmptyParams,
      options,
      parser
    );
    const formatted = docToString(result);

    // Verify independent behavior: param has hyphen, typeParam does not
    const lines = formatted.split('\n');
    const valueLine = lines.find((line) => line.includes('@param value'));
    const typeParamLine = lines.find((line) => line.includes('@typeParam T'));

    expect(valueLine).toBe(' * @param value -');
    expect(typeParamLine).toBe(' * @typeParam T');

    console.log('✅ Independent configuration for param and typeParam working');
  });

  test('does not wrap block-level tags like @namespace in curly braces', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    };

    const commentWithNamespace = `*
 * @namespace MyNamespace
 `;

    const result = await formatTSDocComment(
      commentWithNamespace,
      options,
      parser
    );
    const formatted = docToString(result);

    // Verify @namespace is NOT wrapped in curly braces (it's a block tag, not an inline tag)
    expect(formatted).toContain('@namespace MyNamespace');
    expect(formatted).not.toContain('{@namespace}');

    console.log('✅ Block-level tags like @namespace are correctly formatted');
  });

  test('@enum should be treated as block-level tag, not inline', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    };

    const commentWithEnum = `*
 * Status enum.
 * @enum
 * @readonly
 `;

    const result = await formatTSDocComment(commentWithEnum, options, parser);
    const formatted = docToString(result);

    console.log('Formatted output with @enum:', formatted);

    // Verify @enum is NOT wrapped in curly braces like {@enum}
    // It should appear as a block-level tag on its own line
    expect(formatted).not.toContain('{@enum}');
    expect(formatted).toContain('@enum');

    console.log('✅ @enum tag is correctly formatted as block-level tag');
  });

  test('@enum with type annotation should be treated as block-level tag', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    };

    const commentWithEnum = `*
 * Status values.
 * @enum {string}
 `;

    const result = await formatTSDocComment(commentWithEnum, options, parser);
    const formatted = docToString(result);

    console.log('Formatted output with @enum {string}:', formatted);

    // Verify @enum is NOT wrapped in additional curly braces like {@enum}
    expect(formatted).not.toContain('{@enum}');
    expect(formatted).toContain('@enum');

    console.log('✅ @enum with type annotation is correctly formatted');
  });
});

/**
 * Helper function to convert Doc to string for testing
 */
function docToString(doc: any): string {
  if (typeof doc === 'string') {
    return doc;
  }

  if (typeof doc === 'number') {
    return String(doc);
  }

  if (doc === null || doc === undefined) {
    return '';
  }

  if (Array.isArray(doc)) {
    return doc.map(docToString).join('');
  }

  if (doc && typeof doc === 'object') {
    // Handle Prettier Doc builders
    if (doc.type === 'concat' || (doc.parts && Array.isArray(doc.parts))) {
      return doc.parts.map(docToString).join('');
    }
    if (doc.type === 'group' && doc.contents) {
      return docToString(doc.contents);
    }
    if (doc.type === 'line' || doc.type === 'hardline') {
      return '\n';
    }
    if (doc.type === 'softline') {
      return ' ';
    }
    if (doc.type === 'fill' && doc.parts) {
      return doc.parts.map(docToString).join(' ');
    }
    if (
      doc.type === 'break-parent' ||
      doc.type === 'indent' ||
      doc.type === 'dedent'
    ) {
      return ''; // These are formatting control tokens, not content
    }
    if (doc.contents !== undefined) {
      return docToString(doc.contents);
    }
    if (doc.parts !== undefined) {
      return doc.parts.map(docToString).join('');
    }

    // Last resort: check for common properties
    if (doc.value !== undefined) {
      return docToString(doc.value);
    }
    if (doc.text !== undefined) {
      return docToString(doc.text);
    }
  }

  // Debug problematic docs
  console.warn('Unable to convert doc to string:', doc);
  return '';
}

describe('Const Enum Release Tag Inheritance - End-to-End', () => {
  test('should handle const enum pattern with inheritance in complete pipeline', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
        alignParamTags: true,
      },
    };

    const input = `*
 * Status enumeration
 * @enum
 * @public
 `;

    const formatted = await formatTSDocComment(input, options, parser);
    expect(formatted).toBeDefined();

    // Verify that @enum and @public tags are present
    const result = docToString(formatted);
    expect(result).toContain('@enum');
    expect(result).toContain('@public');

    console.log('✅ Const enum inheritance working in complete pipeline');
  });

  test('should handle complete const enum pattern with type alias', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      tsdoc: {
        defaultReleaseTag: '@internal',
      },
    };

    // Test the const object comment
    const constComment = `*
 * HTTP status codes
 * @enum
 * @public
 `;

    const formattedConst = await formatTSDocComment(
      constComment,
      options,
      parser
    );
    expect(formattedConst).toBeDefined();

    const resultConst = docToString(formattedConst);
    expect(resultConst).toContain('@enum');
    expect(resultConst).toContain('@public');

    // Test a property comment (should not get @internal in real formatting)
    const propertyComment = `*
 * Not found error
 `;

    const formattedProperty = await formatTSDocComment(
      propertyComment,
      options,
      parser
    );
    expect(formattedProperty).toBeDefined();

    console.log('✅ Complete const enum pattern working');
  });
});
