# Empty @param Descriptions Should Include Hyphen Separator

## Problem Statement

When a `@param` tag has no description text, the current formatting omits the
hyphen separator entirely. However, TypeDoc requires the hyphen separator to be
present even when the description is empty.

## Current Behavior

Given this input:

```typescript
/**
 * @param name
 * @internal
 */
export function testme(name: string) {
  console.log('Foo bar', name);
}
```

The formatter currently preserves the format as-is:

```typescript
/**
 * @param name
 * @internal
 */
export function testme(name: string) {
  console.log('Foo bar', name);
}
```

## Expected Behavior

The formatter should add a trailing hyphen separator when the description is
empty:

```typescript
/**
 * @param name -
 * @internal
 */
export function testme(name: string) {
  console.log('Foo bar', name);
}
```

This ensures compatibility with TypeDoc's expectations and maintains consistency
with the format used when descriptions are present.

## Relevant Specification References

From `context.md` §5.7:

> ### 5.7 `@param` & `@typeParam` Formatting Rules
>
> - Syntax: `@param <name> - <description>`; `@typeParam <T> - <description>`.
> - Exactly one space before and after `-`.
> - If no description text, omit `-` entirely (configurable; default omit).

The current specification states that the hyphen should be omitted by default
when there's no description. However, for TypeDoc compatibility, this behavior
should be reconsidered.

**Note:** This implementation changes the default behavior described in §5.7.
The specification will need to be updated to reflect the new default:
`requireParamHyphen: true` and `requireTypeParamHyphen: true`.

## Requirements

1. When a `@param` or `@typeParam` tag has no description text, append a space
   and hyphen: `@param name -`
2. Apply the same rule to `@typeParam` tags
3. Ensure idempotency: formatting the same comment multiple times produces
   identical output
4. This should apply regardless of whether other content (like modifier tags)
   follows the parameter tag

## Related Tags

This issue applies to:

- `@param`
- `@typeParam`

Other tags like `@property`/`@prop` may have similar requirements and should be
evaluated.

## Test Cases

### Case 1: Single param without description

**Input:**

```typescript
/**
 * @param name
 */
function test(name: string) {}
```

**Expected:**

```typescript
/**
 * @param name -
 */
function test(name: string) {}
```

### Case 2: Multiple params, mix of empty and non-empty descriptions

**Input:**

```typescript
/**
 * @param name
 * @param id - User identifier
 * @param options
 */
function test(name: string, id: number, options: object) {}
```

**Expected:**

```typescript
/**
 * @param name    -
 * @param id      - User identifier
 * @param options -
 */
function test(name: string, id: number, options: object) {}
```

Note: Alignment should be maintained across all params. Further note that the
alignment depents on the `alignParamTags` configuration and is NOT part of this
feature.

### Case 3: Param without description followed by other tags

**Input:**

```typescript
/**
 * @param name
 * @internal
 */
function test(name: string) {}
```

**Expected:**

```typescript
/**
 * @param name -
 * @internal
 */
function test(name: string) {}
```

### Case 4: TypeParam without description

**Input:**

```typescript
/**
 * @typeParam T
 */
function test<T>(value: T) {}
```

**Expected:**

```typescript
/**
 * @typeParam T -
 */
function test<T>(value: T) {}
```

## Configuration Consideration

The specification mentions this is configurable. Consider:

- Whether to make hyphen inclusion the default for TypeDoc compatibility
- Or add a config option like `requireParamHyphen: boolean` (default `true`)
- Align with TypeDoc/API Extractor ecosystem expectations

---

## Proposed Solution

### Overview

Add two new configuration options that control whether empty parameter
descriptions should include a trailing hyphen:

- `requireParamHyphen` - for `@param` tags
- `requireTypeParamHyphen` - for `@typeParam` tags

Both default to `true` for TypeDoc compatibility, but can be configured
independently to provide fine-grained control.

### Current Implementation Analysis

**Location:** `src/utils/tags.ts:266-269`

```typescript
} else {
  // No description, no hyphen
  result.push(createCommentLine(prefix));
}
```

This code explicitly omits the hyphen when there's no description. It appears
twice in the file:

