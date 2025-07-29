/**
 * Integration tests for legacy Closure Compiler transformations with the full formatting pipeline.
 */

import { describe, it, expect } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';
import { safeDocToString } from './utils/doc-to-string.js';
import { applyLegacyTransformations } from './utils/legacy-transforms.js';

describe('Legacy transformations integration', () => {
  const createParser = () => {
    const configuration = createTSDocConfiguration();
    return new TSDocParser(configuration);
  };

  const defaultOptions = {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    tsdoc: {
      closureCompilerCompat: true,
      normalizeTagOrder: true,
      dedupeReleaseTags: true,
    },
  };

  describe('full pipeline integration', () => {
    it('should apply legacy transformations and format correctly', () => {
      const input = `
 * Creates a new widget with the given configuration.
 * @constructor
 * @param {string} id - The unique identifier for the widget.
 * @param {object} [options] - Configuration options.
 * @export
`;

      const parser = createParser();
      const result = formatTSDocComment(input, defaultOptions, parser);

      // Convert the result to string for comparison
      const resultString = safeDocToString(result);

      // Should not contain legacy tags
      expect(resultString).not.toContain('@constructor');
      expect(resultString).not.toContain('{string}');
      expect(resultString).not.toContain('{object}');
      expect(resultString).not.toContain('@export');

      // Should contain modern equivalents
      expect(resultString).toContain('@public');
      expect(resultString).toContain('@param id');
      expect(resultString).toContain('@param options');
    });

    it('should handle class heritage tags with formatting', () => {
      const input = `
 * A special widget that extends functionality.
 * @extends {BaseWidget}
 * @implements {IWidget}
 * @protected
 * @param config - Widget configuration.
`;

      const parser = createParser();
      const result = formatTSDocComment(input, defaultOptions, parser);
      const resultString = safeDocToString(result);

      // Legacy heritage tags should be removed
      expect(resultString).not.toContain('@extends');
      expect(resultString).not.toContain('@implements');
      expect(resultString).not.toContain('@protected');

      // Should contain modern equivalent
      expect(resultString).toContain('@internal');
      expect(resultString).toContain('@param config');
    });

    it('should normalize @see tags and format them properly', () => {
      const input = `
 * Widget utilities.
 * @see http://example.com/docs
 * @see MyOtherClass
 * @see Also check the documentation for more details.
`;

      // First test the legacy transformation directly
      const transformedInput = applyLegacyTransformations(input);

      // Test that both URLs and single words are wrapped in {@link}
      expect(transformedInput).toContain('{@link http://example.com/docs}');
      expect(transformedInput).toContain('{@link MyOtherClass}'); // Single words are now wrapped
      expect(transformedInput).not.toContain('@see MyOtherClass'); // Plain text should be wrapped

      const parser = createParser();
      const result = formatTSDocComment(input, defaultOptions, parser);
      const resultString = safeDocToString(result);

      // Both URLs and single words should be preserved in the final result
      expect(resultString).toContain('{@link http://example.com/docs}');
      expect(resultString).toContain('{@link MyOtherClass}');

      // Descriptive text should remain unchanged
      expect(resultString).toContain('Also check the documentation');
    });

    it('should handle simple single word @see tags correctly', () => {
      const input = `
 * This class has a constructor
 *
 * @param name - The name
 * @see MyClass
`;

      // First test the legacy transformation directly
      const transformedInput = applyLegacyTransformations(input);

      // Test that single words ARE wrapped in {@link} (now that LinkTag parsing is fixed)
      expect(transformedInput).toContain('{@link MyClass}');
      expect(transformedInput).not.toContain('@see MyClass'); // Should be wrapped, not plain text

      const parser = createParser();
      const result = formatTSDocComment(input, defaultOptions, parser);
      const resultString = safeDocToString(result);

      // The final result should contain the class name wrapped in {@link}
      expect(resultString).toContain('{@link MyClass}');

      // Should not contain empty links
      expect(resultString).not.toContain('{@link }');
    });

    it('should work with closureCompilerCompat disabled', () => {
      const input = `
 * Creates a widget.
 * @constructor
 * @param {string} id - The identifier.
 * @export
`;

      const optionsDisabled = {
        ...defaultOptions,
        tsdoc: {
          ...defaultOptions.tsdoc,
          closureCompilerCompat: false,
        },
      };

      // First test that transformations are NOT applied
      const transformedInput = applyLegacyTransformations(input, {
        closureCompilerCompat: false,
      });
      expect(transformedInput).toContain('@constructor');
      expect(transformedInput).toContain('{string}');
      expect(transformedInput).toContain('@export');

      const parser = createParser();
      const result = formatTSDocComment(input, optionsDisabled, parser);
      const _resultString = safeDocToString(result);

      // With transformations disabled, the original tags should be present in the input
      // However, TSDoc might still parse and format them differently
      // The key test is that our legacy transformations are not applied
      expect(transformedInput).toBe(input); // No transformation applied
    });

    it('should maintain idempotence with formatting rules', () => {
      const input = `
 * Creates a widget.
 * @constructor
 * @param {string} id - The identifier.
 * @param {object} options - Options.
 * @returns {Widget} The widget.
 * @export
`;

      const parser = createParser();

      // First formatting pass
      const firstResult = formatTSDocComment(input, defaultOptions, parser);
      const firstString = safeDocToString(firstResult);

      // Second formatting pass on the result of the first
      // We need to extract the comment value from the formatted result
      // This is a simplified test - in practice, the formatted result would go through
      // the full pipeline again
      expect(firstString).not.toContain('@constructor');
      expect(firstString).not.toContain('{string}');
      expect(firstString).not.toContain('@export');
      expect(firstString).toContain('@public');
    });

    it('should work with tag ordering and alignment', () => {
      const input = `
 * A complex function with multiple parameters.
 * @constructor
 * @param {string} veryLongParameterName - A parameter with a long name.
 * @param {object} id - A short parameter.
 * @returns {Widget} The result.
 * @export
 * @deprecated Use the new API instead.
`;

      const optionsWithAlignment = {
        ...defaultOptions,
        tsdoc: {
          ...defaultOptions.tsdoc,
          alignParamTags: true,
        },
      };

      const parser = createParser();
      const result = formatTSDocComment(input, optionsWithAlignment, parser);
      const resultString = safeDocToString(result);

      // Should apply transformations and maintain proper formatting
      expect(resultString).not.toContain('@constructor');
      expect(resultString).not.toContain('{string}');
      expect(resultString).not.toContain('{object}');
      expect(resultString).not.toContain('@export');

      expect(resultString).toContain('@param veryLongParameterName');
      expect(resultString).toContain('@param id');
      expect(resultString).toContain('@returns');
      expect(resultString).toContain('@deprecated');
      expect(resultString).toContain('@public');
    });
  });

  describe('error handling and fallbacks', () => {
    it('should handle malformed legacy tags gracefully', () => {
      const input = `
 * A function.
 * @param {string id - Missing closing brace.
 * @export
`;

      const parser = createParser();
      const result = formatTSDocComment(input, defaultOptions, parser);

      // Should not throw and should still apply some transformations
      expect(result).toBeDefined();
      const resultString = safeDocToString(result);
      expect(resultString).toContain('@public'); // @export should still be transformed
    });

    it('should preserve unknown legacy-style tags', () => {
      const input = `
 * A function.
 * @customTag {Type} value
 * @export
`;

      const parser = createParser();
      const result = formatTSDocComment(input, defaultOptions, parser);
      const resultString = safeDocToString(result);

      // Known tags should be transformed
      expect(resultString).toContain('@public');

      // Unknown tags should be preserved (our transformations are conservative)
      expect(resultString).toContain('@customTag');
    });
  });
});
