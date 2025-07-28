/**
 * Tests for parameter tag alignment functionality.
 */

import { expect, test, describe, beforeEach } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('Parameter Alignment', () => {
  let parser: TSDocParser;
  const baseOptions = {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    forceFormatTSDoc: true, // Required for TSDoc processing
  };

  beforeEach(() => {
    const configuration = createTSDocConfiguration();
    parser = new TSDocParser(configuration);
  });

  describe('Non-aligned formatting (default)', () => {
    const nonAlignedOptions = {
      ...baseOptions,
      alignParamTags: false,
    };

    test('formats parameters without alignment', () => {
      const comment = `*
 * Function with two parameters of different lengths.
 *
 * @param name - Short parameter.
 * @param second_long_param - Much longer parameter description.
 */`;

      const result = formatTSDocComment(comment, nonAlignedOptions, parser);
      const formatted = docToString(result);

      expect(formatted).toContain('@param name - Short parameter.');
      expect(formatted).toContain(
        '@param second_long_param - Much longer parameter description.'
      );

      // Verify no extra padding
      const lines = formatted.split('\n');
      const nameParamLine = lines.find((line) => line.includes('@param name'));
      const longParamLine = lines.find((line) =>
        line.includes('@param second_long_param')
      );

      expect(nameParamLine).toBe(' * @param name - Short parameter.');
      expect(longParamLine).toBe(
        ' * @param second_long_param - Much longer parameter description.'
      );
    });

    test('handles single parameter without alignment', () => {
      const comment = `*
 * Function with one parameter.
 *
 * @param singleParam - The only parameter.
 */`;

      const result = formatTSDocComment(comment, nonAlignedOptions, parser);
      const formatted = docToString(result);

      expect(formatted).toContain('@param singleParam - The only parameter.');

      const lines = formatted.split('\n');
      const paramLine = lines.find((line) =>
        line.includes('@param singleParam')
      );
      expect(paramLine).toBe(' * @param singleParam - The only parameter.');
    });
  });

  describe('Aligned formatting', () => {
    const alignedOptions = {
      ...baseOptions,
      alignParamTags: true,
    };

    test('aligns parameters with different name lengths', () => {
      const comment = `*
 * Function with two parameters of different lengths.
 *
 * @param name - Short parameter.
 * @param second_long_param - Much longer parameter description.
 */`;

      const result = formatTSDocComment(comment, alignedOptions, parser);
      const formatted = docToString(result);

      const lines = formatted.split('\n');
      const nameParamLine = lines.find((line) => line.includes('@param name'));
      const longParamLine = lines.find((line) =>
        line.includes('@param second_long_param')
      );

      // Find the position of '-' in both lines
      const nameHyphenPos = nameParamLine?.indexOf(' - ');
      const longHyphenPos = longParamLine?.indexOf(' - ');

      expect(nameHyphenPos).toBeDefined();
      expect(longHyphenPos).toBeDefined();
      expect(nameHyphenPos).toBe(longHyphenPos); // Hyphens should be aligned
    });

    test('handles single parameter (no alignment needed)', () => {
      const comment = `*
 * Function with one parameter.
 *
 * @param singleParam - The only parameter.
 */`;

      const result = formatTSDocComment(comment, alignedOptions, parser);
      const formatted = docToString(result);

      // Single parameter should be formatted normally (no alignment needed)
      expect(formatted).toContain('@param singleParam - The only parameter.');
    });

    test('aligns mixed parameter and typeParam tags', () => {
      const comment = `*
 * Generic function with parameters.
 *
 * @typeParam T - Type parameter.
 * @typeParam LongTypeParamName - Much longer type parameter.
 */`;

      const result = formatTSDocComment(comment, alignedOptions, parser);
      const formatted = docToString(result);

      const lines = formatted.split('\n');
      const typeParamLine = lines.find((line) => line.includes('@typeParam T'));
      const longTypeParamLine = lines.find((line) =>
        line.includes('@typeParam LongTypeParamName')
      );

      // Find the position of '-' in both lines
      const typeHyphenPos = typeParamLine?.indexOf(' - ');
      const longTypeHyphenPos = longTypeParamLine?.indexOf(' - ');

      expect(typeHyphenPos).toBeDefined();
      expect(longTypeHyphenPos).toBeDefined();
      expect(typeHyphenPos).toBe(longTypeHyphenPos); // Hyphens should be aligned
    });

    test('handles parameters without descriptions', () => {
      const comment = `*
 * Function with mixed parameters.
 *
 * @param name - Has description.
 * @param noDesc
 * @param anotherLongParam - Also has description.
 */`;

      const result = formatTSDocComment(comment, alignedOptions, parser);
      const formatted = docToString(result);

      // Should handle mix of parameters with/without descriptions
      expect(formatted).toContain('@param name');
      expect(formatted).toContain('@param noDesc');
      expect(formatted).toContain('@param anotherLongParam');

      // Parameters with descriptions should be aligned
      const lines = formatted.split('\n');
      const nameParamLine = lines.find(
        (line) => line.includes('@param name') && line.includes('-')
      );
      const longParamLine = lines.find(
        (line) => line.includes('@param anotherLongParam') && line.includes('-')
      );

      if (nameParamLine && longParamLine) {
        const nameHyphenPos = nameParamLine.indexOf(' - ');
        const longHyphenPos = longParamLine.indexOf(' - ');
        expect(nameHyphenPos).toBe(longHyphenPos);
      }
    });
  });

  describe('Edge cases', () => {
    test('handles very long parameter names that exceed print width', () => {
      const alignedOptions = {
        ...baseOptions,
        printWidth: 40, // Short width to force wrapping
        alignParamTags: true,
      };

      const comment = `*
 * Function with very long parameter names.
 *
 * @param extremelyLongParameterNameThatExceedsWidth - Description.
 * @param short - Short param.
 */`;

      const result = formatTSDocComment(comment, alignedOptions, parser);
      const formatted = docToString(result);

      // Should handle gracefully without breaking
      expect(formatted).toContain('extremelyLongParameterNameThatExceedsWidth');
      expect(formatted).toContain('short');
    });
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
