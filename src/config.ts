/**
 * Configuration options for the TSDoc plugin.
 * These options can be specified in the Prettier configuration.
 */

export interface TSDocPluginOptions {
  /**
   * Indentation style for fenced code blocks.
   * - 'space': Add one space indentation (default)
   * - 'none': No additional indentation
   */
  fencedIndent?: 'space' | 'none';

  /**
   * Whether to force format all /** comments as TSDoc,
   * even if they don't contain recognizable TSDoc elements.
   */
  forceFormatTSDoc?: boolean;

  /**
   * Whether to normalize tag order based on conventional patterns.
   */
  normalizeTagOrder?: boolean;

  /**
   * Whether to deduplicate release tags (@public, @beta, @alpha, etc).
   */
  dedupeReleaseTags?: boolean;

  /**
   * Whether to split modifiers (@public, @readonly) to separate lines.
   */
  splitModifiers?: boolean;

  /**
   * Whether to enforce single sentence summaries.
   */
  singleSentenceSummary?: boolean;

  /**
   * Additional custom tags to recognize during parsing.
   */
  extraTags?: string[];

  /**
   * Tag spelling normalization mapping.
   * Keys are input tags, values are normalized output tags.
   * Example: { "@return": "@returns", "@prop": "@property" }
   */
  normalizeTags?: Record<string, string>;

  /**
   * Strategy for handling release tag deduplication.
   * - 'keep-first': Keep the first occurrence
   * - 'keep-last': Keep the last occurrence
   */
  releaseTagStrategy?: 'keep-first' | 'keep-last';

  /**
   * Whether to align parameter descriptions in parameter-like tags.
   * When true, aligns the '-' character across @param tags.
   * When false, each parameter is formatted independently.
   */
  alignParamTags?: boolean;

  /**
   * Default release tag to add when no release tag is present.
   * Set to null to disable automatic release tag insertion.
   * @default '@internal'
   */
  defaultReleaseTag?: string | null;

  /**
   * Whether to use AST analysis to only add release tags to exported API constructs.
   * When true, only exported declarations receive default release tags.
   * When false, all TSDoc comments receive default release tags (legacy behavior).
   * @default true
   */
  onlyExportedAPI?: boolean;

  /**
   * Whether to respect inheritance rules for release tags.
   * When true, class/interface members and namespace members inherit from their container.
   * When false, all declarations are candidates for release tags.
   * @default true
   */
  inheritanceAware?: boolean;
}

/**
 * Built-in tag spelling normalization table from TSDoc specification §8.1
 */
export const BUILTIN_TAG_NORMALIZATIONS: Record<string, string> = {
  '@return': '@returns',
  '@prop': '@property',
  // @default -> @defaultValue only when expandDefault is true,
  // but we default to keeping @default as per spec
};

/**
 * Release tags that can be deduplicated
 */
export const RELEASE_TAGS = new Set([
  '@public',
  '@beta',
  '@alpha',
  '@internal',
  '@experimental',
]);

/**
 * Modifier tags that can optionally be split to separate lines
 */
export const MODIFIER_TAGS = new Set([
  '@public',
  '@beta',
  '@alpha',
  '@internal',
  '@experimental',
  '@readonly',
  '@override',
  '@sealed',
  '@virtual',
]);

export const DEFAULT_OPTIONS: Required<TSDocPluginOptions> = {
  fencedIndent: 'space',
  forceFormatTSDoc: false,
  normalizeTagOrder: false,
  dedupeReleaseTags: true,
  splitModifiers: true,
  singleSentenceSummary: false,
  extraTags: [],
  normalizeTags: {},
  releaseTagStrategy: 'keep-first',
  alignParamTags: false,
  defaultReleaseTag: '@internal',
  onlyExportedAPI: true,
  inheritanceAware: true,
};

/**
 * Merge user options with defaults.
 */
export function resolveOptions(
  userOptions: any = {}
): Required<TSDocPluginOptions> {
  const tsdocOptions = userOptions.tsdoc || {};

  return {
    ...DEFAULT_OPTIONS,
    ...tsdocOptions,
    // Also check for top-level options (for Prettier config)
    ...(userOptions.fencedIndent !== undefined && { fencedIndent: userOptions.fencedIndent }),
    ...(userOptions.forceFormatTSDoc !== undefined && { forceFormatTSDoc: userOptions.forceFormatTSDoc }),
    ...(userOptions.normalizeTagOrder !== undefined && { normalizeTagOrder: userOptions.normalizeTagOrder }),
    ...(userOptions.dedupeReleaseTags !== undefined && { dedupeReleaseTags: userOptions.dedupeReleaseTags }),
    ...(userOptions.splitModifiers !== undefined && { splitModifiers: userOptions.splitModifiers }),
    ...(userOptions.singleSentenceSummary !== undefined && { singleSentenceSummary: userOptions.singleSentenceSummary }),
    ...(userOptions.releaseTagStrategy !== undefined && { releaseTagStrategy: userOptions.releaseTagStrategy }),
    ...(userOptions.alignParamTags !== undefined && { alignParamTags: userOptions.alignParamTags }),
    ...(userOptions.defaultReleaseTag !== undefined && { defaultReleaseTag: userOptions.defaultReleaseTag }),
    ...(userOptions.onlyExportedAPI !== undefined && { onlyExportedAPI: userOptions.onlyExportedAPI }),
    ...(userOptions.inheritanceAware !== undefined && { inheritanceAware: userOptions.inheritanceAware }),
    ...(userOptions.extraTags !== undefined && { extraTags: userOptions.extraTags }),
    ...(userOptions.normalizeTags !== undefined && { normalizeTags: userOptions.normalizeTags }),
  };
}

/**
 * Get the complete tag normalization mapping (built-in + user-supplied).
 */
export function getTagNormalizations(
  options: TSDocPluginOptions
): Record<string, string> {
  return {
    ...BUILTIN_TAG_NORMALIZATIONS,
    ...(options.normalizeTags || {}),
  };
}

/**
 * Normalize a tag name based on the normalization mapping.
 */
export function normalizeTagName(
  tagName: string,
  options: TSDocPluginOptions
): string {
  const normalizations = getTagNormalizations(options);
  return normalizations[tagName] || tagName;
}

/**
 * Check if a tag is a release tag that can be deduplicated.
 */
export function isReleaseTag(tagName: string): boolean {
  return RELEASE_TAGS.has(tagName);
}

/**
 * Check if a tag is a modifier tag that can be split.
 */
export function isModifierTag(tagName: string): boolean {
  return MODIFIER_TAGS.has(tagName);
}

/**
 * Check if there are any existing release tags in the comment model.
 */
export function hasReleaseTag(model: { otherTags: { tagName: string }[] }): boolean {
  // Check otherTags for any release tags
  return model.otherTags.some((tag: any) => isReleaseTag(tag.tagName));
}

/**
 * Create a default release tag for insertion when no release tag exists.
 */
export function createDefaultReleaseTag(defaultTag: string): { tagName: string; content: string; rawNode: any } {
  return {
    tagName: defaultTag,
    content: '',
    rawNode: null, // This will be a synthetic tag
  };
}
