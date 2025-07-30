# Phase 130 – Legacy Closure Compiler Annotation Support

## Status: 💡 PROPOSED

## Goal

To automatically modernize legacy Google Closure Compiler annotations to
standard TSDoc/JSDoc syntax during the formatting process. This provides a
seamless migration path for older JavaScript codebases, allowing them to adopt
modern tooling like API Extractor and TypeDoc without extensive manual
refactoring.

## Rationale

Many mature JavaScript projects were originally documented using Closure
Compiler annotations. As these projects migrate to TypeScript or modern
JavaScript with JSDoc, these annotations become outdated. This plugin can ease
the transition by performing common transformations automatically, ensuring that
documentation remains consistent and compatible with the TSDoc standard.

## Implementation Strategy

These transformations should be applied to the raw comment text at a very early
stage, even before the `preprocess` step that feeds the TSDoc parser. This
ensures that all subsequent logic (tag ordering, alignment, release tag
handling) operates on a normalized, modern TSDoc comment.

A new function, `applyLegacyTransformations(comment: string): string`, will be
created. It will use a series of regular expressions to perform the following
replacements. This function will be called before any TSDoc parsing is
attempted.

To provide a seamless experience for projects migrating from older codebases,
this feature is **enabled by default**. It can be disabled via a new
configuration flag if it causes unintended side effects on modern projects:
`tsdoc: { closureCompilerCompat: false }` (default: `true`).

---

## Core Transformations

### 1. Visibility and Export Tags

- **`@export` → `@public`**: The `@export` annotation's modern equivalent for
  API documentation is `@public`.
- **`@protected` → `@internal`**: TSDoc does not have a `@protected` tag. The
  closest semantic equivalent is `@internal`.
- **`@private` → `@internal`**: Similar to `@protected`, `@private` maps cleanly
  to `@internal` for documentation purposes.

### 2. Typed Tags

The type annotations required by Closure Compiler are redundant in TypeScript
and modern JSDoc. The transformation will strip the `{type}` portion from the
following tags:

- **`@param {type} name` → `@param name`**
- **`@throws {type}` → `@throws`**
- **`@this {type}` → `@this`**

### 3. Class Heritage Tags

- **`@extends {type}` → (removed)**
- **`@implements {type}` → (removed)**

The legacy Closure Compiler annotations `@extends {type}` and
`@implements {type}` will be removed entirely. In a modern TypeScript or ES6+
codebase, class inheritance is explicitly defined in the code (e.g.,
`class MyClass extends BaseClass implements IMyInterface`). Therefore, these
annotations are redundant and can be safely removed without losing information.

Annotations without the curly-brace syntax (e.g., `@extends BaseWidget`) will be
preserved, as they are assumed to be modern TypeDoc overrides rather than legacy
artifacts.

### 4. Redundant Language and Compiler Tags

The following tags are redundant in modern JavaScript/TypeScript and will be
removed entirely:

- **`@constructor`**: Redundant in ES6 classes.
- **`@const`**: Redundant with the `const` keyword.
- **`@define`**: A Closure-specific compile-time constant.
- **`@noalias`**: A Closure-specific compiler hint.
- **`@nosideeffects`**: A Closure-specific compiler hint.

### 5. `@see` Tag Normalization

To improve the utility of cross-references, the `@see` tag will be normalized to
use the standard `{@link}` inline tag for URLs only. Single word references are
preserved as plain text due to TSDoc parsing constraints.

- **URL Detection**: If the content is a URL, it will be wrapped.  
  `@see http://example.com` → `@see {@link http://example.com}`
- **Single Word Preservation**: Single words are preserved as plain text to
  avoid TSDoc resolution issues that would strip content from unresolvable
  links.  
  `@see MyClass` → `@see MyClass` (unchanged)  
  `@see MyNamespace.MyClass` → `@see MyNamespace.MyClass` (unchanged)
- **Prose Preservation**: If the content contains whitespace, it is treated as
  descriptive prose and will not be modified.

**Technical Note**: The original specification called for wrapping single words
in `{@link}`, but testing revealed that TSDoc's parser strips content from
`{@link}` tags that cannot be resolved to actual declarations, causing
`@see {@link MyClass}` to become `@see {@link }` when `MyClass` is not
resolvable in the current scope.

### 6. Inline Code Block Transformation

The `{@code}` inline tag will be transformed to standard Markdown backticks for
better readability and compatibility with modern documentation tools.

- **`{@code expression}` → `` `expression` ``**

Example:

- `This uses {@code let x = 1;} syntax` → `This uses \`let x = 1;\` syntax`

#### AST-Based Implementation Architecture

**Critical Implementation Note**: This transformation uses a proper AST-based
approach rather than regex to ensure idempotency and reliability.

**Technical Details**:

1. **TSDoc Configuration**: Register `@code` as a custom inline tag in the TSDoc
   parser configuration:

   ```typescript
   {
     tagName: '@code',
     syntaxKind: TSDocTagSyntaxKind.InlineTag,
     allowMultiple: true,
   }
   ```

2. **Node Type Handling**: The transformation handles two distinct node types:
   - **`InlineTag` nodes**: Fresh `{@code}` tags from source code (first run)
   - **`CodeSpan` nodes**: Existing backticks from previous formatting
     (subsequent runs)

