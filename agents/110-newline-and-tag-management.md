# Phase 110 – Newline and Tag Group Management

## Status: ✅ COMPLETED

## Goal

Introduce opinionated formatting rules for newline spacing and tag ordering to
enhance readability and establish a canonical structure for TSDoc blocks. This
will be activated when the `normalizeTagOrder` option is enabled. This option is
enabled by default.

## Deliverables

1. **Blank Lines**
   - Implement logic to ensure that `@example` block tags are always preceded by
     exactly one empty comment line (`*`). This rule applies even if there are
     multiple consecutive `@example` blocks. `@example` tags are treated
     separately from the main meta-data block and always appear last with their
     own spacing.
   - Implement logic to ensure that there exactly one empty comment line after
     the description, before the tags that are in a group defined in 3. The
     purpose of this is to separate the description from parameters and other
     annotation that provide additional meta-data. This includes all meta-data
     tags: `@param`, `@typeParam`, `@returns`, `@throws`, `@deprecated`, `@see`,
     and release tags (`@public`, `@internal`, `@beta`, etc.). These all get
     treated as one meta-data block with a single blank line before the entire
     block.
   - **Important**: Comments should never start or end with empty lines. When
     there is no description/summary (i.e., the comment starts immediately with
     meta-data annotations like `@param`), the first tag should appear
     immediately after `/**` without any blank lines.

2. **Canonical Tag Ordering**
   - When `normalizeTagOrder: true` is set, reorder TSDoc block tags into
     logical groups. If turned off (`normalizeTagOrder: true`) the behaviour
     will remain unchanged, preserving the original source order. The default
     for this option is to `true`.

3. **Defined Tag Groups and Order**
   - The canonical order for tag groups shall be:
     1. `@param` & `@typeParam` - Input parameters.
     2. `@returns` - Output description.
     3. `@throws` - Error conditions.
     4. `@deprecated` - High-importance notice.
     5. `@see` - Cross-references.
     6. Release Tags (`@public`, `@internal`, `@beta`, etc.) - API stability and
        visibility.
     7. `@example` - Usage examples, always last.

4. **Tests**
   - Add tests demonstrating the correct application of newline and ordering
     rules. These test must also cover different combinations of tags.
   - Include tests for edge cases, such as comments with multiple `@example`
     tags or a mix of ordered and unordered tags.

5. **Documentation**
   - Make sure the feature is documented in the `README.md`.
   - Make sure that this spec document is updated and status is reflected
     properly

---

## Rationale

A consistent structure for doc comments makes them significantly easier for
developers to read and parse mentally. Placing `@example` blocks last, preceded
by a blank line, cleanly separates the formal API description from concrete
usage scenarios. The proposed tag order follows a logical progression from
inputs to outputs, errors, and metadata.

---

## Examples

### Example 1: Basic Reordering and Spacing

This example shows a common scenario where tags are out of order and the
`@example` block lacks proper spacing.

**Before Formatting:**

````typescript
/**
 * A simple function.
 * @example
 * ```ts
 * aSimpleFunction('world'); // "Hello, world"
 * ```
 * @returns A greeting string.
 * @param name The name to greet.
 */
````

**After Formatting (`normalizeTagOrder: true`):**

````typescript
/**
 * A simple function.
 *
 * @param name - The name to greet.
 * @returns A greeting string.
 *
 * @example
 * ```ts
 * aSimpleFunction('world'); // "Hello, world"
 * ```
 */
````

### Example 2: Comprehensive Tag Reordering

This example includes a wider variety of tags to demonstrate the full canonical
grouping logic.

**Before Formatting:**

````typescript
/**
 * A more complex function.
 * @see https://example.com for more info.
 * @beta
 * @example
 * ```ts
 * aComplexFunction(1, 2);
 * ```
 * @throws {Error} If the input is invalid.
 * @returns The result of the operation.
 * @param a - The first number.
 * @deprecated Use `newShinyFunction` instead.
 * @param b - The second number.
 */
````

**After Formatting (`normalizeTagOrder: true`):**

````typescript
/**
 * A more complex function.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The result of the operation.
 * @throws If the input is invalid.
 * @deprecated Use `newShinyFunction` instead.
 * @see https://example.com for more info.
 * @beta
 *
 * @example
 * ```ts
 * aComplexFunction(1, 2);
 * ```
 */
````

### Example 3: Comments Without Description

This example demonstrates that comments starting with meta-data annotations
should not have blank lines at the beginning.

**Before Formatting:**

```typescript
/**
 * @param input - The string to process.
 * @returns A processed string.
 */
```

**After Formatting (`normalizeTagOrder: true`):**

```typescript
/**
 * @param input - The string to process.
 * @returns A processed string.
 */
```

Note: No blank line is added after `/**` when there is no description.

### Example 4: Release Tags in Meta-data Block

This example demonstrates that release tags are part of the meta-data block and
don't get extra spacing.

**Before Formatting:**

```typescript
/**
 * An internal API function.
 * @param input The input parameter.
 * @returns The result.
 * @internal
 * @see https://example.com
 */
```

**After Formatting (`normalizeTagOrder: true`):**

```typescript
/**
 * An internal API function.
 *
 * @param input - The input parameter.
 * @returns The result.
 * @see https://example.com
 * @internal
 */
```

Note: Single blank line before the entire meta-data block, no extra spacing
between different types of meta-data tags.

### Example 5: Multiple `@example` Blocks

This example demonstrates that each `@example` is preceded by a blank line and
all are grouped at the end.

**Before Formatting:**

````typescript
/**
 * A function with multiple examples.
 * @example
 * **Basic Usage**
 * ```ts
 * multiExample('test');
 * ```
 * @returns A processed string.
 * @param input - The string to process.
 * @example
 * **Advanced Usage**
 * ```ts
 * multiExample('test', { advanced: true });
 * ```
 */
````

**After Formatting (`normalizeTagOrder: true`):**

````typescript
/**
 * A function with multiple examples.
 *
 * @param input - The string to process.
 * @returns A processed string.
 *
 * @example
 * **Basic Usage**
 * ```ts
 * multiExample('test');
 * ```
 *
 * @example
 * **Advanced Usage**
 * ```ts
 * multiExample('test', { advanced: true });
 * ```
 */
````