- Lines 266-269: Aligned format path
- Similar logic exists for non-aligned format path

**Configuration:** `src/config.ts`

Currently, no option exists to control this behavior. Available options include
`alignParamTags`, `normalizeTags`, etc., but nothing for hyphen requirements.

### Solution Design

#### 1. Add Configuration Options

Add `requireParamHyphen` and `requireTypeParamHyphen` to `TSDocPluginOptions`
interface in `src/config.ts`:

```typescript
export interface TSDocPluginOptions {
  // ... existing options ...

  /**
   * Whether to require a hyphen separator for @param tags
   * even when the description is empty.
   *
   * When true: `@param name -`
   * When false: `@param name`
   *
   * @defaultValue true (for TypeDoc compatibility)
   */
  requireParamHyphen?: boolean;

  /**
   * Whether to require a hyphen separator for @typeParam tags
   * even when the description is empty.
   *
   * When true: `@typeParam T -`
   * When false: `@typeParam T`
   *
   * @defaultValue true (for TypeDoc compatibility)
   */
  requireTypeParamHyphen?: boolean;
}
```

Update `DEFAULT_OPTIONS` to include:

```typescript
export const DEFAULT_OPTIONS: Required<TSDocPluginOptions> = {
  // ... existing defaults ...
  requireParamHyphen: true, // Default to true for TypeDoc compatibility
  requireTypeParamHyphen: true, // Default to true for TypeDoc compatibility
};
```

Update `resolveOptions` function to handle both new options.

#### 2. Modify Tag Formatting Logic

Update `printAligned` function in `src/utils/tags.ts` to check the appropriate
configuration option based on the tag type:

```typescript
} else {
  // No description - check if we should add hyphen based on tag type
  const options = /* get from function parameters */;
  const tsdocOptions = resolveOptions(options);

  // Determine which option to check based on tag type
  const shouldAddHyphen =
    tag.tagName === '@typeParam'
      ? tsdocOptions.requireTypeParamHyphen
      : tsdocOptions.requireParamHyphen;

  if (shouldAddHyphen) {
    // Add hyphen for TypeDoc compatibility
    if (alignParamTags && tags.length > 1) {
      // Aligned format
      const currentWidth = prefix.length;
      const targetWidth = maxWidth - 3;
      const paddingNeeded = Math.max(1, targetWidth - currentWidth + 1);
      const padding = ' '.repeat(paddingNeeded);
      result.push(createCommentLine([prefix, padding, '-']));
    } else {
      // Non-aligned format
      result.push(createCommentLine(`${prefix} -`));
    }
  } else {
    // No description, no hyphen (legacy behavior)
    result.push(createCommentLine(prefix));
  }
}
```

**Note:** The function signature may need to be updated to accept options:

```typescript
export function printAligned(
  tags: ParamTagInfo[],
  effectiveWidth: number,
  alignParamTags: boolean = true,
  options?: ParserOptions<any> // Already exists, use to extract tsdoc options
): any[];
```

**Important:** The third parameter is `alignParamTags` (not `alignTags`) to
match the configuration option name defined in `src/config.ts`.

#### 3. Independent Configuration for @param and @typeParam

The two configuration options allow independent control:

- `requireParamHyphen` controls `@param` tags only
- `requireTypeParamHyphen` controls `@typeParam` tags only

This provides flexibility for projects that may have different requirements for
each tag type.

#### 4. Alignment Considerations

When `alignParamTags: true` (controlled by the separate `alignParamTags`
configuration option):

- Empty descriptions should align their hyphens with non-empty descriptions
- Use the same padding calculation as for tags with descriptions
- The hyphen requirement (`requireParamHyphen` / `requireTypeParamHyphen`) works
  independently from alignment
- Example alignment when both are enabled:

  ```
  @param name    -
  @param id      - User identifier
  @param options -
  ```

**Note:** Alignment is controlled by the existing `alignParamTags` configuration
option and is independent from the hyphen requirement feature.

---

## Implementation Plan

### Phase 1: Configuration Setup

**File:** `src/config.ts`

