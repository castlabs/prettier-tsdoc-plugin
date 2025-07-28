/**
 * Enhanced error handling utilities for better error classification and recovery
 */

import type {
  FormatErrorType,
  ErrorRecoveryStrategy,
  FormatContext,
} from '../types.js';
import { ERRORS } from '../constants.js';
import {
  logError,
  logWarning,
  addCommentPrefixes,
  normalizeWhitespace,
} from './common.js';

/**
 * Classifies an error based on its type and message
 */
export function classifyError(error: Error): FormatErrorType {
  const message = error.message.toLowerCase();

  // TSDoc parser errors
  if (message.includes('tsdoc') || message.includes('parse')) {
    return ERRORS.TYPES.PARSE_ERROR as FormatErrorType;
  }

  // AST/node related errors
  if (
    message.includes('ast') ||
    message.includes('node') ||
    message.includes('traverse')
  ) {
    return ERRORS.TYPES.AST_ERROR as FormatErrorType;
  }

  // Configuration errors
  if (
    message.includes('config') ||
    message.includes('option') ||
    message.includes('setting')
  ) {
    return ERRORS.TYPES.CONFIG_ERROR as FormatErrorType;
  }

  // Default to format error
  return ERRORS.TYPES.FORMAT_ERROR as FormatErrorType;
}

/**
 * Determines the appropriate recovery strategy based on error type and context
 */
export function getErrorRecoveryStrategy(
  errorType: FormatErrorType,
  _context: string
): ErrorRecoveryStrategy {
  switch (errorType) {
    case ERRORS.TYPES.PARSE_ERROR:
      // Parser errors - try minimal formatting
      return ERRORS.RECOVERY.MINIMAL_FORMAT as ErrorRecoveryStrategy;

    case ERRORS.TYPES.AST_ERROR:
      // AST errors - skip formatting to avoid further issues
      return ERRORS.RECOVERY.SKIP_FORMATTING as ErrorRecoveryStrategy;

    case ERRORS.TYPES.CONFIG_ERROR:
      // Config errors - return original with warning
      return ERRORS.RECOVERY.RETURN_ORIGINAL as ErrorRecoveryStrategy;

    case ERRORS.TYPES.FORMAT_ERROR:
    default:
      // General format errors - try minimal formatting
      return ERRORS.RECOVERY.MINIMAL_FORMAT as ErrorRecoveryStrategy;
  }
}

/**
 * Applies minimal formatting to preserve basic comment structure
 */
export function applyMinimalFormatting(
  commentText: string,
  indentLevel: number = 0
): string {
  try {
    // Basic cleanup: normalize whitespace and ensure proper line structure
    const normalized = normalizeWhitespace(commentText);

    // Split into lines and clean up
    const lines = normalized.split('\n').map((line) => line.trim());

    // Remove empty lines at start and end
    while (lines.length > 0 && lines[0] === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    // Ensure we have content
    if (lines.length === 0) {
      return addCommentPrefixes('', indentLevel);
    }

    // Join with proper spacing
    const content = lines.join('\n');
    return addCommentPrefixes(content, indentLevel);
  } catch (_error) {
    // If even minimal formatting fails, return the original
    return commentText;
  }
}

/**
 * Handles formatting errors with appropriate recovery strategy
 */
export function handleFormatError(
  error: Error,
  context: FormatContext,
  fallbackContent?: string
): string {
  const errorType = classifyError(error);
  const recoveryStrategy = getErrorRecoveryStrategy(
    errorType,
    'comment formatting'
  );

  // Log the error appropriately based on type
  if (errorType !== ERRORS.TYPES.AST_ERROR) {
    logError(
      context.options.logger,
      `TSDoc ${errorType} error in comment formatting`,
      error
    );
  } else {
    // AST errors are often due to malformed input, log as warning
    logWarning(
      context.options.logger,
      `AST traversal issue in comment formatting: ${error.message}`
    );
  }

  // Apply recovery strategy
  switch (recoveryStrategy) {
    case ERRORS.RECOVERY.MINIMAL_FORMAT:
      return applyMinimalFormatting(
        fallbackContent || context.commentText,
        0 // TODO: Extract indent level from context
      );

    case ERRORS.RECOVERY.SKIP_FORMATTING:
      logWarning(
        context.options.logger,
        'Skipping formatting due to AST error - returning original comment'
      );
      return fallbackContent || context.commentText;

    case ERRORS.RECOVERY.RETURN_ORIGINAL:
    default:
      return fallbackContent || context.commentText;
  }
}

/**
 * Creates a safe wrapper for potentially throwing operations
 */
export function createSafeWrapper<TArgs extends any[], TReturn>(
  operation: (...args: TArgs) => TReturn,
  fallbackValue: TReturn,
  errorContext: string
) {
  return (...args: TArgs): TReturn => {
    try {
      return operation(...args);
    } catch (error) {
      // Log the error but don't throw
      if (error instanceof Error) {
        console.warn(
          `Safe wrapper caught error in ${errorContext}: ${error.message}`
        );
      } else {
        console.warn(
          `Safe wrapper caught unknown error in ${errorContext}: ${String(error)}`
        );
      }
      return fallbackValue;
    }
  };
}

/**
 * Validates format context to ensure all required fields are present
 */
export function validateFormatContext(
  context: Partial<FormatContext>
): context is FormatContext {
  if (!context.commentText || typeof context.commentText !== 'string') {
    return false;
  }

  if (!context.options || typeof context.options !== 'object') {
    return false;
  }

  if (!context.parser || typeof context.parser !== 'object') {
    return false;
  }

  return true;
}

/**
 * Creates a standardized error message for TSDoc plugin errors
 */
export function createErrorMessage(
  operation: string,
  error: Error,
  context?: string
): string {
  const contextStr = context ? ` (${context})` : '';
  return `TSDoc Plugin: ${operation} failed${contextStr}: ${error.message}`;
}

/**
 * Checks if an error is recoverable (not a critical system error)
 */
export function isRecoverableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Critical system errors that shouldn't be recovered from
  const criticalPatterns = [
    'out of memory',
    'stack overflow',
    'maximum call stack',
    'heap',
    'segmentation fault',
  ];

  return !criticalPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Enhanced error wrapper that provides detailed error information
 */
export class TSDocFormatError extends Error {
  public readonly errorType: FormatErrorType;
  public readonly recoveryStrategy: ErrorRecoveryStrategy;
  public readonly context: string;
  public readonly originalError: Error;

  constructor(
    originalError: Error,
    context: string,
    errorType?: FormatErrorType,
    recoveryStrategy?: ErrorRecoveryStrategy
  ) {
    const type = errorType || classifyError(originalError);
    const strategy =
      recoveryStrategy || getErrorRecoveryStrategy(type, context);

    super(createErrorMessage('Format operation', originalError, context));

    this.name = 'TSDocFormatError';
    this.errorType = type;
    this.recoveryStrategy = strategy;
    this.context = context;
    this.originalError = originalError;

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TSDocFormatError);
    }
  }

  /**
   * Returns whether this error can be recovered from
   */
  isRecoverable(): boolean {
    return isRecoverableError(this.originalError);
  }

  /**
   * Returns a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.errorType) {
      case ERRORS.TYPES.PARSE_ERROR:
        return 'Failed to parse TSDoc comment syntax';

      case ERRORS.TYPES.CONFIG_ERROR:
        return 'Invalid TSDoc plugin configuration';

      case ERRORS.TYPES.AST_ERROR:
        return 'Unable to process comment structure';

      case ERRORS.TYPES.FORMAT_ERROR:
      default:
        return 'Failed to format TSDoc comment';
    }
  }
}
