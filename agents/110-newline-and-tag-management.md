# Phase 110 – Newline and Tag Group Management

## Status: ✅ COMPLETED

## Goal

Introduce opinionated formatting rules for newline spacing and tag ordering to
enhance readability and establish a canonical structure for TSDoc blocks. This
will be activated when the `normalizeTagOrder` option is enabled. This option is
enabled by default.

## Deliverables

1. **Blank Line Before Examples**
   - Implement logic to ensure that `@example` block tags are always preceded by
     exactly one empty comment line (`*`). This rule applies even if there are
     multiple consecutive `@example` blocks.

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

### Example 3: Multiple `@example` Blocks

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