1. Add `requireParamHyphen?: boolean` to `TSDocPluginOptions` interface
2. Add `requireTypeParamHyphen?: boolean` to `TSDocPluginOptions` interface
3. Update `DEFAULT_OPTIONS` to set both options to `true`
4. Update `resolveOptions` to handle both new options
5. Add JSDoc documentation explaining both options and their default values

**Validation:** Run `npm run typecheck` to ensure no TypeScript errors

### Phase 2: Core Logic Implementation

**File:** `src/utils/tags.ts`

1. Locate the `printAligned` function (currently around line 72)
2. Find both branches where empty descriptions are handled:
   - Aligned format branch (around line 266-269)
   - Non-aligned format branch (if exists separately)
3. Modify the logic to:
   - Extract `tsdocOptions` from the `options` parameter
   - Determine tag type (`@param` vs `@typeParam`)
   - Check appropriate option (`requireParamHyphen` or `requireTypeParamHyphen`)
   - If true, add hyphen with appropriate spacing/alignment
   - If false, preserve existing behavior
4. Ensure alignment is maintained when mixing empty and non-empty descriptions

**Key considerations:**

- Preserve idempotency: formatting multiple times produces identical output
- Maintain alignment calculations: hyphens should align across all params
- Handle both `alignParamTags: true` and `alignParamTags: false` cases
- Apply correct option based on tag type (`@param` uses `requireParamHyphen`,
  `@typeParam` uses `requireTypeParamHyphen`)

**Validation:**

- Run `npm run typecheck`
- Run existing tests: `npm test src/utils/tags.test.ts`

### Phase 3: Test Implementation

**File:** `src/utils/tags.test.ts` (if exists) or create new test file
`src/empty-param-hyphen.test.ts`

Implement comprehensive test coverage (see Test Coverage section below).

**Validation:**

- All new tests pass: `npm test`
- Existing tests remain passing (no regression)

### Phase 4: Integration Testing

**File:** `src/integration.test.ts` or similar

Add end-to-end tests that verify the complete formatting pipeline respects the
new option.

**Validation:**

- Run full test suite: `npm test`
- Run type checking: `npm run typecheck`
- Run linting: `npm run lint:fix`
- Run prettier: `npm run prettier`

### Phase 5: Documentation

**Files:**

- **Update `agents/context.md` §5.7** to reflect the new default behavior:
  - Change "If no description text, omit `-` entirely (configurable; default
    omit)" to "If no description text, include `-` (configurable; default
    include for TypeDoc compatibility)"
  - Document both `requireParamHyphen` and `requireTypeParamHyphen` options
  - Explain that defaults are `true` for TypeDoc compatibility
- Update `README.md` (if exists) to document both configuration options
- Add examples showing:
  - Default behavior (hyphens included)
  - Legacy behavior (`requireParamHyphen: false`)
  - Mixed configuration (`requireParamHyphen: true`,
    `requireTypeParamHyphen: false`)

**Critical:** The context.md update is essential since we're changing the
default behavior from the original specification.

### Phase 6: Manual Testing

**Location:** `example/` directory

1. Build the plugin: `npm run build` (from root)
2. Create test files in `example/src/` with various empty param scenarios
3. Run `npm run prettier` from `example/` directory
4. Verify output matches expectations
5. Test with `npm run typedoc` to ensure TypeDoc compatibility

---

## Test Coverage

### Unit Tests (`src/utils/tags.test.ts` or `src/empty-param-hyphen.test.ts`)

#### Test 1: Empty param with requireParamHyphen: true (default)

```typescript
it('should add hyphen to empty param description when requireParamHyphen is true', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@param', name: 'name', description: '', rawNode: null },
  ];
  const result = printAligned(tags, 80, false, {
    tsdoc: { requireParamHyphen: true },
  });

  expect(result).toContain('@param name -');
});
```

#### Test 2: Empty param with requireParamHyphen: false

```typescript
it('should omit hyphen from empty param when requireParamHyphen is false', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@param', name: 'name', description: '', rawNode: null },
  ];
  const result = printAligned(tags, 80, false, {
    tsdoc: { requireParamHyphen: false },
  });

  expect(result).toContain('@param name');
  expect(result).not.toContain('@param name -');
});
```

