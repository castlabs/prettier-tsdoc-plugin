/**
 * Type definitions for TSDoc plugin to improve type safety
 */

import type { ParserOptions, AstPath } from 'prettier';
import type { DocNode, DocBlock, TSDocParser } from '@microsoft/tsdoc';

/**
 * TSDoc plugin-specific configuration options
 */
export interface TSDocPluginOptions {
  fencedIndent?: 'space' | 'none';
  normalizeTagOrder?: boolean;
  dedupeReleaseTags?: boolean;
  splitModifiers?: boolean;
  singleSentenceSummary?: boolean;
  releaseTagStrategy?: 'keep-first' | 'keep-last';
  alignParamTags?: boolean;
  defaultReleaseTag?: string;
  onlyExportedAPI?: boolean;
  inheritanceAware?: boolean;
  extraTags?: string[];
  normalizeTags?: Record<string, string>;
}

/**
 * Prettier options extended with TSDoc plugin options
 */
export interface PrettierOptionsWithTSDoc extends ParserOptions<any> {
  tsdoc?: TSDocPluginOptions;
  logger?: {
    warn?(message: string, ...args: any[]): void;
    debug?(message: string, ...args: any[]): void;
    info?(message: string, ...args: any[]): void;
    error?(message: string, ...args: any[]): void;
  };
}

/**
 * Comment structure from Prettier AST
 */
export interface CommentNode {
  type: 'Block' | 'Line' | 'CommentBlock' | 'CommentLine';
  value: string;
  start?: number;
  end?: number;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

/**
 * Prettier Doc types (simplified representation)
 */
export type PrettierDoc = string | number | PrettierDoc[] | PrettierDocObject;

export interface PrettierDocObject {
  type?:
    | 'concat'
    | 'group'
    | 'line'
    | 'hardline'
    | 'softline'
    | 'fill'
    | 'break-parent'
    | 'indent'
    | 'dedent';
  parts?: PrettierDoc[];
  contents?: PrettierDoc;
  value?: any;
  text?: any;
}

/**
 * TSDoc node types with better typing
 */
export interface ParamTag {
  tagName: string;
  name: string;
  description: string;
  rawNode: DocBlock | null;
}

export interface ReturnsTag {
  tagName: string;
  content: string;
  rawNode: DocBlock | null;
}

export interface OtherTag {
  tagName: string;
  content: string;
  rawNode: DocNode | null;
}

/**
 * Enhanced TSDoc comment model with better types
 */
export interface TSDocCommentModel {
  summary?: {
    type: 'summary';
    content: string;
  };
  remarks?: {
    type: 'remarks';
    content: string;
  };
  params: ParamTag[];
  typeParams: ParamTag[];
  returns?: ReturnsTag;
  otherTags: OtherTag[];
}

/**
 * Error classification types
 */
export enum FormatErrorType {
  PARSE_ERROR = 'parse',
  FORMAT_ERROR = 'format',
  AST_ERROR = 'ast',
  CONFIG_ERROR = 'config',
}

/**
 * Error recovery strategy
 */
export enum ErrorRecoveryStrategy {
  RETURN_ORIGINAL = 'return_original',
  MINIMAL_FORMAT = 'minimal_format',
  SKIP_FORMATTING = 'skip_formatting',
}

/**
 * Format context for error handling
 */
export interface FormatContext {
  commentText: string;
  options: PrettierOptionsWithTSDoc;
  parser: TSDocParser;
  commentPath?: AstPath<CommentNode>;
}

/**
 * Cache key structure for parser caching
 */
export interface ParserCacheKey {
  extraTags: string[];
  configHash?: string;
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Text width calculation context
 */
export interface WidthContext {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  indentLevel: number;
  commentPrefixWidth: number;
}

/**
 * Alignment calculation result
 */
export interface AlignmentInfo {
  maxHeaderWidth: number;
  alignmentColumn: number;
  shouldAlign: boolean;
}

/**
 * Language mapping for code blocks
 */
export type LanguageMapping = {
  [key: string]: string;
};

/**
 * Tag normalization mapping
 */
export type TagNormalizationMap = {
  [key: string]: string;
};

/**
 * Utility type for extracting string literal types
 */
export type StringLiteral<T> = T extends string
  ? string extends T
    ? never
    : T
  : never;

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: TSDocPluginOptions;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  beforeFormat?: (context: FormatContext) => void;
  afterFormat?: (result: string, context: FormatContext) => string;
  onError?: (error: Error, context: FormatContext) => string | void;
}
