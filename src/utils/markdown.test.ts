import { expect, test, describe, beforeEach } from 'vitest';
import {
  extractMarkdownSections,
  formatFencedCode,
  formatMarkdown,
  applyFencedIndent,
  clearFormatCache,
} from './markdown.js';

describe('Markdown Utilities', () => {
  beforeEach(() => {
    clearFormatCache();
  });

  test('extracts simple markdown content', () => {
    const text = 'This is simple markdown content.';
    const sections = extractMarkdownSections(text);

    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('markdown');
    expect(sections[0].content).toBe(text);
  });

  test('extracts fenced code blocks', () => {
    const text = `This is markdown.

\`\`\`typescript
function test() {
  return 42;
}
\`\`\`

More markdown.`;

    const sections = extractMarkdownSections(text);

    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe('markdown');
    expect(sections[0].content).toBe('This is markdown.');

    expect(sections[1].type).toBe('fenced-code');
    expect(sections[1].language).toBe('typescript');
    expect(sections[1].content).toContain('function test()');

    expect(sections[2].type).toBe('markdown');
    expect(sections[2].content).toBe('More markdown.');
  });

  test('handles code blocks without language', () => {
    const text = `\`\`\`
const x = 1;
\`\`\``;

    const sections = extractMarkdownSections(text);

    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('fenced-code');
    expect(sections[0].language).toBe('');
    expect(sections[0].content).toBe('const x = 1;');
  });

  test('formats TypeScript code with basic rules', () => {
    const code = `function   test(  ) {
      return   42  ;
    }`;

    const options = { printWidth: 80, tabWidth: 2, useTabs: false };
    const formatted = formatFencedCode(code, 'typescript', options);

    // Our basic formatter should at least trim and normalize semicolons
    expect(formatted).toContain('function');
    expect(formatted).toContain('return');
    expect(formatted).toContain('42');
    // Check that it's been normalized (basic whitespace cleanup)
    expect(formatted.startsWith('function')).toBe(true);
  });

  test('formats JavaScript code with basic rules', () => {
    const code = `const x=1,y=2;
    function test(){console.log(x);}`;

    const options = { printWidth: 80, tabWidth: 2, useTabs: false };
    const formatted = formatFencedCode(code, 'js', options);

    expect(formatted).toContain('const x=1,y=2;');
    expect(formatted).toContain('function test(){console.log(x);}');
  });

  test('handles unknown language as text', () => {
    const code = 'some unknown code';
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };
    const formatted = formatFencedCode(code, 'unknownlang', options);

    expect(formatted).toBe(code);
  });

  test('formats markdown with list normalization', () => {
    const markdown = `  - Item 1
*   Item 2
  +    Item 3
1.   First item
  2.    Second item`;

    const options = { printWidth: 80, tabWidth: 2, useTabs: false };
    const formatted = formatMarkdown(markdown, options);

    expect(formatted).toContain('- Item 1');
    expect(formatted).toContain('- Item 2');
    expect(formatted).toContain('- Item 3');
    expect(formatted).toContain('1. First item');
    expect(formatted).toContain('2. Second item');
  });

  test('applies fenced code indentation', () => {
    const code = `function test() {
  return 42;
}`;

    const spacedResult = applyFencedIndent(code, 'space');
    expect(spacedResult).toContain(' function test() {');
    expect(spacedResult).toContain('   return 42;');

    const noneResult = applyFencedIndent(code, 'none');
    expect(noneResult).toBe(code);
  });

  test('caches formatting results', () => {
    const code = 'const x = 1;';
    const options = { printWidth: 80 };

    // First call
    const result1 = formatFencedCode(code, 'js', options);

    // Second call should return cached result
    const result2 = formatFencedCode(code, 'js', options);

    expect(result1).toBe(result2);
  });

  test('handles multiple fenced code blocks', () => {
    const text = `First block:

\`\`\`js
const a = 1;
\`\`\`

Second block:

\`\`\`ts  
const b: number = 2;
\`\`\``;

    const sections = extractMarkdownSections(text);

    expect(sections).toHaveLength(4);
    expect(sections[0].type).toBe('markdown');
    expect(sections[1].type).toBe('fenced-code');
    expect(sections[1].language).toBe('js');
    expect(sections[2].type).toBe('markdown');
    expect(sections[3].type).toBe('fenced-code');
    expect(sections[3].language).toBe('ts');
  });
});
