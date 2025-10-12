import { expect, test, describe } from 'vitest';
import { buildCommentModel, extractTextFromNode } from './models.js';
import { createTSDocConfiguration } from './parser-config.js';
import {
  TSDocParser,
  TSDocConfiguration,
  TSDocTagDefinition,
  TSDocTagSyntaxKind,
} from '@microsoft/tsdoc';

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

  test('handles custom inline tags with curly braces', () => {
    // Create a configuration with a custom inline tag
    const config = new TSDocConfiguration();
    config.addTagDefinition(
      new TSDocTagDefinition({
        tagName: '@customInline',
        syntaxKind: TSDocTagSyntaxKind.InlineTag,
        allowMultiple: true,
      })
    );
    const parser = new TSDocParser(config);

    // Test that custom inline tag content is extracted with curly braces preserved
    const context = parser.parseString(`/**
 * Text with {@customInline some content} inline tag.
 */`);
    const model = buildCommentModel(context.docComment);

    expect(model.summary).toBeDefined();
    // The inline tag should be preserved in the summary with curly braces
    expect(model.summary?.content).toContain('{@customInline some content}');
  });

  test('handles custom block tags without curly braces', () => {
    // Create a configuration with a custom block tag
    const config = new TSDocConfiguration();
    config.addTagDefinition(
      new TSDocTagDefinition({
        tagName: '@customBlock',
        syntaxKind: TSDocTagSyntaxKind.BlockTag,
        allowMultiple: false,
      })
    );
    const parser = new TSDocParser(config);

    // Test that custom block tag is handled correctly
    const context = parser.parseString(`/**
 * Summary text.
 * @customBlock This is custom block content
 */`);
    const model = buildCommentModel(context.docComment);

    expect(model.summary).toBeDefined();
    expect(model.otherTags).toHaveLength(1);
    expect(model.otherTags[0].tagName).toBe('@customBlock');
    expect(model.otherTags[0].content).toBe('This is custom block content');
  });
});
