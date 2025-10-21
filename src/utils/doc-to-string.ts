/**
 * Utility functions for converting Prettier Doc objects to strings
 * Decomposed from the large docToString function for better maintainability
 */

import type { ParserOptions } from 'prettier';
import { printer } from 'prettier/doc';
import type { PrettierDocObject } from '../types.js';
import { isDebugEnabled } from './common.js';

export type DocPrinterConfig = {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  endOfLine: 'lf' | 'crlf' | 'cr' | 'auto';
};

const DEFAULT_PRINTER_CONFIG: DocPrinterConfig = Object.freeze({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
});

function resolvePrinterConfig(
  overrides?: Partial<DocPrinterConfig>
): DocPrinterConfig {
  if (!overrides) {
    return DEFAULT_PRINTER_CONFIG;
  }

  return {
    printWidth: overrides.printWidth ?? DEFAULT_PRINTER_CONFIG.printWidth,
    tabWidth: overrides.tabWidth ?? DEFAULT_PRINTER_CONFIG.tabWidth,
    useTabs: overrides.useTabs ?? DEFAULT_PRINTER_CONFIG.useTabs,
    endOfLine: overrides.endOfLine ?? DEFAULT_PRINTER_CONFIG.endOfLine,
  };
}

export function derivePrinterConfigFromParserOptions(
  options?: ParserOptions<any>
): Partial<DocPrinterConfig> | undefined {
  if (!options) {
    return undefined;
  }

  const config: Partial<DocPrinterConfig> = {};

  if (typeof options.printWidth === 'number') {
    config.printWidth = options.printWidth;
  }
  if (typeof options.tabWidth === 'number') {
    config.tabWidth = options.tabWidth;
  }
  if (typeof options.useTabs === 'boolean') {
    config.useTabs = options.useTabs;
  }
  if (typeof options.endOfLine === 'string') {
    config.endOfLine = options.endOfLine as DocPrinterConfig['endOfLine'];
  }

  return config;
}

/**
 * Checks if a value is a primitive type (string or number)
 */
export function isPrimitive(doc: unknown): doc is string | number {
  return typeof doc === 'string' || typeof doc === 'number';
}

/**
 * Handles primitive values (strings and numbers)
 */
export function handlePrimitive(doc: string | number): string {
  return String(doc);
}

/**
 * Handles null and undefined values
 */
export function handleNullish(_doc: null | undefined): string {
  return '';
}

/**
 * Handles array values by recursively converting each element
 */
export function handleArray(doc: any[]): string {
  return doc.map((item) => legacyDocToString(item)).join('');
}

/**
 * Handles Prettier Doc objects with specific types
 */
export function handleDocObject(doc: any): string {
  // Handle concat and parts-based objects
  if (doc.type === 'concat' || (doc.parts && Array.isArray(doc.parts))) {
    return doc.parts!.map(legacyDocToString).join('');
  }

  // Handle group objects
  if (doc.type === 'group' && doc.contents) {
    return legacyDocToString(doc.contents);
  }

  // Handle line breaks
  if (doc.type === 'line' || doc.type === 'hardline') {
    return '\n';
  }

  // Handle soft line breaks
  if (doc.type === 'softline') {
    return ' ';
  }

  // Handle fill objects
  if (doc.type === 'fill' && doc.parts) {
    return doc.parts.map(legacyDocToString).join(' ');
  }

  // Handle formatting control tokens (no content)
  if (isFormattingControlToken(doc.type || '')) {
    return '';
  }

  // Try to extract content from common properties
  return extractContentFromProperties(doc);
}

/**
 * Checks if a doc type is a formatting control token
 */
function isFormattingControlToken(type: string): boolean {
  const controlTokens = new Set([
    'break-parent',
    'indent',
    'dedent',
    'cursor',
    'trim',
    'line-suffix',
    'line-suffix-boundary',
  ]);

  return controlTokens.has(type);
}

/**
 * Extracts content from common object properties
 */
