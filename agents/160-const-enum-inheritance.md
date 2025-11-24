# Phase 160 – Const Enum Property Release Tag Inheritance

## Status: 💡 PROPOSED

## Goal

Prevent automatic release tag annotation on object properties when the parent
object literal already has a release tag annotation. Specifically, for the
"const enum" pattern where an exported const object with `@enum` annotation is
used, property comments should inherit the release tag from their containing
object rather than receiving an independent default release tag.

## Problem Statement

When using the TypeScript "const enum" pattern (an exported const object with
`@enum` annotation), the plugin incorrectly applies default release tags (e.g.,
`@internal`) to object property comments that have no explicit release tag, even
when the parent object itself is already annotated with a release tag (e.g.,
`@public`).

### Current Behavior

Given this input:

```typescript
/**
 * @enum
 * @public
 */
export const SomeConstEnum = {
  /**
   */
  some: 'some',

  /**
   * This is some value with a description.
   */
  Value: 'value',
};

/**
 * @public
 */
export type SomeConstEnum = (typeof SomeConstEnum)[keyof typeof SomeConstEnum];
```

The formatter currently produces:

```typescript
/**
 * @enum
 * @public
 */
export const SomeConstEnum = {
  /**
   * @internal
   */
  some: 'some',

  /**
   * This is some value with a description.
   *
   * @internal
   */
  Value: 'value',
};

/**
 * @public
 */
export type SomeConstEnum = (typeof SomeConstEnum)[keyof typeof SomeConstEnum];
```

Notice that both `some` and `Value` properties now have `@internal` tags added,
despite the parent object being marked `@public`.

### Expected Behavior

The formatter should recognize that the object properties are part of an
annotated const enum and should inherit the parent's release tag. No automatic
release tag should be added to the properties:

```typescript
/**
 * @enum
 * @public
 */
export const SomeConstEnum = {
  /**
   */
  some: 'some',

  /**
   * This is some value with a description.
   */
  Value: 'value',
};

/**
 * @public
 */
export type SomeConstEnum = (typeof SomeConstEnum)[keyof typeof SomeConstEnum];
```

## Rationale

### API Documentation Semantics

In API documentation systems like API Extractor and TypeDoc, release tags follow
inheritance rules:

1. **Container-Level Annotation**: When a container (class, interface,
   namespace, or in this case, a const enum object) is annotated with a release
   tag, that annotation applies to all members of the container.

2. **Member Inheritance**: Members inherit the release tag from their container
   unless explicitly overridden with a different release tag.

3. **Redundancy Avoidance**: Adding release tags to every member when the
   container is already annotated creates unnecessary verbosity and potential
   conflicts.

### The Const Enum Pattern

The "const enum" pattern is a common TypeScript idiom for creating type-safe
enumeration-like values:

```typescript
export const MyEnum = {
  VALUE_ONE: 'value1',
  VALUE_TWO: 'value2',
} as const;

export type MyEnum = (typeof MyEnum)[keyof typeof MyEnum];
```

When documented with TSDoc, this pattern uses the `@enum` tag to indicate the
object should be treated as an enumeration. The release tag on the const object
declaration logically applies to all enumeration values within it.

### API Extractor Compatibility

API Extractor's inheritance rules state:

- **Exported Items**: Top-level exported declarations need release tags
- **Container Members**: Members of classes, interfaces, and namespaces inherit
  from their container
- **Object Properties**: While object literals are typically not considered
  "containers" in the same way as classes, when used with `@enum` annotation
  they semantically represent an enumeration where all values share the same
  visibility

## Analysis

### Root Cause

The current release tag injection logic in `format.ts` likely does not recognize
object property declarations as "container members" that should inherit from a
parent annotation. The AST analysis in `src/utils/ast-analysis.ts` handles:

- Class members (inherit from class)
- Interface members (inherit from interface)
- Namespace members (inherit from namespace)

But it does **not** handle:

- Object literal properties (when part of an `@enum` pattern)

### AST Structure

For the const enum pattern, the AST structure is:

```
ExportNamedDeclaration (with @enum @public comment)
  └─ VariableDeclaration
      └─ VariableDeclarator (name: SomeConstEnum)
          └─ ObjectExpression
              ├─ Property (with comment, name: some)
              └─ Property (with comment, name: Value)
```

