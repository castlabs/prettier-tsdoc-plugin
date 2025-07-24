import { expect, test, describe } from 'vitest';
import { isTSDocCandidate } from './detection.js';

describe('isTSDocCandidate', () => {
  test('detects TSDoc block with @param and inline {@link}', () => {
    const comment = {
      type: 'CommentBlock',
      value: '*\n * This is a function.\n * @param name The name parameter\n * @returns A greeting with {@link SomeClass}\n ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(true);
  });

  test('rejects plain block comment', () => {
    const comment = {
      type: 'CommentBlock',
      value: ' plain comment ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(false);
  });

  test('rejects single-line block comment', () => {
    const comment = {
      type: 'CommentBlock',
      value: '* single line comment *',
    };
    
    expect(isTSDocCandidate(comment)).toBe(false);
  });

  test('rejects line comment', () => {
    const comment = {
      type: 'CommentLine',
      value: ' not a block comment',
    };
    
    expect(isTSDocCandidate(comment)).toBe(false);
  });

  test('rejects comment starting with /*! (not /**)', () => {
    const comment = {
      type: 'CommentBlock',
      value: '!\n * License header\n * Copyright 2023\n ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(false);
  });

  test('accepts comment with inline tags only', () => {
    const comment = {
      type: 'CommentBlock',
      value: '*\n * See {@link MyClass} for details.\n ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(true);
  });

  test('accepts comment with block tags only', () => {
    const comment = {
      type: 'CommentBlock',
      value: '*\n * @deprecated Use newFunction instead\n ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(true);
  });

  test('accepts comment with summary text only', () => {
    const comment = {
      type: 'CommentBlock',
      value: '*\n * This is a simple description.\n * With multiple lines.\n ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(true);
  });

  test('force flag bypasses heuristics', () => {
    const comment = {
      type: 'CommentBlock',
      value: '*\n * \n ', // Empty content
    };
    
    expect(isTSDocCandidate(comment, false)).toBe(false);
    expect(isTSDocCandidate(comment, true)).toBe(true);
  });

  test('rejects empty multi-line comment', () => {
    const comment = {
      type: 'CommentBlock',
      value: '*\n * \n * \n ',
    };
    
    expect(isTSDocCandidate(comment)).toBe(false);
  });
});