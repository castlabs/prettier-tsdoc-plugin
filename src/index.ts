import type { Plugin } from 'prettier';
import parserBabel from 'prettier/parser-babel';
import parserTypescript from 'prettier/parser-typescript';
import { preprocessJavaScript, preprocessTypescript } from './preprocessor.js';
import type { PrettierOptionsWithTSDoc } from './types.js';

const plugin: Plugin = {
  // Define languages that this plugin supports
  languages: [
    {
      name: 'TypeScript',
      parsers: ['typescript'],
      extensions: ['.ts', '.tsx'],
    },
    {
      name: 'JavaScript',
      parsers: ['babel'],
      extensions: ['.js', '.jsx'],
    },
  ],
  // Extend existing parsers with our preprocessing logic
  parsers: {
    typescript: {
      ...parserTypescript.parsers.typescript,
      preprocess: (text: string, options: PrettierOptionsWithTSDoc) => {
        return preprocessTypescript(text, options);
      },
    },
    babel: {
      ...parserBabel.parsers.babel,
      preprocess: (text: string, options: PrettierOptionsWithTSDoc) => {
        return preprocessJavaScript(text, options);
      },
    },
  },
  options: {
    fencedIndent: {
      type: 'choice',
      category: 'TSDoc',
      default: 'space',
      description: 'Indentation style for fenced code blocks',
      choices: [
        { value: 'space', description: 'Add one space indentation' },
        { value: 'none', description: 'No additional indentation' },
      ],
    },
    normalizeTagOrder: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Normalize tag order based on conventional patterns',
    },
    dedupeReleaseTags: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Deduplicate release tags (@public, @beta, etc)',
    },
    splitModifiers: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Split modifiers to separate lines',
    },
    singleSentenceSummary: {
      type: 'boolean',
      category: 'TSDoc',
      default: false,
      description: 'Enforce single sentence summaries',
    },
    releaseTagStrategy: {
      type: 'choice',
      category: 'TSDoc',
      default: 'keep-first',
      description: 'Strategy for release tag deduplication',
      choices: [
        { value: 'keep-first', description: 'Keep the first occurrence' },
        { value: 'keep-last', description: 'Keep the last occurrence' },
      ],
    },
    alignParamTags: {
      type: 'boolean',
      category: 'TSDoc',
      default: false,
      description: 'Align parameter descriptions in @param and @typeParam tags',
    },
    defaultReleaseTag: {
      type: 'string',
      category: 'TSDoc',
      default: '@internal',
      description:
        'Default release tag to add when no release tag is present (use null to disable)',
    },
    onlyExportedAPI: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description:
        'Only add release tags to exported API constructs (AST-aware detection)',
    },
    inheritanceAware: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description:
        'Respect inheritance rules - skip tagging class/interface members',
    },
    closureCompilerCompat: {
      type: 'boolean',
      category: 'TSDoc',
      default: true,
      description: 'Enable legacy Closure Compiler annotation transformations',
    },
  },
};

export { createTSDocConfiguration } from './parser-config.js';
export { formatTSDocComment } from './format.js';
export { safeDocToString } from './utils/doc-to-string.js';
export default plugin;
