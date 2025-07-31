# Phase 140 – Multi-line Parameter Formatting

## Status: 💡 PROPOSED

## Goal

To correctly format `@param` tags that have multi-line descriptions, including
paragraphs, lists, fenced code blocks, and other Markdown content. This ensures
that parameter documentation can be as rich and detailed as the main summary or
`@remarks` blocks.

## Rationale

In many APIs, `@param` descriptions need to be more than just a single sentence.
They may require detailed explanations, examples, or constraints, often
formatted with Markdown lists, multiple paragraphs, or even code snippets. The
current formatting logic may not adequately handle this, leading to poorly
formatted or hard-to-read documentation.

By treating the content of a `@param` tag as a full-fledged Markdown block, we
can leverage the existing Markdown formatting pipeline to ensure consistency,
proper wrapping, and correct list and code block indentation, significantly
improving the readability of complex TSDoc comments.

## Deliverables

1.  **Block Content Association**: Enhance the parser or formatting logic to
    correctly identify and associate all content belonging to a `@param` tag.
    This content starts after the parameter name and hyphen and ends at the next
    block-level tag or the end of the comment.

2.  **Markdown Formatting Integration**: Pipe the extracted multi-line
    description of a `@param` tag through the existing Markdown formatting
    engine. This includes handling fenced code blocks, which should be passed to
    the appropriate language-specific formatter. **Important**: Fenced code
    blocks should not be indented beyond the standard comment indentation, as
    this breaks compatibility with linters and TypeDoc.

3.  **Indentation and Re-integration**: Ensure that the formatted Markdown block
    is correctly re-integrated into the TSDoc comment. The first line of the
    description should appear after the `@param name -` part, and all subsequent
    lines of the description must be properly indented under the parameter.

4.  **Comprehensive Tests**: Add a suite of tests for this feature, covering:
    - Simple multi-line paragraphs.
    - Multiple paragraphs with blank lines.
    - Bulleted and numbered lists.
    - Fenced code blocks with various languages.
    - A mix of text, lists, and code blocks.
    - Cases where the indentation in the source is inconsistent.

## Implementation Strategy

1.  **Identify Parameter Content Block**: In `format.ts`, during the processing
    of TSDoc nodes, when a `@param` tag is encountered, the logic must greedily
    consume all subsequent lines as part of its description until a new block
    tag (e.g., another `@param`, `@returns`) is found.

2.  **Extract Raw Markdown**: The collected lines should be treated as a single
    string of raw Markdown content. The comment-leading asterisks and any
    initial indentation should be stripped.

3.  **Format via Markdown Pipeline**: This raw Markdown string will be passed to
    the same utility that formats `@remarks` and `@example` blocks. The Prettier
    Markdown parser will automatically handle fenced code blocks and route them
    to the correct language-specific formatter.

4.  **Reconstruct the `@param` Block**: The formatted Markdown content needs to
    be split into lines and re-inserted into the final Prettier `Doc`.
    - The first line of the formatted content is appended after
      `@param <name> - `.
    - Each subsequent line is prefixed with the appropriate indentation to align
      it correctly within the comment block.

## Examples

### Example 1: Multi-line Text and Lists

**Before Formatting:**

```typescript
/**
 * @param second - The second thing. Let me see what will happen if this is a
 *   really really long line?
 *
 *   That looks reasonable but can I continue here in a separate paragraph? This line shoudl be split but lets continue with a list then.
 *
 *   - This is one item
 *    - This is a second item
 */
```

**After Formatting:**

```typescript
/**
 * @param second - The second thing. Let me see what will happen if this is a
 *   really really long line?
 *
 *   That looks reasonable but can I continue here in a separate paragraph?
 *   This line shoudl be split but lets continue with a list then.
 *
 *   - This is one item
 *   - This is a second item
 */
```

### Example 2: Fenced Code Block

**Before Formatting:**

````typescript
/**
 * @param options - An options object.
 *   Here is an example of the object:
 *   ```json
 *   { "retries": 3, "timeout": 5000 }
 *   ```
 */
````

**After Formatting:**

````typescript
/**
 * @param options - An options object.
 *
 *   Here is an example of the object:
 * ```json
 * {
 * "retries": 3,
 * "timeout": 5000
 * }
 * ```
 */
````

## Acceptance Criteria

- Multi-line descriptions for `@param` tags are correctly indented.
- Line wrapping within the description respects the configured `printWidth`.
- Markdown content, such as lists, multiple paragraphs, and fenced code blocks,
  within a `@param` description is formatted correctly according to Prettier's
  Markdown rules.
- Fenced code blocks in parameter descriptions are not indented beyond the
  standard comment indentation (`*`) to ensure compatibility with linters and
  TypeDoc.
- The formatting is idempotent, meaning that running the formatter on an
  already-formatted comment produces no changes.
- The feature works correctly in conjunction with tag alignment for groups of
  `@param` tags.
