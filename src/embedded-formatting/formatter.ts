import prettier from 'prettier';
import type { ParserOptions, Options } from 'prettier';
import pluginBabel from 'prettier/plugins/babel';
import pluginTypescript from 'prettier/plugins/typescript';
import pluginHtml from 'prettier/plugins/html';
import pluginPostcss from 'prettier/plugins/postcss';
import pluginMarkdown from 'prettier/plugins/markdown';
import pluginYaml from 'prettier/plugins/yaml';
import pluginGraphql from 'prettier/plugins/graphql';
import pluginEstree from 'prettier/plugins/estree';
import { resolveOptions } from '../config.js';
import type { PrettierOptionsWithTSDoc } from '../types.js';

const LANGUAGE_TO_PARSER: Record<string, string> = {
  // TypeScript/JavaScript
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'babel',
  js: 'babel',
  jsx: 'babel',
  tsx: 'typescript',

  // Web technologies
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',

  // Data formats
  json: 'json',
  json5: 'json5',
  yaml: 'yaml',
  yml: 'yaml',

  // Documentation / structured content
  markdown: 'markdown',
  md: 'markdown',
  graphql: 'graphql',
};

const FORWARDED_OPTION_KEYS = [
  'printWidth',
  'tabWidth',
  'useTabs',
  'semi',
  'singleQuote',
  'trailingComma',
  'bracketSpacing',
  'bracketSameLine',
  'arrowParens',
  'quoteProps',
  'jsxSingleQuote',
  'singleAttributePerLine',
  'htmlWhitespaceSensitivity',
  'proseWrap',
  'endOfLine',
  'embeddedLanguageFormatting',
] as const;

type ForwardableOption = (typeof FORWARDED_OPTION_KEYS)[number];

function normalizePlugin(module: any): any {
  return module?.default ?? module;
}

const EMBEDDED_PLUGINS = [
  pluginBabel,
  pluginTypescript,
  pluginHtml,
  pluginPostcss,
  pluginMarkdown,
  pluginYaml,
  pluginGraphql,
  pluginEstree,
].map(normalizePlugin);

export const EMBEDDED_FORMATTER_FLAG = Symbol.for(
  'prettier-tsdoc-plugin.embedded-formatter'
);

export interface FormatEmbeddedCodeInput {
  code: string;
  language: string;
  parentOptions?: ParserOptions<any>;
  embeddedLanguageFormatting?: 'auto' | 'off';
}

export async function formatEmbeddedCode({
  code,
  language,
  parentOptions,
  embeddedLanguageFormatting,
}: FormatEmbeddedCodeInput): Promise<string> {
  const cleanedFallback = cleanupSnippet(code);

  if (!cleanedFallback) {
    return cleanedFallback;
  }

  const parser = LANGUAGE_TO_PARSER[language.toLowerCase()];
  if (!parser) {
    return cleanedFallback;
  }

  const effectivePreference = resolveEmbeddedPreference(
    parentOptions,
    embeddedLanguageFormatting
  );

  if (effectivePreference === 'off') {
    return cleanedFallback;
  }

  if (parentOptions) {
    const optionsRecord = parentOptions as unknown as Record<
      PropertyKey,
      unknown
    >;
    if (optionsRecord[EMBEDDED_FORMATTER_FLAG]) {
      return cleanedFallback;
    }
  }

  const forwarded = extractForwardedOptions(parentOptions);

  try {
    const formatOptions = {
      ...forwarded,
      parser,
      plugins: EMBEDDED_PLUGINS,
    } as Options;

    const formatted = await prettier.format(code, {
      ...formatOptions,
      [EMBEDDED_FORMATTER_FLAG]: true,
    } as Options);
    return formatted.trim();
  } catch {
    return cleanedFallback;
  }
}

function extractForwardedOptions(
  parentOptions?: ParserOptions<any>
): Partial<Record<ForwardableOption, unknown>> {
  if (!parentOptions) {
    return {};
  }

  const forwarded: Partial<Record<ForwardableOption, unknown>> = {};
  for (const key of FORWARDED_OPTION_KEYS) {
    if (key in parentOptions) {
      forwarded[key] = (parentOptions as any)[key];
    }
  }
  return forwarded;
}

function cleanupSnippet(snippet: string): string {
  return snippet.trim().replace(/\s+$/gm, '');
}

function resolveEmbeddedPreference(
  parentOptions?: ParserOptions<any>,
  explicit?: 'auto' | 'off'
): 'auto' | 'off' {
  if (explicit) {
    return explicit;
  }

  if (!parentOptions) {
    return 'auto';
  }

  const resolved = resolveOptions(
    parentOptions as PrettierOptionsWithTSDoc
  );

  return resolved.embeddedLanguageFormatting;
}