#### Test 3: Alignment with mixed empty and non-empty descriptions

```typescript
it('should align hyphens when mixing empty and non-empty descriptions', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@param', name: 'name', description: '', rawNode: null },
    {
      tagName: '@param',
      name: 'id',
      description: 'User identifier',
      rawNode: null,
    },
    { tagName: '@param', name: 'options', description: '', rawNode: null },
  ];
  const result = printAligned(tags, 80, true, {
    tsdoc: { requireParamHyphen: true, alignParamTags: true },
  });

  // Check that hyphens are aligned
  const lines = result.map((line) => line.toString());
  const hyphenPositions = lines
    .map((line) => line.indexOf('-'))
    .filter((pos) => pos !== -1);

  // All hyphens should be at the same position
  expect(new Set(hyphenPositions).size).toBe(1);
});
```

#### Test 4: Empty typeParam description

```typescript
it('should add hyphen to empty typeParam description', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
  ];
  const result = printAligned(tags, 80, false, {
    tsdoc: { requireTypeParamHyphen: true },
  });

  expect(result).toContain('@typeParam T -');
});
```

#### Test 4b: Empty typeParam with requireTypeParamHyphen: false

```typescript
it('should omit hyphen from empty typeParam when requireTypeParamHyphen is false', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
  ];
  const result = printAligned(tags, 80, false, {
    tsdoc: { requireTypeParamHyphen: false },
  });

  expect(result).toContain('@typeParam T');
  expect(result).not.toContain('@typeParam T -');
});
```

#### Test 5: Idempotency test

```typescript
it('should produce identical output when formatting twice', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@param', name: 'name', description: '', rawNode: null },
  ];
  const options = { tsdoc: { requireParamHyphen: true } };

  const result1 = printAligned(tags, 80, false, options);
  const result2 = printAligned(tags, 80, false, options);

  expect(result1).toEqual(result2);
});
```

#### Test 6: Non-aligned format with empty description

```typescript
it('should handle non-aligned format with empty description', () => {
  const tags: ParamTagInfo[] = [
    { tagName: '@param', name: 'x', description: '', rawNode: null },
    { tagName: '@param', name: 'y', description: '', rawNode: null },
  ];
  const result = printAligned(tags, 80, false, {
    tsdoc: { requireParamHyphen: true, alignParamTags: false },
  });

  expect(result).toContain('@param x -');
  expect(result).toContain('@param y -');
});
```

#### Test 7: Very long parameter name

```typescript
it('should handle very long parameter names with empty descriptions', () => {
  const tags: ParamTagInfo[] = [
    {
      tagName: '@param',
      name: 'veryLongParameterNameThatExceedsWidth',
      description: '',
      rawNode: null,
    },
  ];
  const result = printAligned(tags, 40, false, {
    tsdoc: { requireParamHyphen: true },
  });

  // Should still add hyphen even if it causes line to be long
  expect(result.join('')).toContain('veryLongParameterNameThatExceedsWidth -');
});
```

#### Test 8: Mixed param and typeParam alignment

```typescript
it('should align hyphens across param and typeParam tags', () => {
  const paramTags: ParamTagInfo[] = [
    { tagName: '@param', name: 'value', description: '', rawNode: null },
  ];
  const typeParamTags: ParamTagInfo[] = [
    { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
  ];

  const paramResult = printAligned(paramTags, 80, true, {
    tsdoc: { requireParamHyphen: true, alignParamTags: true },
  });
  const typeParamResult = printAligned(typeParamTags, 80, true, {
    tsdoc: { requireTypeParamHyphen: true, alignParamTags: true },
  });

  // Both should have hyphens
  expect(paramResult.join('')).toContain('-');
  expect(typeParamResult.join('')).toContain('-');
});
```

#### Test 8b: Independent configuration for param vs typeParam