Each `Property` node within the `ObjectExpression` represents an enum value and
should be considered a member of the containing const enum.

### Detection Strategy

To fix this issue, the plugin needs to:

1. **Detect Const Enum Pattern**: Identify when a `VariableDeclaration` with an
   `ObjectExpression` value has an `@enum` tag in its comment

2. **Analyze Parent Context**: When processing a comment attached to an
   `ObjectExpression` property, check if the parent `VariableDeclaration` has a
   release tag

3. **Apply Inheritance Rule**: If the parent const enum has a release tag, skip
   automatic release tag injection for properties

4. **Respect Explicit Overrides**: If a property comment explicitly includes a
   different release tag, honor that override

## Deliverables

### 1. Enhanced AST Analysis for Object Properties

Extend `src/utils/ast-analysis.ts` to detect object literal properties within
const enum patterns:

- Add detection for `ObjectExpression` properties
- Identify parent `VariableDeclaration` with `@enum` tag
- Check if parent has an existing release tag
- Return `shouldInheritReleaseTag: true` when applicable

### 2. Const Enum Detection Function

Create a new function `isConstEnumProperty()` that:

- Takes an AST path for a comment node
- Traverses up to find if it's attached to an `ObjectExpression` property
- Checks if the parent `VariableDeclaration` has `@enum` annotation
- Returns whether this property should inherit release tags

### 3. Integration with Release Tag Logic

Update the release tag injection logic in `format.ts` to:

- Call the new const enum property detection
- Skip automatic release tag injection when inheritance applies
- Preserve explicit release tags when present on properties

### 4. Comprehensive Test Coverage

Add test cases covering:

- Const enum with `@public` parent, no tags on properties
- Const enum with `@internal` parent, no tags on properties
- Const enum with mixed property tags (some explicit, some inherited)
- Const enum properties with explicit override tags
- Regular object literals without `@enum` (should also inherit)
- Nested object structures
- Multiple const enums in the same file

## Implementation Strategy

### Phase 1: AST Analysis Enhancement

**File:** `src/utils/ast-analysis.ts`

Add new functions:

```typescript
/**
 * Check if a node is a property within a const enum pattern.
 *
 * @param node - The AST node to check
 * @param commentPath - The comment's AST path
 * @returns Analysis of const enum membership
 */
export function analyzeConstEnumProperty(
  node: any,
  commentPath: AstPath<any>
): {
  isConstEnumProperty: boolean;
  parentHasEnumTag: boolean;
  parentHasReleaseTag: boolean;
  parentReleaseTag?: string;
} {
  // Implementation details:
  // 1. Check if node is a Property within ObjectExpression
  // 2. Find parent VariableDeclaration
  // 3. Check parent comment for @enum tag
  // 4. Check parent comment for release tags
  // 5. Return analysis result
}

/**
 * Extract release tag from a comment string.
 *
 * @param comment - The comment text to analyze
 * @returns The release tag if found, or undefined
 */
function extractReleaseTag(comment: string): string | undefined {
  // Look for @public, @internal, @beta, @alpha
}

/**
 * Check if a comment contains @enum tag.
 *
 * @param comment - The comment text to analyze
 * @returns Whether @enum tag is present
 */
function hasEnumTag(comment: string): boolean {
  // Check for @enum tag
}
```

### Phase 2: Container Inheritance Enhancement

**File:** `src/utils/ast-analysis.ts`

Update `analyzeContainerInheritance()` to include const enum check:

```typescript
function analyzeContainerInheritance(
  node: any,
  commentPath: AstPath<any>
): {
  isContainerMember: boolean;
  containerType?: 'class' | 'interface' | 'namespace' | 'const-enum';
  shouldInherit: boolean;
} {
  // ... existing class/interface/namespace checks ...

  // NEW: Check if this is a const enum property
  const constEnumInfo = analyzeConstEnumProperty(node, commentPath);
  if (
    constEnumInfo.isConstEnumProperty &&
    constEnumInfo.parentHasEnumTag &&
    constEnumInfo.parentHasReleaseTag
  ) {
    if (process.env.PRETTIER_TSDOC_DEBUG === '1') {
      debugLog(
        'Container Analysis - Found const enum property:',
        constEnumInfo.parentReleaseTag
      );
    }
    return {
      isContainerMember: true,
      containerType: 'const-enum',
      shouldInherit: true,
    };
  }

  // ... rest of function ...
}
```

