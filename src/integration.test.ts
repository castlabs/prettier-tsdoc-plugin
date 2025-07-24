import { expect, test, describe } from 'vitest';
import { createTSDocConfiguration } from './parser-config.js';
import { isTSDocCandidate } from './detection.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('Integration Tests - Phase 2', () => {
  test('parser successfully processes complex tag soup without throwing', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const complexComment = `/**
 * A complex function with many tags.
 * 
 * @param name - The user's name
 * @param age - The user's age  
 * @returns A greeting message
 * @example
 * \`\`\`ts
 * const greeting = greet("Alice", 25);
 * \`\`\`
 * @since 1.0.0
 * @deprecated Use {@link newGreet} instead
 * @beta
 * @category Utilities
 */`;

    // Should not throw
    expect(() => {
      const context = parser.parseString(complexComment);
      // Verify it parsed something
      expect(context.docComment).toBeDefined();
    }).not.toThrow();
  });

  test('detection correctly identifies TSDoc vs non-TSDoc comments', () => {
    // TSDoc candidate with @param and inline {@link}
    const tsdocComment = {
      type: 'CommentBlock',
      value: `*
 * This is a function.
 * @param name The name parameter
 * @returns A greeting with {@link SomeClass}
 `,
    };
    
    // Plain block comment
    const plainComment = {
      type: 'CommentBlock',
      value: ` plain comment `,
    };

    expect(isTSDocCandidate(tsdocComment)).toBe(true);
    expect(isTSDocCandidate(plainComment)).toBe(false);
  });

  test('parsing with extended configuration includes TypeDoc tags', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const commentWithExtendedTags = `/**
 * A function with extended tags.
 * @param value - Input value
 * @category Math
 * @beta
 * @since 2.0.0
 */`;

    const context = parser.parseString(commentWithExtendedTags);
    
    // Should parse without errors
    expect(context.log.messages.length).toBe(0);
    expect(context.docComment).toBeDefined();
  });
});