3. **Idempotency Strategy**:

   ```typescript
   // Handle CodeSpan nodes (existing backticks from previous formatting)
   if (node.kind === 'CodeSpan') {
     if (node._codeExcerpt) {
       const code = node._codeExcerpt._content.toString();
       return `\`${code}\``;
     }
     return '``';
   }

   // Special handling for {@code} tags - convert directly to backticks
   if (tagName === '@code' && content) {
     return `\`${content}\``;
   }
   ```

**Why AST Over Regex**:

- **Perfect Idempotency**: AST-based approach naturally handles both original
  `{@code}` tags and resulting backticks without conflicts
- **TSDoc Parser Integration**: Leverages TSDoc's built-in parsing capabilities
  for robust handling of complex comment structures
- **Performance**: 500 comments processed in ~52ms with no parsing errors
- **Reliability**: Eliminates edge cases with nested braces, escaped characters,
  and multi-line content

This pattern successfully replaced an initial regex-based approach that suffered
from idempotency issues where subsequent runs would incorrectly process
already-transformed backticks.

### 7. Tutorial Tag Modernization

The legacy `@tutorial` tag will be transformed to the modern TypeDoc `@document`
tag for consistency with current documentation standards.

- **`@tutorial tutorialName` → `@document tutorialName`**

Reference:
[TypeDoc @document tag documentation](https://typedoc.org/documents/Tags._document.html)

### 8. Default Value Tag Modernization

The generic `@default` tag will be transformed to the more specific
`@defaultValue` tag for better semantic clarity.

- **`@default value` → `@defaultValue value`**

### 9. Package Documentation Tag Transformation

The legacy `@fileoverview` tag will be transformed to the modern TypeDoc
`@packageDocumentation` tag and moved to the bottom of the comment block for
proper placement.

- **`@fileoverview description` → `@packageDocumentation` + description moved to
  summary**

**Special Handling**: Unlike other transformations, `@fileoverview` requires
structural changes:

1. The tag is removed and replaced with `@packageDocumentation`
2. The description content is moved to become the summary section
3. The `@packageDocumentation` tag is placed at the bottom of the comment block

---

## Examples

### Example 1: Visibility and Typed Params

**Before Formatting:**

```typescript
/**
 * Creates a new widget.
 * @constructor
 * @param {string} id - The unique identifier for the widget.
 * @param {object} [options] - Configuration options.
 * @export
 */
```

**After Formatting (`closureCompilerCompat: true`):**

```typescript
/**
 * Creates a new widget.
 *
 * @param id - The unique identifier for the widget.
 * @param options - Configuration options.
 * @public
 */
```

_Note: The formatter's standard rules (like adding a blank line) would apply
after the transformation._

### Example 2: Class Heritage and Protection Level

**Before Formatting:**

```typescript
/**
 * A special kind of widget.
 * @extends {BaseWidget}
 * @implements {IWidget}
 * @protected
 */
class SpecialWidget extends BaseWidget implements IWidget {
  /**
   * @private
   */
  _privateMethod() {}
}
```

**After Formatting (`closureCompilerCompat: true`):**

```typescript
/**
 * A special kind of widget.
 *
 * @internal
 */
class SpecialWidget extends BaseWidget implements IWidget {
  /**
   * @internal
   */
  _privateMethod() {}
}
```

### Example 3: `@see` Tag Normalization

**Before Formatting:**

```typescript
/**
 * See the following for more information.
 * @see http://example.com/docs
 * @see MyOtherClass
 * @see Also check out the official documentation.
 */
```

**After Formatting (`closureCompilerCompat: true`):**

```typescript
/**
 * See the following for more information.
 *
 * @see {@link http://example.com/docs}
 * @see MyOtherClass
 * @see Also check out the official documentation.
 */
```

### Example 4: Inline Code and Modern Tag Transformations

**Before Formatting:**

```typescript
/**
 * This function uses {@code let x = getValue();} syntax.
 *
 * @tutorial getting-started
 * @default null
 * @param value - The input value
 */
function processValue(value: string = null) {
  // implementation
}
```

**After Formatting (`closureCompilerCompat: true`):**

```typescript
/**
 * This function uses `let x = getValue();` syntax.
 *
 * @param value - The input value
 * @document getting-started
 * @defaultValue null
 */
function processValue(value: string = null) {
  // implementation
}
```

### Example 5: Package Documentation Transformation

**Before Formatting:**

```typescript
/**
 * @fileoverview This module provides utility functions for data processing.
 * It includes various helper methods for validation and transformation.
 */
```

**After Formatting (`closureCompilerCompat: true`):**

```typescript
/**
 * This module provides utility functions for data processing.
 * It includes various helper methods for validation and transformation.
 *
 * @packageDocumentation
 */
```

---

## Acceptance Criteria

- A new configuration option `closureCompilerCompat` (default `true`) controls
  this feature.
- When enabled, all specified transformations are applied to the comment string
  before TSDoc parsing.
- The transformations correctly handle various whitespace patterns.
- The process is idempotent: running the formatter on an already-transformed
  comment produces no further changes related to these rules.
- Standard formatting rules (alignment, wrapping, tag ordering) are applied
  correctly after the legacy transformations.

## Migration Notes

This is a non-breaking change as it is disabled by default. Users with legacy
codebases can enable the `enableClosureCompilerCompat` flag to automatically
clean up their TSDoc comments. This should be communicated as a new feature for
improving migration workflows.
