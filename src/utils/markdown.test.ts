import { expect, test, describe, beforeEach } from 'vitest';
import {
  extractMarkdownSections,
  formatFencedCode,
  formatMarkdown,
  applyFencedIndent,
  clearFormatCache,
  stripCommentMarks,
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
    const formatted = formatFencedCode(code, 'typescript', options as any);

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
    const formatted = formatFencedCode(code, 'js', options as any);

    expect(formatted).toContain('const x=1,y=2;');
    expect(formatted).toContain('function test(){console.log(x);}');
  });

  test('handles unknown language as text', () => {
    const code = 'some unknown code';
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };
    const formatted = formatFencedCode(code, 'unknownlang', options as any);

    expect(formatted).toBe(code);
  });

  test('formats markdown with list normalization', () => {
    const markdown = `  - Item 1
*   Item 2
  +    Item 3
1.   First item
  2.    Second item`;

    const options = { printWidth: 80, tabWidth: 2, useTabs: false };
    const formatted = formatMarkdown(markdown, options as any);

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
    const result1 = formatFencedCode(code, 'js', options as any);

    // Second call should return cached result
    const result2 = formatFencedCode(code, 'js', options as any);

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

describe('stripCommentMarks', () => {
  test('strips basic comment markers', () => {
    const input = ' * Some text\n * More text';
    const result = stripCommentMarks(input);
    expect(result).toBe('Some text\nMore text');
  });

  test('handles empty comment lines', () => {
    const input = ' * Some text\n * \n * More text';
    const result = stripCommentMarks(input);
    expect(result).toBe('Some text\n\nMore text');
  });

  test('preserves bold markdown at start of line (**text**)', () => {
    const input = ' * Some text\n * \n * **Something Highlighted**:';
    const result = stripCommentMarks(input);
    expect(result).toBe('Some text\n\n**Something Highlighted**:');
  });

  test('preserves bold markdown when line starts with bold', () => {
    const input = ' * **Bold at start**';
    const result = stripCommentMarks(input);
    expect(result).toBe('**Bold at start**');
  });

  test('preserves italic markdown (*text*)', () => {
    const input = ' * This has *italic* text';
    const result = stripCommentMarks(input);
    expect(result).toBe('This has *italic* text');
  });

  test('preserves bold and italic markdown (***text***)', () => {
    const input = ' * ***Bold and italic***';
    const result = stripCommentMarks(input);
    expect(result).toBe('***Bold and italic***');
  });

  test('correctly strips list item after comment marker (* item)', () => {
    const input = ' * * List item with asterisk';
    const result = stripCommentMarks(input);
    expect(result).toBe('* List item with asterisk');
  });

  test('preserves content when already processed (no comment markers)', () => {
    const input = 'Some text\n\n**Something Highlighted**:';
    const result = stripCommentMarks(input);
    expect(result).toBe('Some text\n\n**Something Highlighted**:');
  });

  test('handles lines without trailing space after asterisk', () => {
    // Note: stripCommentMarks trims the final result, so the empty first line is removed
    const input = ' *\n * text';
    const result = stripCommentMarks(input);
    expect(result).toBe('text');
  });

  test('does not strip asterisks that are part of markdown bold syntax', () => {
    // This is a key idempotence test - running stripCommentMarks multiple times
    // should not progressively remove asterisks from bold syntax
    const input = '**Bold text**';
    const result1 = stripCommentMarks(input);
    const result2 = stripCommentMarks(result1);
    const result3 = stripCommentMarks(result2);

    expect(result1).toBe('**Bold text**');
    expect(result2).toBe('**Bold text**');
    expect(result3).toBe('**Bold text**');
  });

  test('idempotence with mixed content', () => {
    const input = 'Some text\n\n**Bold heading**:\n\nMore text';
    const result1 = stripCommentMarks(input);
    const result2 = stripCommentMarks(result1);

    expect(result1).toBe(input);
    expect(result2).toBe(input);
  });
});
