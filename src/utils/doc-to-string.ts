/**
 * Utility functions for converting Prettier Doc objects to strings
 * Decomposed from the large docToString function for better maintainability
 */

import type { PrettierDocObject } from '../types.js';
import { isDebugEnabled } from './common.js';

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
  return doc.map((item) => docToString(item)).join('');
}

/**
 * Handles Prettier Doc objects with specific types
 */
export function handleDocObject(doc: any): string {
  // Handle concat and parts-based objects
  if (doc.type === 'concat' || (doc.parts && Array.isArray(doc.parts))) {
    return doc.parts!.map(docToString).join('');
  }

  // Handle group objects
  if (doc.type === 'group' && doc.contents) {
    return docToString(doc.contents);
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
    return doc.parts.map(docToString).join(' ');
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
    return docToString(doc.contents);
  }

  // Try parts property
  if (doc.parts !== undefined) {
    return Array.isArray(doc.parts)
      ? doc.parts.map(docToString).join('')
      : docToString(doc.parts);
  }

  // Try value property
  if (doc.value !== undefined) {
    return docToString(doc.value);
  }

  // Try text property
  if (doc.text !== undefined) {
    return docToString(doc.text);
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
export function docToString(doc: any): string {
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

/**
 * Converts multiple docs to strings and joins them
 */
export function docsToString(docs: any[]): string {
  return docs.map(docToString).join('');
}

/**
 * Converts docs to string with custom separator
 */
export function docsToStringWithSeparator(
  docs: any[],
  separator: string
): string {
  return docs.map(docToString).join(separator);
}

/**
 * Safe version of docToString that never throws
 */
export function safeDocToString(doc: any, fallback: string = ''): string {
  try {
    return docToString(doc);
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
export function docToStringTrimmed(doc: any): string {
  return docToString(doc).trim();
}

/**
 * Converts doc to string and normalizes whitespace
 */
export function docToStringNormalized(doc: any): string {
  return docToString(doc).replace(/\s+/g, ' ').trim();
}
