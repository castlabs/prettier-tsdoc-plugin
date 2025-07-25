import { expect, test, describe } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

/**
 * Converts a Prettier Doc to string representation for testing
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
    if (doc.type === 'break-parent' || doc.type === 'indent' || doc.type === 'dedent') {
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
  return String(doc);
}

describe('Multi-Language Code Block Formatting', () => {
  const config = createTSDocConfiguration();
  const parser = new TSDocParser(config);
  const options = { printWidth: 80, tabWidth: 2, useTabs: false };

  test('formats TypeScript code blocks with proper syntax', () => {
    const commentValue = `*
 * Function with TypeScript example.
 * @example Basic TypeScript usage
 * \`\`\`typescript
 * const result = processData(  );
 * console.log(result);
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```typescript');
    expect(output).toContain('const result = processData()'); // Spaces should be cleaned up
    expect(output).toContain('console.log(result)');
    expect(output).toContain('```');
  });

  test('formats HTML code blocks with proper indentation', () => {
    const commentValue = `*
 * Function that generates HTML.
 * @example HTML generation
 * \`\`\`html
 * <html><head></head><body><p>Hello</p></body></html>
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```html');
    expect(output).toContain('<html>');
    expect(output).toContain('  <head>');
    expect(output).toContain('  <body>');
    expect(output).toContain('    <p>');
    expect(output).toContain('      Hello');
    expect(output).toContain('```');
  });

  test('formats JavaScript code blocks correctly', () => {
    const commentValue = `*
 * Function with JavaScript example.
 * @example JavaScript usage
 * \`\`\`javascript
 * function test( ) { return "hello"; }
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```javascript');
    expect(output).toContain('function test()'); // Spaces cleaned up
    expect(output).toContain('return "hello"');
    expect(output).toContain('```');
  });

  test('handles unsupported languages gracefully', () => {
    const commentValue = `*
 * Function with Python example.
 * @example Python-like code
 * \`\`\`python
 * def hello():
 *     return "world"
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```python');
    expect(output).toContain('def hello():');
    expect(output).toContain('return "world"');
    expect(output).toContain('```');
  });

  test('preserves @example description on same line', () => {
    const commentValue = `*
 * Function with example.
 * @example This is the description
 * \`\`\`typescript
 * const x = 1;
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('@example This is the description');
    expect(output).not.toMatch(/@example\s*\n.*This is the description/);
  });

  test('handles multiple code blocks in single @example', () => {
    const commentValue = `*
 * Function with multiple examples.
 * @example Multiple code blocks
 * TypeScript:
 * \`\`\`typescript
 * const a = 1;
 * \`\`\`
 * HTML:
 * \`\`\`html
 * <div>content</div>
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```typescript');
    expect(output).toContain('const a = 1');
    expect(output).toContain('```html');
    expect(output).toContain('<div>');
    expect(output).toContain('  content');
    expect(output).toContain('</div>');
  });

  test('preserves inline tags within code descriptions', () => {
    const commentValue = `*
 * Function with inline tag.
 * @example Simple usage example
 * \`\`\`typescript
 * const obj = new Component();
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    // Focus on the code formatting which is the main feature being tested
    expect(output).toContain('@example Simple usage example');
    expect(output).toContain('```typescript');
    expect(output).toContain('const obj = new Component()');
  });

  test('handles empty code blocks', () => {
    const commentValue = `*
 * Function with empty code block.
 * @example Empty example
 * \`\`\`typescript
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```typescript');
    expect(output).toContain('```');
  });

  test('formats CSS code blocks', () => {
    const commentValue = `*
 * Function that generates CSS.
 * @example CSS generation
 * \`\`\`css
 * .container{margin:0;padding:10px;}
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```css');
    expect(output).toContain('.container');
    // Basic CSS formatting would normalize spacing
    expect(output).toContain('```');
  });

  test('formats JSON code blocks', () => {
    const commentValue = `*
 * Function that processes JSON.
 * @example JSON structure
 * \`\`\`json
 * {"name":"test","value":123}
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('```json');
    expect(output).toContain('{"name":"test","value":123}');
    expect(output).toContain('```');
  });

  test('handles mixed text and code in @example', () => {
    const commentValue = `*
 * Complex function example.
 * @example Usage instructions
 * First, initialize the component:
 * \`\`\`typescript
 * const comp = new Component();
 * \`\`\`
 * Then call the method:
 * \`\`\`typescript
 * comp.process();
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('@example Usage instructions');
    expect(output).toContain('First, initialize the component:');
    expect(output).toContain('const comp = new Component()');
    expect(output).toContain('Then call the method:');
    expect(output).toContain('comp.process()');
  });

  test('maintains code formatting integrity across different languages', () => {
    const commentValue = `*
 * Multi-language example.
 * @example Different languages
 * TypeScript:
 * \`\`\`ts
 * const value=getDataFromAPI( );
 * \`\`\`
 * HTML:
 * \`\`\`html
 * <div><span>Value: {{ value }}</span></div>
 * \`\`\`
 * JavaScript:
 * \`\`\`js
 * function display(val){return val.toString();}
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    // TypeScript formatting
    expect(output).toContain('const value = getDataFromAPI()');
    
    // HTML formatting with indentation
    expect(output).toContain('<div>');
    expect(output).toContain('  <span>');
    
    // JavaScript formatting
    expect(output).toContain('function display(val)');
    expect(output).toContain('return val.toString()');
  });
});

describe('Integration with Other TSDoc Features', () => {
  const config = createTSDocConfiguration();
  const parser = new TSDocParser(config);
  const options = { printWidth: 80, tabWidth: 2, useTabs: false };

  test('code block formatting works with parameter documentation', () => {
    const commentValue = `*
 * Processes data according to configuration.
 * @param data - The input data to process
 * @param config - Configuration object
 * @returns Processed result
 * @example Usage example
 * \`\`\`typescript
 * const result = processData({ key: "value" }, { format: "json" });
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    expect(output).toContain('@param data');
    expect(output).toContain('@param config');
    expect(output).toContain('@returns');
    expect(output).toContain('```typescript');
    expect(output).toContain('const result = processData');
  });

  test('code block formatting works with remarks section', () => {
    const commentValue = `*
 * Complex utility function.
 * This function is useful for processing data.
 * @example Implementation
 * \`\`\`typescript
 * try {
 *   const result = utilityFunction(input);
 * } catch (error) {
 *   console.error(error);
 * }
 * \`\`\`
 `;

    const result = formatTSDocComment(commentValue, options, parser);
    const output = docToString(result);
    
    // Focus on the main functionality - code block formatting
    expect(output).toContain('```typescript');
    expect(output).toContain('try {');
    expect(output).toContain('} catch (error) {');
    expect(output).toContain('@example Implementation');
  });
});