import { expect, test, describe } from 'vitest';
import {
  resolveOptions,
  getTagNormalizations,
  normalizeTagName,
  isReleaseTag,
  isModifierTag,
  hasReleaseTag,
  createDefaultReleaseTag,
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
  });

  test('merges user options with defaults', () => {
    const userOptions = {
      tsdoc: {
        fencedIndent: 'none' as const,
      },
    };

    const options = resolveOptions(userOptions);

    expect(options.fencedIndent).toBe('none');
  });

  test('handles nested tsdoc options', () => {
    const userOptions = {
      printWidth: 100, // Other Prettier option
      tsdoc: {
        fencedIndent: 'none' as const,
      },
    };

    const options = resolveOptions(userOptions);

    expect(options.fencedIndent).toBe('none');
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
        defaultReleaseTag: '@public',
      },
    };

    const resolved = resolveOptions(userOptions);

    expect(resolved.normalizeTagOrder).toBe(true);
    expect(resolved.dedupeReleaseTags).toBe(false);
    expect(resolved.normalizeTags).toEqual({ '@return': '@returns' });
    expect(resolved.releaseTagStrategy).toBe('keep-last');
    expect(resolved.defaultReleaseTag).toBe('@public');
    expect(resolved.fencedIndent).toBe(DEFAULT_OPTIONS.fencedIndent); // Should use default
  });

  test('applies tsdoc embeddedLanguageFormatting override', () => {
    const resolved = resolveOptions({
      tsdoc: { embeddedLanguageFormatting: 'off' as const },
    });

    expect(resolved.embeddedLanguageFormatting).toBe('off');
  });

  test('respects Prettier global embeddedLanguageFormatting when tsdoc unset', () => {
    const resolved = resolveOptions({ embeddedLanguageFormatting: 'off' });

    expect(resolved.embeddedLanguageFormatting).toBe('off');
  });

  test('tsdoc override can re-enable formatting when global is auto', () => {
    const resolved = resolveOptions({
      embeddedLanguageFormatting: 'auto',
      tsdoc: { embeddedLanguageFormatting: 'off' as const },
    });

    expect(resolved.embeddedLanguageFormatting).toBe('off');
  });

  test('global off cannot be overridden by tsdoc auto', () => {
    const resolved = resolveOptions({
      embeddedLanguageFormatting: 'off',
      tsdoc: { embeddedLanguageFormatting: 'auto' as const },
    });

    expect(resolved.embeddedLanguageFormatting).toBe('off');
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

describe('Default Release Tag', () => {
  test('hasReleaseTag detects existing release tags', () => {
    const modelWithReleaseTag = {
      otherTags: [
        { tagName: '@public', content: '' },
        { tagName: '@example', content: 'some example' },
      ],
    };

    const modelWithoutReleaseTag = {
      otherTags: [
        { tagName: '@example', content: 'some example' },
        { tagName: '@see', content: 'some reference' },
      ],
    };

    const emptyModel = { otherTags: [] };

    expect(hasReleaseTag(modelWithReleaseTag)).toBe(true);
    expect(hasReleaseTag(modelWithoutReleaseTag)).toBe(false);
    expect(hasReleaseTag(emptyModel)).toBe(false);
  });

  test('createDefaultReleaseTag creates proper tag structure', () => {
    const defaultTag = createDefaultReleaseTag('@internal');

    expect(defaultTag).toEqual({
      tagName: '@internal',
      content: '',
      rawNode: null,
    });
  });

  test('default options includes defaultReleaseTag as @internal', () => {
    expect(DEFAULT_OPTIONS.defaultReleaseTag).toBe('@internal');
  });

  test('resolveOptions handles defaultReleaseTag configuration', () => {
    const userOptions = {
      tsdoc: {
        defaultReleaseTag: '@public',
      },
    };

    const resolved = resolveOptions(userOptions);
    expect(resolved.defaultReleaseTag).toBe('@public');
  });

  test('resolveOptions handles null defaultReleaseTag to disable feature', () => {
    const userOptions = {
      tsdoc: {
        defaultReleaseTag: null,
      },
    };

    const resolved = resolveOptions(userOptions);
    expect(resolved.defaultReleaseTag).toBeNull();
  });

  test('resolveOptions handles empty string defaultReleaseTag to disable feature', () => {
    const userOptions = {
      defaultReleaseTag: '',
    };

    const resolved = resolveOptions(userOptions);
    expect(resolved.defaultReleaseTag).toBeNull();
  });

  test('resolveOptions handles empty string in nested tsdoc config', () => {
    const userOptions = {
      tsdoc: {
        defaultReleaseTag: '',
      },
    };

    const resolved = resolveOptions(userOptions);
    expect(resolved.defaultReleaseTag).toBeNull();
  });

  test('hasReleaseTag detects modifier tags correctly after fix', () => {
    // Test with various release tags in otherTags (which now includes modifier tags)
    const modelWithPublic = {
      otherTags: [
        { tagName: '@public', content: '' },
        { tagName: '@param', content: 'some param' },
      ],
    };

    const modelWithBeta = {
      otherTags: [
        { tagName: '@beta', content: '' },
        { tagName: '@example', content: 'some example' },
      ],
    };

    const modelWithAlpha = {
      otherTags: [{ tagName: '@alpha', content: '' }],
    };

    const modelWithInternal = {
      otherTags: [{ tagName: '@internal', content: '' }],
    };

    const modelWithExperimental = {
      otherTags: [{ tagName: '@experimental', content: '' }],
    };

    expect(hasReleaseTag(modelWithPublic)).toBe(true);
    expect(hasReleaseTag(modelWithBeta)).toBe(true);
    expect(hasReleaseTag(modelWithAlpha)).toBe(true);
    expect(hasReleaseTag(modelWithInternal)).toBe(true);
    expect(hasReleaseTag(modelWithExperimental)).toBe(true);
  });

  test('hasReleaseTag correctly handles mixed tags including non-release modifier tags', () => {
    const modelWithMixedTags = {
      otherTags: [
        { tagName: '@readonly', content: '' }, // modifier but not release tag
        { tagName: '@example', content: 'some example' }, // block tag
        { tagName: '@public', content: '' }, // release tag
      ],
    };

    const modelWithOnlyNonReleaseTags = {
      otherTags: [
        { tagName: '@readonly', content: '' },
        { tagName: '@override', content: '' },
        { tagName: '@sealed', content: '' },
        { tagName: '@example', content: 'some example' },
      ],
    };

    expect(hasReleaseTag(modelWithMixedTags)).toBe(true);
    expect(hasReleaseTag(modelWithOnlyNonReleaseTags)).toBe(false);
  });
});
