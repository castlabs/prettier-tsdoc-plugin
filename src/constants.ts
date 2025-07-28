/**
 * Constants for TSDoc plugin - centralized location for all magic values
 */

export const TSDoc = {
  /**
   * Core TSDoc block tags that require special formatting
   */
  BLOCK_TAGS: new Set([
    '@param',
    '@typeParam',
    '@returns',
    '@throws',
    '@example',
    '@deprecated',
    '@see',
    '@since',
    '@override',
    '@sealed',
    '@remarks',
    '@defaultValue',
    '@category',
    '@group',
    '@privateRemarks',
    '@property',
    '@prop',
  ]),

  /**
   * Release visibility tags for API documentation
   */
  RELEASE_TAGS: new Set([
    '@public',
    '@beta',
    '@alpha',
    '@internal',
    '@experimental',
  ]),

  /**
   * Modifier tags that don't have content
   */
  MODIFIER_TAGS: new Set([
    '@abstract',
    '@event',
    '@eventProperty',
    '@hidden',
    '@inline',
    '@readonly',
    '@virtual',
    '@public',
    '@beta',
    '@alpha',
    '@internal',
    '@experimental',
  ]),

  /**
   * Inline tags that should never be broken across lines
   */
  INLINE_TAGS: new Set([
    '@link',
    '@linkcode',
    '@linkplain',
    '@inheritDoc',
    '@label',
    '@include',
    '@includeCode',
  ]),

  /**
   * Language mappings for code block formatting
   */
  LANGUAGE_MAPPINGS: {
    ts: 'typescript',
    typescript: 'typescript',
    js: 'babel-ts',
    javascript: 'babel-ts',
    jsx: 'babel-ts',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'html',
    md: 'markdown',
    markdown: 'markdown',
    sh: 'bash',
    bash: 'bash',
    shell: 'bash',
  } as const,

  /**
   * Tag normalization mappings
   */
  TAG_NORMALIZATIONS: {
    '@return': '@returns',
    '@prop': '@property',
    '@exception': '@throws',
  } as const,
} as const;

/**
 * Performance and caching constants
 */
export const PERFORMANCE = {
  /**
   * Maximum number of parsed TSDoc configurations to cache
   */
  MAX_PARSER_CACHE_SIZE: 10,

  /**
   * Cache TTL for parser instances (5 minutes)
   */
  PARSER_CACHE_TTL: 1000 * 60 * 5,

  /**
   * Minimum text length to trigger markdown formatting
   */
  MIN_MARKDOWN_FORMAT_LENGTH: 50,
} as const;

/**
 * Formatting constants
 */
export const FORMATTING = {
  /**
   * Comment prefix patterns
   */
  COMMENT_PREFIX: {
    BLOCK_START: '/**',
    BLOCK_END: '*/',
    LINE_PREFIX: ' * ',
    EMPTY_LINE: ' *',
  },

  /**
   * Default indentation and spacing
   */
  SPACING: {
    TAG_ALIGNMENT_MIN_SPACES: 1,
    PARAM_HYPHEN_SPACING: ' - ',
    CONTINUATION_INDENT: 2,
  },

  /**
   * Regex patterns for text processing
   */
  PATTERNS: {
    TSDOC_COMMENT: /\/\*\*([\s\S]*?)\*\/(\s*(?:export\s+)?\s*(?:function|class|interface|type|const|let|var|enum|namespace|abstract\s+class|declare\s+(?:function|class|interface|type|const|let|var|enum|namespace)))/g,
    LEADING_ASTERISK: /^\s*\*\s?/,
    MULTIPLE_SPACES: /\s+/g,
    TRAILING_WHITESPACE: /\s+$/gm,
    BLANK_LINES: /\n{3,}/g,
  },
} as const;

/**
 * Error handling constants
 */
export const ERRORS = {
  /**
   * Error types for classification
   */
  TYPES: {
    PARSE_ERROR: 'parse',
    FORMAT_ERROR: 'format',
    AST_ERROR: 'ast',
    CONFIG_ERROR: 'config',
  },

  /**
   * Error recovery strategies
   */
  RECOVERY: {
    RETURN_ORIGINAL: 'return_original',
    MINIMAL_FORMAT: 'minimal_format',
    SKIP_FORMATTING: 'skip_formatting',
  },
} as const;

/**
 * Debug and logging constants
 */
export const DEBUG = {
  /**
   * Environment variable for enabling debug mode
   */
  ENV_VAR: 'PRETTIER_TSDOC_DEBUG',

  /**
   * Log levels
   */
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  },
} as const;
