# Phase 050 – Markdown & Fenced Code Block Formatting

## Status: ✅ COMPLETED

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
   - ~~Pass clean text to Prettier's markdown formatter using `textToDoc`~~
     **UPDATED**: Due to Prettier's async nature, implemented enhanced basic
     formatting with language-specific processors
   - **Multi-language Code Block Support**: Comprehensive language detection and
     formatting for TypeScript, JavaScript, HTML, CSS, JSON, YAML, etc.
   - Preserve inline tags (`{@link}`, `{@inheritDoc}`, etc.) as unbreakable
     tokens during text wrapping

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

**ACTUAL IMPLEMENTATION (Tasks 003–004)**

- `formatMarkdownText` collects fenced code blocks and delegates to
  `formatCodeBlock` for language-aware processing.
- `formatCodeBlock` now calls the async `formatEmbeddedCode` helper, which in
  turn invokes `prettier.format` with the appropriate embedded parser set. The
  helper sets an internal `EMBEDDED_FORMATTER_FLAG` to guard against
  re-entrancy.
- The effective behavior is governed by the new `embeddedLanguageFormatting`
  option. When the option (or Prettier’s global setting) is `off`,
  `formatCodeBlock` skips the Prettier call and simply returns the trimmed
  snippet so the legacy text-preserving behavior remains available on demand.
- Inline-tag preservation and markdown wrapping remain as previously described,
  ensuring that only the code fence payload changes between the `auto` and `off`
  modes.

## Acceptance Criteria

- ✅ Summary and `@remarks`, `@privateRemarks` and `@examples` sections are
  processed as separate markdown blocks
- ✅ Markdown lists have proper indentation and line breaks
- ✅ Long lines wrap at `printWidth` with continuation indentation
- ✅ Fenced code blocks are formatted using enhanced basic formatters for
  multiple languages (HTML, TypeScript, JavaScript, CSS, JSON, etc.)
- ✅ Inline tags (`{@link}`, etc.) never break across lines
- ✅ Comment block maintains original indentation alignment with following code
- ✅ Formatting failures fall back gracefully to original text
- ✅ All TSDoc standard and extended block tags are properly recognized

## Technical Notes

- **Block Tags**: Include all TSDoc core tags plus TypeDoc/AEDoc extensions
  (`@param`, `@typeParam`, `@returns`, `@throws`, `@example`, `@deprecated`,
  `@see`, `@since`, `@category`, `@group`, `@alpha`, `@beta`, `@internal`, etc.)
- **Inline Tag Preservation**: Implement tokenization system to preserve
  `{@link}`, `{@inheritDoc}`, `{@label}`, etc. as atomic units during text
  wrapping
- **Language Support**: Multi-language code block formatting with comprehensive
  language-to-parser mapping for TypeScript, JavaScript, HTML, CSS, JSON, YAML,
  etc.
- **Embedded Formatting Toggle**: `embeddedLanguageFormatting` defaults to
  `auto`, running Prettier for supported fences; setting it to `off` skips the
  async call and returns trimmed snippets instead.
- **Indentation**: Preserve the comment's original indentation relative to the
  commented code
- **Performance**: Cache formatted results for identical text blocks to improve
  performance

## Migration Notes

This implementation will significantly improve markdown formatting quality and
may produce different output than the current heuristic-based approach. Consider
this a breaking change requiring a major version bump.
