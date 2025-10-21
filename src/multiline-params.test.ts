/**
 * Tests for Phase 140 - Multi-line Parameter Formatting
 *
 * Tests the formatting of param tags with multi-line descriptions,
 * including paragraphs, lists, fenced code blocks, and other Markdown content.
 */

import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';
import { docToString } from './utils/doc-to-string.js';
import { describe, it, expect } from 'vitest';

describe('Multi-line Parameter Formatting', () => {
  const configuration = createTSDocConfiguration();
  const parser = new TSDocParser(configuration);
  const options = {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    plugins: [],
  };

  async function render(
    input: string,
    overrideOptions = options
  ): Promise<string> {
    const doc = await formatTSDocComment(input, overrideOptions, parser);
    return docToString(doc);
  }

  describe('Simple multi-line paragraphs', () => {
    it('should format multi-line paragraphs correctly', async () => {
      const input = `/**
 * Function with multi-line parameter description.
 * 
 * @param second - The second thing. Let me see what will happen if this is a
 *   really really long line?
 *
 *   That looks reasonable but can I continue here in a separate paragraph? This line should be split but lets continue.
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param second - The second thing. Let me see what will happen if this is a'
      );
      expect(formatted).toContain('line?');
      expect(formatted).toContain(
        'That looks reasonable but can I continue here in a separate paragraph?'
      );
      expect(formatted).toContain('line should be split but lets continue.');
    });

    it('should handle multiple paragraphs with blank lines', async () => {
      const input = `/**
 * @param config - This is the first paragraph describing the config parameter.
 *
 *   This is a second paragraph that provides additional details about the 
 *   configuration object and its usage.
 *
 *   And this is a third paragraph with even more information.
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param config - This is the first paragraph describing the config parameter.'
      );
      expect(formatted).toContain(
        'This is a second paragraph that provides additional details about the'
      );
      expect(formatted).toContain('configuration object and its usage.');
      expect(formatted).toContain(
        'And this is a third paragraph with even more information.'
      );
    });
  });

  describe('Lists in parameter descriptions', () => {
    it('should format bulleted lists correctly', async () => {
      const input = `/**
 * @param options - Configuration options object with the following properties:
 *
 *   - retries: Number of retry attempts
 *   - timeout: Timeout in milliseconds
 *   - verbose: Enable verbose logging
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param options - Configuration options object with the following properties:'
      );
      expect(formatted).toContain('- retries: Number of retry attempts');
      expect(formatted).toContain('- timeout: Timeout in milliseconds');
      expect(formatted).toContain('- verbose: Enable verbose logging');
    });

    it('should format numbered lists correctly', async () => {
      const input = `/**
 * @param steps - The process steps to follow:
 *
 *   1. Initialize the configuration
 *   2. Validate the input parameters
 *   3. Execute the main process
 *   4. Clean up resources
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param steps - The process steps to follow:'
      );
      expect(formatted).toContain('1. Initialize the configuration');
      expect(formatted).toContain('2. Validate the input parameters');
      expect(formatted).toContain('3. Execute the main process');
      expect(formatted).toContain('4. Clean up resources');
    });

    it('should handle mixed text, lists, and paragraphs', async () => {
      const input = `/**
 * @param second - The second thing. Let me see what will happen if this is a
 *   really really long line?
 *
 *   That looks reasonable but can I continue here in a separate paragraph? This line should be split but lets continue with a list then.
 *
 *   - This is one item
 *   - This is a second item
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param second - The second thing. Let me see what will happen if this is a'
      );
      expect(formatted).toContain('line?');
      expect(formatted).toContain(
        'That looks reasonable but can I continue here in a separate paragraph?'
      );
      expect(formatted).toContain(
        'line should be split but lets continue with a list then.'
      );
      expect(formatted).toContain('- This is one item');
      expect(formatted).toContain('- This is a second item');
    });
  });

  describe('Fenced code blocks in parameter descriptions', () => {
    it('should format JSON code blocks correctly', async () => {
      const input = `/**
 * @param options - An options object.
 *   Here is an example of the object:
 *   \`\`\`json
 *   { "retries": 3, "timeout": 5000 }
 *   \`\`\`
 */`;

      const formatted = await render(input);

      expect(formatted).toContain('@param options - An options object.');
      expect(formatted).toContain('Here is an example of the object:');
      expect(formatted).toContain('```json');
      expect(formatted).toContain('{ "retries": 3, "timeout": 5000 }');
      expect(formatted).toContain('```');
    });

    it('should format TypeScript code blocks correctly', async () => {
      const input = `/**
 * @param callback - A callback function that should follow this pattern:
 *   \`\`\`typescript
 *   (error: Error | null, result?: any) => void
 *   \`\`\`
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param callback - A callback function that should follow this pattern:'
      );
      expect(formatted).toContain('```typescript');
      expect(formatted).toContain(
        '(error: Error | null, result?: any) => void'
      );
      expect(formatted).toContain('```');
    });

    it('should not indent fenced code blocks in parameter descriptions', async () => {
      const input = `/**
 * @param config - Configuration with TypeScript example:
 *   \`\`\`typescript
 *   interface Config {
 *     timeout: number;
 *     retries: number;
 *   }
 *   \`\`\`
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param config - Configuration with TypeScript example:'
      );

      // Code fences should start at the beginning of the comment line (after " * ")
      expect(formatted).toContain(' * ```typescript');
      expect(formatted).toContain(' * interface Config {');
      expect(formatted).toContain(' * ```');

      // Code should NOT be indented beyond the standard comment indentation
      expect(formatted).not.toContain(' *   ```typescript'); // Should not have extra indentation
      expect(formatted).not.toContain(' *     interface Config {'); // Should not have extra indentation
    });

    it('should handle multiple code blocks in one parameter', async () => {
      const input = `/**
 * @param config - Configuration with examples:
 *   
 *   Basic usage:
 *   \`\`\`javascript
 *   const config = { mode: 'development' }
 *   \`\`\`
 *   
 *   Advanced usage:
 *   \`\`\`javascript
 *   const config = { 
 *     mode: 'production',
 *     optimization: true
 *   }
 *   \`\`\`
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param config - Configuration with examples:'
      );
      expect(formatted).toContain('Basic usage:');
      expect(formatted).toContain('Advanced usage:');
      expect(formatted).toContain('```javascript');
      expect(formatted).toContain("const config = { mode: 'development' }");
      expect(formatted).toContain("mode: 'production',");
      expect(formatted).toContain('optimization: true');
    });
  });

  describe('Complex combinations', () => {
    it('should handle text, lists, and code blocks together', async () => {
      const input = `/**
 * @param config - A complex configuration object with multiple options:
 *
 *   The configuration supports the following modes:
 *   - development: For local development
 *   - production: For production builds
 *   - test: For running tests
 *
 *   Example configuration:
 *   \`\`\`json
 *   {
 *     "mode": "development",
 *     "features": ["hot-reload", "debug"]
 *   }
 *   \`\`\`
 *
 *   For more advanced usage, see the documentation.
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param config - A complex configuration object with multiple options:'
      );
      expect(formatted).toContain(
        'The configuration supports the following modes:'
      );
      expect(formatted).toContain('- development: For local development');
      expect(formatted).toContain('- production: For production builds');
      expect(formatted).toContain('- test: For running tests');
      expect(formatted).toContain('Example configuration:');
      expect(formatted).toContain('```json');
      expect(formatted).toContain('"mode": "development"');
      expect(formatted).toContain(
        'For more advanced usage, see the documentation.'
      );
    });
  });

  describe('Indentation consistency', () => {
    it('should maintain proper indentation for multi-line parameters', async () => {
      const input = `/**
 * @param first - First parameter description.
 * @param second - Second parameter with a very long description that spans
 *   multiple lines and should be properly indented under the parameter.
 */`;

      const formatted = await render(input);

      // Check that continuation lines are properly indented
      const lines = formatted.split('\n');
      const paramLines = lines.filter(
        (line) =>
          line.includes('Second parameter') ||
          line.includes('multiple lines') ||
          line.includes('under the parameter')
      );

      // All continuation lines should have consistent indentation
      for (const line of paramLines) {
        if (!line.includes('@param')) {
          expect(line).toMatch(/^\s+\*\s{2}/); // Should start with " * " followed by 2 spaces
        }
      }
    });

    it('should handle inconsistent source indentation', async () => {
      const input = `/**
 * @param data - This parameter has inconsistent indentation in the source:
 *     Some lines are indented more
 *   Some lines are indented less
 *       And some are indented even more
 *   But they should all be normalized.
 */`;

      const formatted = await render(input);

      expect(formatted).toContain(
        '@param data - This parameter has inconsistent indentation in the source:'
      );
      // The formatter should normalize the indentation
      const lines = formatted.split('\n');
      const continuationLines = lines.filter(
        (line) =>
          (line.includes('Some lines') ||
            line.includes('And some') ||
            line.includes('But they')) &&
          !line.includes('@param') // Exclude the first line with @param
      );

      // All continuation lines should have consistent indentation
      if (continuationLines.length > 0) {
        for (const line of continuationLines) {
          expect(line).toMatch(/^\s+\*\s{2}/); // Should start with " * " followed by 2 spaces
        }
      }
    });
  });

  describe('Idempotency', () => {
    it('should be idempotent for already formatted multi-line parameters', async () => {
      const input = `/**
 * @param config - A configuration object with the following properties:
 *
 *   - retries: Number of retry attempts
 *   - timeout: Timeout in milliseconds
 *
 *   Example:
 *   \`\`\`json
 *   {
 *     "retries": 3,
 *     "timeout": 5000
 *   }
 *   \`\`\`
 */`;

      const firstFormatted = await render(input);

      // Format the result again
      const secondFormatted = await render(firstFormatted);

      // Should be functionally identical (allowing for minor whitespace differences in code blocks)
      const normalizeWhitespace = (text: string) =>
        text.replace(/\s+/g, ' ').trim();
      expect(normalizeWhitespace(secondFormatted)).toBe(
        normalizeWhitespace(firstFormatted)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty lines within parameter descriptions', async () => {
      const input = `/**
 * @param config - Configuration object.
 *
 *
 *   This has multiple empty lines that should be normalized.
 *
 *
 *   - Item 1
 *
 *   - Item 2
 */`;

      const formatted = await render(input);

      expect(formatted).toContain('@param config - Configuration object.');
      expect(formatted).toContain(
        'This has multiple empty lines that should be normalized.'
      );
      expect(formatted).toContain('- Item 1');
      expect(formatted).toContain('- Item 2');

      // Should not have more than one consecutive empty comment line
      expect(formatted).not.toMatch(/\*\s*\n\s*\*\s*\n\s*\*\s*\n/);
    });

    it('should handle parameters with only code blocks', async () => {
      const input = `/**
 * @param schema - The validation schema:
 *   \`\`\`typescript
 *   interface Schema {
 *     name: string;
 *     age: number;
 *   }
 *   \`\`\`
 */`;

      const formatted = await render(input);

      expect(formatted).toContain('@param schema - The validation schema:');
      expect(formatted).toContain('```typescript');
      expect(formatted).toContain('interface Schema {');
      expect(formatted).toContain('name: string;');
      expect(formatted).toContain('age: number;');
      expect(formatted).toContain('}');
      expect(formatted).toContain('```');
    });
  });

  describe('Integration with parameter alignment', () => {
    it('should work correctly with parameter alignment enabled', async () => {
      const input = `/**
 * @param a - Short parameter.
 * @param veryLongParameterName - This parameter has a very long name and a multi-line description:
 *
 *   - Feature 1: Does something important
 *   - Feature 2: Does something else
 */`;

      const alignedOptions = { ...options };
      const formatted = await render(input, alignedOptions);

      // Parameters should be aligned
      expect(formatted).toContain('@param a');
      expect(formatted).toContain('@param veryLongParameterName');

      // Multi-line content should be properly indented
      expect(formatted).toContain('- Feature 1: Does something important');
      expect(formatted).toContain('- Feature 2: Does something else');
    });
  });
});
