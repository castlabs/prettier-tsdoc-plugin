import { expect, test, describe } from 'vitest';
import {
  resolveOptions,
  getTagNormalizations,
  normalizeTagName,
  isReleaseTag,
  isModifierTag,
  DEFAULT_OPTIONS,
  BUILTIN_TAG_NORMALIZATIONS,
  RELEASE_TAGS,
  MODIFIER_TAGS,
} from './config.js';

describe('Configuration', () => {
  test('returns default options when no user options provided', () => {
    const options = resolveOptions();

    expect(options).toEqual(DEFAULT_OPTIONS);
    expect(options.fencedIndent).toBe('space');
    expect(options.forceFormatTSDoc).toBe(false);
  });

  test('merges user options with defaults', () => {
    const userOptions = {
      tsdoc: {
        fencedIndent: 'none' as const,
      },
    };

    const options = resolveOptions(userOptions);

    expect(options.fencedIndent).toBe('none');
    expect(options.forceFormatTSDoc).toBe(false); // Should use default
  });

  test('handles nested tsdoc options', () => {
    const userOptions = {
      printWidth: 100, // Other Prettier option
      tsdoc: {
        fencedIndent: 'none' as const,
        forceFormatTSDoc: true,
      },
    };

    const options = resolveOptions(userOptions);

    expect(options.fencedIndent).toBe('none');
    expect(options.forceFormatTSDoc).toBe(true);
  });

  test('handles empty tsdoc options object', () => {
    const userOptions = {
      tsdoc: {},
    };

    const options = resolveOptions(userOptions);

    expect(options).toEqual(DEFAULT_OPTIONS);
  });

  test('handles missing tsdoc key', () => {
    const userOptions = {
      printWidth: 100,
      tabWidth: 2,
    };

    const options = resolveOptions(userOptions);

    expect(options).toEqual(DEFAULT_OPTIONS);
  });

  test('merges new configuration options correctly', () => {
    const userOptions = {
      tsdoc: {
        normalizeTagOrder: true,
        dedupeReleaseTags: false,
        normalizeTags: { '@return': '@returns' },
        releaseTagStrategy: 'keep-last' as const,
      },
    };

    const resolved = resolveOptions(userOptions);

    expect(resolved.normalizeTagOrder).toBe(true);
    expect(resolved.dedupeReleaseTags).toBe(false);
    expect(resolved.normalizeTags).toEqual({ '@return': '@returns' });
    expect(resolved.releaseTagStrategy).toBe('keep-last');
    expect(resolved.fencedIndent).toBe(DEFAULT_OPTIONS.fencedIndent); // Should use default
  });
});

describe('Tag Normalization', () => {
  test('returns built-in normalizations by default', () => {
    const options = { normalizeTags: {} };
    const normalizations = getTagNormalizations(options);
    expect(normalizations).toEqual(BUILTIN_TAG_NORMALIZATIONS);
  });

  test('merges user normalizations with built-in ones', () => {
    const options = {
      normalizeTags: {
        '@custom': '@customTag',
        '@return': '@customReturns', // Should override built-in
      },
    };

    const normalizations = getTagNormalizations(options);

    expect(normalizations['@return']).toBe('@customReturns'); // User override
    expect(normalizations['@prop']).toBe('@property'); // Built-in preserved
    expect(normalizations['@custom']).toBe('@customTag'); // User addition
  });

  test('normalizes tag names correctly', () => {
    const options = {
      normalizeTags: { '@custom': '@customTag' },
    };

    expect(normalizeTagName('@return', options)).toBe('@returns');
    expect(normalizeTagName('@prop', options)).toBe('@property');
    expect(normalizeTagName('@custom', options)).toBe('@customTag');
    expect(normalizeTagName('@unknown', options)).toBe('@unknown');
  });

  test('returns unchanged tag when no normalization exists', () => {
    const options = { normalizeTags: {} };
    expect(normalizeTagName('@someTag', options)).toBe('@someTag');
  });
});

describe('Release Tags', () => {
  test('identifies release tags correctly', () => {
    expect(isReleaseTag('@public')).toBe(true);
    expect(isReleaseTag('@beta')).toBe(true);
    expect(isReleaseTag('@alpha')).toBe(true);
    expect(isReleaseTag('@internal')).toBe(true);
    expect(isReleaseTag('@experimental')).toBe(true);

    expect(isReleaseTag('@param')).toBe(false);
    expect(isReleaseTag('@returns')).toBe(false);
    expect(isReleaseTag('@custom')).toBe(false);
  });

  test('release tags set contains expected tags', () => {
    expect(RELEASE_TAGS.has('@public')).toBe(true);
    expect(RELEASE_TAGS.has('@beta')).toBe(true);
    expect(RELEASE_TAGS.has('@alpha')).toBe(true);
    expect(RELEASE_TAGS.has('@internal')).toBe(true);
    expect(RELEASE_TAGS.has('@experimental')).toBe(true);
    expect(RELEASE_TAGS.size).toBe(5);
  });
});

describe('Modifier Tags', () => {
  test('identifies modifier tags correctly', () => {
    expect(isModifierTag('@public')).toBe(true);
    expect(isModifierTag('@readonly')).toBe(true);
    expect(isModifierTag('@override')).toBe(true);
    expect(isModifierTag('@sealed')).toBe(true);
    expect(isModifierTag('@virtual')).toBe(true);

    expect(isModifierTag('@param')).toBe(false);
    expect(isModifierTag('@returns')).toBe(false);
    expect(isModifierTag('@custom')).toBe(false);
  });

  test('modifier tags set contains expected tags', () => {
    expect(MODIFIER_TAGS.has('@public')).toBe(true);
    expect(MODIFIER_TAGS.has('@beta')).toBe(true);
    expect(MODIFIER_TAGS.has('@readonly')).toBe(true);
    expect(MODIFIER_TAGS.has('@override')).toBe(true);
    expect(MODIFIER_TAGS.has('@sealed')).toBe(true);
    expect(MODIFIER_TAGS.has('@virtual')).toBe(true);
    expect(MODIFIER_TAGS.size).toBe(9);
  });
});

describe('Built-in Normalizations', () => {
  test('contains expected mapping', () => {
    expect(BUILTIN_TAG_NORMALIZATIONS['@return']).toBe('@returns');
    expect(BUILTIN_TAG_NORMALIZATIONS['@prop']).toBe('@property');
  });

  test('does not include @default -> @defaultValue by default', () => {
    // Per spec, @default -> @defaultValue only when expandDefault is true
    // Since we default expandDefault to false, we keep @default as is
    expect(BUILTIN_TAG_NORMALIZATIONS['@default']).toBeUndefined();
  });
});
