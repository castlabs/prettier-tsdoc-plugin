/**
 * HTTP status code enumeration
 *
 * @enum
 * @public
 */
export const HttpStatus = {
  /**
   * Success response
   */
  OK: 200,

  /**
   * Resource not found
   */
  NotFound: 404,

  /**
   * Internal server error
   */
  InternalError: 500,

  /**
   * Reserved for internal use only
   *
   * @internal
   */
  Reserved: 999,
} as const;

/**
 * HTTP status type
 *
 * @public
 */
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Configuration object (not an enum)
 *
 * @public
 */
export const Config = {
  /**
   * Request timeout in milliseconds
   */
  timeout: 5000,

  /**
   * Maximum retry attempts
   */
  maxRetries: 3,
};