### Phase 3: Update Release Tag Injection Logic

**File:** `format.ts`

Ensure the existing release tag injection logic respects the
`shouldInheritReleaseTag` flag returned by AST analysis. This should already be
in place from Phase 080 (Release Tags), but verify it handles the new
`const-enum` container type.

### Phase 4: Test Implementation

**File:** `src/const-enum-inheritance.test.ts` (new file)

Create comprehensive tests:

```typescript
import { describe, it, expect } from 'vitest';
import { format } from './format.js';

describe('Const Enum Release Tag Inheritance', () => {
  it('should not add release tags to properties of @public const enum', async () => {
    const input = `
/**
 * @enum
 * @public
 */
export const Status = {
  /**
   */
  Active: 'active',

  /**
   * Inactive status
   */
  Inactive: 'inactive',
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // Should NOT add @internal to properties
    expect(result).not.toContain("Active: 'active',\n   *\n   * @internal");
    expect(result).not.toContain('Inactive status\n   *\n   * @internal');
  });

  it('should respect explicit override tags on const enum properties', async () => {
    const input = `
/**
 * @enum
 * @public
 */
export const Status = {
  /**
   * @internal
   */
  Private: 'private',
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // Should preserve explicit @internal tag
    expect(result).toContain('@internal');
  });

  it('should not treat regular object literals as const enums', async () => {
    const input = `
/**
 * Config object
 * @public
 */
export const config = {
  /**
   */
  timeout: 5000,
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // Regular objects do NOT inherit - properties should get default tag
    // (This is the expected behavior - only @enum objects should inherit)
    expect(result).toContain('@internal');
  });

  it('should handle const enum with @internal parent', async () => {
    const input = `
/**
 * @enum
 * @internal
 */
export const InternalEnum = {
  /**
   */
  Value: 'value',
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // Should not add redundant @internal to property
    const valueComment = result.match(/\/\*\*[\s\S]*?Value: 'value'/)?.[0];
    expect(valueComment).toBeDefined();
    // Count @internal occurrences - should only be on parent, not property
    const internalCount = (valueComment || '').match(/@internal/g)?.length || 0;
    expect(internalCount).toBe(0);
  });

  it('should handle mixed explicit and inherited tags', async () => {
    const input = `
/**
 * @enum
 * @public
 */
export const MixedEnum = {
  /**
   * Public value (inherited)
   */
  Public: 'public',

  /**
   * Internal override
   * @internal
   */
  Internal: 'internal',
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // Public should NOT get tag added (inherits)
    const publicSection = result.match(/Public: 'public'/);
    expect(publicSection).toBeDefined();
    // But the explicit @internal should be preserved
    expect(result).toContain('Internal override');
    expect(result).toContain('@internal');
  });

  it('should handle nested object structures', async () => {
    const input = `
/**
 * @enum
 * @public
 */
export const OuterEnum = {
  /**
   */
  Nested: {
    /**
     */
    Inner: 'value',
  },
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // For now, only first-level properties should inherit
    // Nested objects might need special handling
    // Document current behavior and decide if it needs enhancement
  });

  it('should handle multiple const enums in same file', async () => {
    const input = `
/**
 * @enum
 * @public
 */
export const Enum1 = {
  /** */
  A: 'a',
};

/**
 * @enum
 * @internal
 */
export const Enum2 = {
  /** */
  B: 'b',
};
`;

    const result = await format(input, {
      parser: 'typescript',
      tsdoc: { defaultReleaseTag: '@internal' },
    });

    // Each enum's properties should inherit from their respective parent
    // Neither A nor B should have tags added
    const countInternal = (result.match(/@internal/g) || []).length;
    // Should only be 1 @internal (on Enum2 parent)
    expect(countInternal).toBe(1);
  });
});
```

### Phase 5: Integration Tests

**File:** `src/end-to-end.test.ts`

Add end-to-end test with complete formatting pipeline:

```typescript
it('should handle const enum pattern with inheritance', async () => {
  const input = `
/**
 * Status enumeration
 * @enum
 * @public
 */
export const Status = {
  /**
   */
  Active: 'active',

  /**
   * The inactive state
   */
  Inactive: 'inactive',
};

/**
 * @public
 */
export type Status = (typeof Status)[keyof typeof Status];
`;

  const result = await format(input, {
    parser: 'typescript',
    plugins: [tsdocPlugin],
    tsdoc: {
      defaultReleaseTag: '@internal',
      alignParamTags: true,
    },
  });

  // Verify proper formatting and no auto-injected tags on properties
  expect(result).toContain('@enum');
  expect(result).toContain('@public');
  // Count @public occurrences - should be 2 (const and type)
  const publicCount = (result.match(/@public/g) || []).length;
  expect(publicCount).toBe(2);
  // No @internal should be added
  expect(result).not.toContain('@internal');
});
```

### Phase 6: Documentation Updates

**File:** `agents/context.md`

Add section documenting const enum inheritance behavior:

```markdown
### 5.X Const Enum Property Inheritance

When an exported const object is annotated with `@enum` and a release tag (e.g.,
`@public`, `@internal`), all properties within that object inherit the release
tag from the parent. This follows the same inheritance rules as class members
and interface properties.

Example:

/\*\*

- @enum
- @public _/ export const MyEnum = { /\*\* Property inherits @public from parent
  _/ VALUE_ONE: 'value1', };
```

## Test Coverage Requirements

All tests must verify:

1. **Basic Inheritance**: Properties without tags inherit from parent const enum
2. **Explicit Override**: Properties with explicit tags preserve those tags
3. **Regular Objects**: Non-enum object literals do NOT inherit (maintain
   current behavior)
4. **Multiple Container Types**: Test interaction with classes, interfaces, and
   const enums in same file
5. **Idempotency**: Running formatter multiple times produces identical output
6. **Edge Cases**:
   - Empty property comments
   - Multi-line property descriptions
   - Properties with `@param`-like tags (should not affect inheritance)
   - Const enums without release tags (properties should get default tag)
   - Const enums without `@enum` tag (properties should get default tag)

## Edge Cases and Considerations

### 1. Object Literals Without @enum

Only object literals with `@enum` annotation should be treated as const enums
with inheritance. Regular object literals (even exported ones) should maintain
current behavior where properties are treated as independent declarations.

**Rationale**: Without `@enum`, the object is just a configuration object or
data structure, not a semantic enumeration where all values share the same API
visibility.

### 2. Const Enums Without Release Tags

If a const enum has `@enum` but no release tag, properties should still receive
the default release tag according to normal rules.

**Rationale**: The inheritance only applies when there's a parent tag to inherit
from. If the parent needs a tag, so do the properties.

### 3. Nested Objects

Properties that are themselves objects may need special consideration:

```typescript
/**
 * @enum
 * @public
 */
export const NestedEnum = {
  Category: {
    Subcategory: 'value',
  },
};
```

**Proposed Behavior**: Only direct properties of the enum object inherit. Nested
properties are considered part of their immediate parent object, not the
top-level enum. This can be revisited if real-world use cases emerge.

### 4. Const Enum with Type Alias

The pattern typically includes both a const object and a type alias:

```typescript
export const MyEnum = { ... } // const enum
export type MyEnum = ... // type alias
```

These are separate declarations and should be handled independently. The type
alias does not inherit from the const object; it needs its own release tag.

### 5. Interaction with defaultReleaseTag Configuration

The inheritance rules should work regardless of the `defaultReleaseTag`
configuration setting. Whether the default is `@internal`, `@public`, or any
other tag, properties of an annotated const enum should inherit from their
parent rather than receiving the default.

## Acceptance Criteria

### Functionality Requirements

- **Inheritance**: Properties of const enums with `@enum` and a release tag do
  not receive automatic default release tags
- **Explicit Override**: Properties can explicitly specify a different release
  tag to override inheritance
- **Enum Detection**: Only objects with `@enum` tag are treated as enums for
  inheritance purposes
- **Multiple Container Types**: Works correctly alongside existing class,
  interface, and namespace inheritance
- **Backward Compatibility**: Regular object literals without `@enum` maintain
  current behavior

### Quality Gates

- All existing tests continue to pass (no regression)
- New test suite achieves >95% coverage for const enum scenarios
- Successfully compiles via `npm run build`
- Passes linting via `npm run lint:fix`
- Passes formatting via `npm run prettier`
- Manual testing in `example/` directory confirms expected behavior
- Idempotency verified: formatting multiple times produces identical output

## Examples

### Example 1: Basic Const Enum Inheritance

**Before Formatting (Input):**

```typescript
/**
 * @enum
 * @public
 */
export const Status = {
  /**
   */
  Active: 'active',

  /**
   * Inactive status
   */
  Inactive: 'inactive',
};
```

**After Formatting (Expected):**

```typescript
/**
 * @enum
 * @public
 */
export const Status = {
  /**
   */
  Active: 'active',

  /**
   * Inactive status
   */
  Inactive: 'inactive',
};
```

Note: No `@internal` tags are added to properties.

### Example 2: Explicit Override

**Before Formatting (Input):**

```typescript
/**
 * @enum
 * @public
 */
export const Status = {
  /**
   * Public status
   */
  Active: 'active',

  /**
   * Internal implementation detail
   * @internal
   */
  Reserved: 'reserved',
};
```

**After Formatting (Expected):**

```typescript
/**
 * @enum
 * @public
 */
export const Status = {
  /**
   * Public status
   */
  Active: 'active',

  /**
   * Internal implementation detail
   *
   * @internal
   */
  Reserved: 'reserved',
};
```

Note: The explicit `@internal` on `Reserved` is preserved.

### Example 3: Regular Object (Not Const Enum)

**Before Formatting (Input):**

```typescript
/**
 * Configuration object
 * @public
 */
export const config = {
  /**
   */
  timeout: 5000,
};
```

**After Formatting (Expected):**

```typescript
/**
 * Configuration object
 * @public
 */
export const config = {
  /**
   * @internal
   */
  timeout: 5000,
};
```

Note: Without `@enum`, properties receive default tags (current behavior
maintained).

### Example 4: Complete Const Enum Pattern

**Before Formatting (Input):**

```typescript
/**
 * HTTP status codes
 * @enum
 * @public
 */
export const HttpStatus = {
  /**
   */
  OK: 200,

  /**
   * Not found error
   */
  NotFound: 404,

  /**
   * Internal implementation status
   * @internal
   */
  Reserved: 999,
};

/**
 * @public
 */
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
```

**After Formatting (Expected):**

```typescript
/**
 * HTTP status codes
 *
 * @enum
 * @public
 */
export const HttpStatus = {
  /**
   */
  OK: 200,

  /**
   * Not found error
   */
  NotFound: 404,

  /**
   * Internal implementation status
   *
   * @internal
   */
  Reserved: 999,
};

/**
 * @public
 */
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
```

Note:

- `OK` and `NotFound` inherit `@public` (no tags added)
- `Reserved` has explicit `@internal` override (preserved)
- Type alias has its own `@public` (separate declaration)

## Migration Notes

This is a **non-breaking change** as it fixes incorrect behavior rather than
changing documented functionality. Users who have been manually removing
incorrectly-injected release tags from const enum properties will see their
workflow improve.

Projects that have already accepted the incorrect tags in their codebase can:

1. Re-run the formatter to remove redundant tags
2. Keep existing tags (explicit tags will be preserved)

## Related Work

This builds upon:

- **Phase 080 (Release Tags)**: Extends the AST-aware release tag injection
  system
- **Phase 120 (Plugin Architecture Refactor)**: Uses the established AST
  analysis utilities

The implementation follows the same architectural patterns established in these
phases, particularly the container inheritance detection strategy.

## Future Enhancements

Potential future improvements (not in scope for this phase):

1. **Nested Object Inheritance**: Extend inheritance to nested object properties
2. **Configuration Option**: Add `inheritConstEnumTags` config option to disable
   this behavior
3. **Other Object Patterns**: Consider inheritance for other structured object
   patterns (e.g., `@namespace` objects)
4. **TypeDoc Integration**: Verify behavior matches TypeDoc's rendering of const
   enum patterns
