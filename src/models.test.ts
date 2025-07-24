import { expect, test, describe } from 'vitest';
import { buildCommentModel, extractTextFromNode } from './models.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('Comment Models', () => {
  test('extracts text from simple node', () => {
    const node = {
      kind: 'PlainText',
      text: 'Hello world',
    };
    
    expect(extractTextFromNode(node)).toBe('Hello world');
    expect(extractTextFromNode('direct string')).toBe('direct string');
    expect(extractTextFromNode(null)).toBe('');
  });

  test('extracts text from paragraph node', () => {
    const node = {
      kind: 'Paragraph',
      nodes: [
        { kind: 'PlainText', text: 'Hello ' },
        { kind: 'PlainText', text: 'world' },
      ],
    };
    
    expect(extractTextFromNode(node)).toBe('Hello world');
  });

  test('builds model from parsed comment with summary only', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const context = parser.parseString('/** This is a summary. */');
    const model = buildCommentModel(context.docComment);
    
    expect(model.summary).toBeDefined();
    expect(model.summary?.content).toContain('This is a summary');
    expect(model.remarks).toBeUndefined();
  });

  test('builds model from parsed comment with summary and remarks', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const context = parser.parseString(`/**
 * This is a summary.
 * @remarks
 * These are remarks.
 */`);
    const model = buildCommentModel(context.docComment);
    
    expect(model.summary).toBeDefined();
    expect(model.summary?.content).toContain('This is a summary');
    expect(model.remarks).toBeDefined();
    expect(model.remarks?.content).toContain('These are remarks');
  });

  test('builds model from remarks-only comment', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const context = parser.parseString(`/**
 * @remarks
 * Only remarks here.
 */`);
    const model = buildCommentModel(context.docComment);
    
    expect(model.summary).toBeUndefined();
    expect(model.remarks).toBeDefined();
    expect(model.remarks?.content).toContain('Only remarks here');
  });

  test('builds model with parameter tags', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const context = parser.parseString(`/**
 * Function with parameters.
 * @param name - The name parameter
 * @param age - The age parameter
 * @returns A greeting
 */`);
    const model = buildCommentModel(context.docComment);
    
    expect(model.summary).toBeDefined();
    expect(model.params).toHaveLength(2);
    expect(model.params[0].name).toBe('name');
    expect(model.params[0].description).toBe('The name parameter');
    expect(model.params[1].name).toBe('age');
    expect(model.params[1].description).toBe('The age parameter');
    expect(model.returns).toBeDefined();
    expect(model.returns?.content).toBe('A greeting');
  });

  test('builds model with type parameters', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    
    const context = parser.parseString(`/**
 * Generic function.
 * @typeParam T - The first type parameter
 * @typeParam U - The second type parameter
 */`);
    const model = buildCommentModel(context.docComment);
    
    expect(model.typeParams).toHaveLength(2);
    expect(model.typeParams[0].name).toBe('T');
    expect(model.typeParams[0].description).toBe('The first type parameter');
    expect(model.typeParams[1].name).toBe('U');
    expect(model.typeParams[1].description).toBe('The second type parameter');
  });
});