```typescript
it('should respect independent settings for param and typeParam', () => {
  const paramTags: ParamTagInfo[] = [
    { tagName: '@param', name: 'value', description: '', rawNode: null },
  ];
  const typeParamTags: ParamTagInfo[] = [
    { tagName: '@typeParam', name: 'T', description: '', rawNode: null },
  ];

  // Param requires hyphen, typeParam does not
  const paramResult = printAligned(paramTags, 80, false, {
    tsdoc: { requireParamHyphen: true, requireTypeParamHyphen: false },
  });
  const typeParamResult = printAligned(typeParamTags, 80, false, {
    tsdoc: { requireParamHyphen: true, requireTypeParamHyphen: false },
  });

  expect(paramResult.join('')).toContain('@param value -');
  expect(typeParamResult.join('')).toContain('@typeParam T');
  expect(typeParamResult.join('')).not.toContain('@typeParam T -');
});
```

### Integration Tests (`src/integration.test.ts` or `src/end-to-end.test.ts`)

#### Test 9: Full comment formatting with empty params

```typescript
it('should format complete comment with empty param descriptions', async () => {
  const input = `
/**
 * Test function
 * @param name
 * @param id
 * @internal
 */
export function testme(name: string, id: number) {}
`;

  const result = await format(input, {
    parser: 'typescript',
    plugins: [tsdocPlugin],
    tsdoc: { requireParamHyphen: true },
  });

  expect(result).toContain('@param name -');
  expect(result).toContain('@param id -');
});
```

#### Test 10: Legacy behavior compatibility

```typescript
it('should maintain legacy behavior when requireParamHyphen is false', async () => {
  const input = `
/**
 * @param name
 */
function test(name: string) {}
`;

  const result = await format(input, {
    parser: 'typescript',
    plugins: [tsdocPlugin],
    tsdoc: { requireParamHyphen: false },
  });

  expect(result).toContain('@param name');
  expect(result).not.toContain('@param name -');
});
```

#### Test 11: Config default verification

```typescript
it('should default to requireParamHyphen and requireTypeParamHyphen: true when not specified', async () => {
  const input = `
/**
 * @param value
 * @typeParam T
 */
function test<T>(value: T) {}
`;

  const result = await format(input, {
    parser: 'typescript',
    plugins: [tsdocPlugin],
    // No tsdoc config specified - should use defaults
  });

  expect(result).toContain('@param value -');
  expect(result).toContain('@typeParam T -');
});
```

#### Test 12: Real-world TypeDoc compatibility

```typescript
it('should produce TypeDoc-compatible output for empty params', async () => {
  const input = `
/**
 * Process user data
 * @param user
 * @param options
 * @returns Processed result
 * @public
 */
export function processUser(user: User, options: Options): Result {}
`;

  const result = await format(input, {
    parser: 'typescript',
    plugins: [tsdocPlugin],
    tsdoc: { requireParamHyphen: true },
  });

  // Should be valid TypeDoc syntax
  expect(result).toContain('@param user -');
  expect(result).toContain('@param options -');
  expect(result).toContain('@returns Processed result');
});
```

### Snapshot Tests

Create snapshot tests in `src/__snapshots__/empty-param-hyphen.test.ts.snap` for
visual regression testing:

```typescript
it('should match snapshot for various empty param scenarios', () => {
  const cases = [
    'single empty param',
    'multiple empty params',
    'mixed empty and non-empty',
    'empty typeParam',
    'aligned format',
    'non-aligned format',
  ];

  cases.forEach((testCase) => {
    expect(formatTestCase(testCase)).toMatchSnapshot();
  });
});
```

---

## Validation Checklist

After implementation, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all tests including new ones)
- [ ] `npm run lint:fix` passes
- [ ] `npm run prettier` passes
- [ ] Manual testing in `example/` directory produces expected output
- [ ] `npm run typedoc` in `example/` directory works correctly
- [ ] Idempotency verified: formatting twice produces identical output
- [ ] Backward compatibility: `requireParamHyphen: false` and
      `requireTypeParamHyphen: false` preserve old behavior
- [ ] Independent configuration works: can set `requireParamHyphen: true` and
      `requireTypeParamHyphen: false` (or vice versa)
- [ ] **Documentation updated in `context.md` §5.7** to reflect new defaults
- [ ] Documentation updated in `README.md` with both configuration options