function extractContentFromProperties(doc: PrettierDocObject): string {
  // Try contents property first
  if (doc.contents !== undefined) {
    return legacyDocToString(doc.contents);
  }

  // Try parts property
  if (doc.parts !== undefined) {
    return Array.isArray(doc.parts)
      ? doc.parts.map(legacyDocToString).join('')
      : legacyDocToString(doc.parts);
  }

  // Try value property
  if (doc.value !== undefined) {
    return legacyDocToString(doc.value);
  }

  // Try text property
  if (doc.text !== undefined) {
    return legacyDocToString(doc.text);
  }

  return '';
}

/**
 * Handles unknown or unsupported object types
 */
export function handleFallback(doc: unknown): string {
  // Debug logging for unknown doc types
  if (isDebugEnabled()) {
    console.warn('[TSDoc Plugin] Unable to convert doc to string:', doc);
  }

  // Last resort: stringify the object
  return String(doc);
}

/**
 * Main function to convert Prettier Doc to string
 * Refactored to use smaller, focused functions
 */
function legacyDocToString(doc: any): string {
  // Handle primitives
  if (isPrimitive(doc)) {
    return handlePrimitive(doc);
  }

  // Handle null/undefined
  if (doc === null || doc === undefined) {
    return handleNullish(doc);
  }

  // Handle arrays
  if (Array.isArray(doc)) {
    return handleArray(doc);
  }

  // Handle objects
  if (doc && typeof doc === 'object') {
    return handleDocObject(doc as PrettierDocObject);
  }

  // Fallback for unknown types
  return handleFallback(doc);
}

function printWithPrettier(
  doc: any,
  printerOptions?: Partial<DocPrinterConfig>
): string {
  const resolvedOptions = resolvePrinterConfig(printerOptions);
  return printer.printDocToString(doc, resolvedOptions as any).formatted;
}

/**
 * Main function to convert Prettier Doc to string using Prettier's printer
 * with a fallback to the legacy converter.
 */
export function docToString(
  doc: any,
  printerOptions?: Partial<DocPrinterConfig>
): string {
  // Handle primitives early to avoid invoking the printer unnecessarily
  if (isPrimitive(doc)) {
    return handlePrimitive(doc);
  }

  if (doc === null || doc === undefined) {
    return handleNullish(doc);
  }

  try {
    return printWithPrettier(doc, printerOptions);
  } catch (error) {
    if (isDebugEnabled()) {
      console.warn('[TSDoc Plugin] Doc printer failed, using legacy fallback:', error);
    }
    return legacyDocToString(doc);
  }
}

/**
 * Converts multiple docs to strings and joins them
 */
export function docsToString(
  docs: any[],
  printerOptions?: Partial<DocPrinterConfig>
): string {
  return docs.map((item) => docToString(item, printerOptions)).join('');
}

/**
 * Converts docs to string with custom separator
 */
export function docsToStringWithSeparator(
  docs: any[],
  separator: string,
  printerOptions?: Partial<DocPrinterConfig>
): string {
  return docs
    .map((item) => docToString(item, printerOptions))
    .join(separator);
}

/**
 * Safe version of docToString that never throws
 */
export function safeDocToString(
  doc: any,
  fallback: string = '',
  printerOptions?: Partial<DocPrinterConfig>
): string {
  try {
    return docToString(doc, printerOptions);
  } catch (error) {
    if (isDebugEnabled()) {
      console.warn('[TSDoc Plugin] Error converting doc to string:', error);
    }
    return fallback;
  }
}

/**
 * Converts doc to string and trims whitespace
 */
export function docToStringTrimmed(
  doc: any,
  printerOptions?: Partial<DocPrinterConfig>
): string {
  return docToString(doc, printerOptions).trim();
}

/**
 * Converts doc to string and normalizes whitespace
 */
export function docToStringNormalized(
  doc: any,
  printerOptions?: Partial<DocPrinterConfig>
): string {
  return docToString(doc, printerOptions).replace(/\s+/g, ' ').trim();
}
