# Phase 050 – Markdown & Fenced Code Block Formatting

## Status: 🚧 TODO

## Goal

Implement proper Markdown formatting for TSDoc comments by extracting text
blocks before block tags, processing them through Prettier's markdown formatter,
and re-integrating them with proper comment alignment.

## Deliverables

1. **Block Tag Detection**
   - Complete list of TSDoc block tags (standard + extended TypeDoc/AEDoc)
   - Function to identify where summary/remarks sections end and block tags
     begin
   - Support for `@remarks`, `@example`, `@privateRemarks` as a separate
     markdown blocks

2. **Text Block Extraction**
   - Extract summary section (everything before first block tag or `@remarks`)
   - Extract `@remarks`, `@example`, or `@privateRemark` section content
     separately
   - Remove comment marks (`*`) while preserving original indentation context.

3. **Markdown Processing Pipeline**
   - Pass clean text to Prettier's markdown formatter using `textToDoc`
   - Rely on Prettier's embedded language support for fenced code blocks. Make
     sure that it is enabled when we call into the prettier API.
   - Preserve inline tags (`{@link}`, `{@inheritDoc}`, etc.) as unbreakable
     tokens

4. **Comment Re-integration**
   - Re-add comment marks (`*`) with proper alignment
   - Preserve original comment block indentation level
   - Auto-align with following code (function/class/etc.) where possible
   - Handle nested list item indentation correctly

5. **Error Handling & Fallbacks**
   - Log warnings when markdown formatting fails
   - Fall back to original text on formatting errors
   - Graceful degradation for unsupported markdown features

6. **Tests**
   - Summary text with line wrapping
   - Markdown lists (nested and unnested)
   - Fenced code blocks with various languages
   - Mixed content (text + lists + code)
   - Inline tags preservation
   - Error fallback scenarios

## Implementation Strategy

```typescript
// High-level flow
function formatMarkdownBlocks(docComment: TSDocComment, options: PrettierOptions) {
  // 1. Extract text blocks
  const summaryText = extractSummaryText(docComment); // before @remarks or first block tag
  const remarksText = extractRemarksText(docComment); // @remarks content

  // 2. Process each block separately
  const formattedSummary = formatMarkdownBlock(summaryText, options);
  const formattedRemarks = formatMarkdownBlock(remarksText, options);

  // 3. Re-integrate with comment structure
  return buildCommentWithFormattedBlocks(formattedSummary, formattedRemarks, ...);
}

function formatMarkdownBlock(rawText: string, options: PrettierOptions): string {
  try {
    // Remove comment marks, preserve indentation context
    const cleanText = stripCommentMarks(rawText);

    // Format with Prettier markdown
    const formatted = textToDoc(cleanText, { parser: 'markdown', ...options });

    // Re-add comment marks with proper alignment
    return addCommentMarks(formatted, originalIndentation);

  } catch (error) {
    console.warn('Markdown formatting failed:', error.message);
    return rawText; // fallback to original
  }
}
```

## Acceptance Criteria

- ✅ Summary and `@remarks`, `@privateRemarks` and `@examples` sections are
  processed as separate markdown blocks
- ✅ Markdown lists have proper indentation and line breaks
- ✅ Long lines wrap at `printWidth` with continuation indentation
- ✅ Fenced code blocks are formatted using appropriate language parsers
- ✅ Inline tags (`{@link}`, etc.) never break across lines
- ✅ Comment block maintains original indentation alignment with following code
- ✅ Formatting failures fall back gracefully to original text
- ✅ All TSDoc standard and extended block tags are properly recognized

## Technical Notes

- **Block Tags**: Include all TSDoc core tags plus TypeDoc/AEDoc extensions
  (`@param`, `@typeParam`, `@returns`, `@throws`, `@example`, `@deprecated`,
  `@see`, `@since`, `@category`, `@group`, `@alpha`, `@beta`, `@internal`, etc.)
- **Inline Tag Preservation**: Treat `{@link}`, `{@inheritDoc}`, `{@label}`,
  etc. as atomic units during markdown processing
- **Indentation**: Preserve the comment's original indentation relative to the
  commented code
- **Performance**: Cache formatted results for identical text blocks to improve
  performance

## Migration Notes

This implementation will significantly improve markdown formatting quality and
may produce different output than the current heuristic-based approach. Consider
this a breaking change requiring a major version bump.
