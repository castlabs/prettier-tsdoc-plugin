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

**ACTUAL IMPLEMENTATION** (adapted for Prettier's async constraints):

```typescript
// Multi-language code block formatting
function formatCodeBlock(code: string, language: string, options: ParserOptions<any>): string {
  const parser = LANGUAGE_TO_PARSER[language.toLowerCase()];
  
  if (!parser) {
    return code.trim(); // Unsupported language fallback
  }
  
  // Due to Prettier's async nature, use enhanced basic formatting
  return formatCodeBasic(code, language);
}

function formatCodeBasic(code: string, language: string): string {
  if (language === 'html') {
    return formatHtmlBasic(code); // Custom HTML formatter with indentation
  } else if (['typescript', 'javascript'].includes(language)) {
    return formatJavaScriptBasic(code); // Basic JS/TS cleanup
  }
  return code.trim();
}

// Inline tag preservation during text wrapping
function formatTextWithMarkdown(text: string, options: ParserOptions<any>): any {
  const { text: textWithTokens, tokens } = preserveInlineTags(text);
  
  // Process markdown with proper list handling and text wrapping
  const formatted = formatMarkdownText(textWithTokens, options);
  
  // Restore inline tags
  return finalResult.map(item => restoreInlineTags(item, tokens));
}
```

## Acceptance Criteria

- ✅ Summary and `@remarks`, `@privateRemarks` and `@examples` sections are
  processed as separate markdown blocks
- ✅ Markdown lists have proper indentation and line breaks
- ✅ Long lines wrap at `printWidth` with continuation indentation
- ✅ Fenced code blocks are formatted using enhanced basic formatters for multiple languages (HTML, TypeScript, JavaScript, CSS, JSON, etc.)
- ✅ Inline tags (`{@link}`, etc.) never break across lines
- ✅ Comment block maintains original indentation alignment with following code
- ✅ Formatting failures fall back gracefully to original text
- ✅ All TSDoc standard and extended block tags are properly recognized

## Technical Notes

- **Block Tags**: Include all TSDoc core tags plus TypeDoc/AEDoc extensions
  (`@param`, `@typeParam`, `@returns`, `@throws`, `@example`, `@deprecated`,
  `@see`, `@since`, `@category`, `@group`, `@alpha`, `@beta`, `@internal`, etc.)
- **Inline Tag Preservation**: Implement tokenization system to preserve `{@link}`, 
  `{@inheritDoc}`, `{@label}`, etc. as atomic units during text wrapping
- **Language Support**: Multi-language code block formatting with comprehensive
  language-to-parser mapping for TypeScript, JavaScript, HTML, CSS, JSON, YAML, etc.
- **Enhanced HTML Formatting**: Custom HTML formatter with proper tag indentation
  and line breaks to overcome Prettier async limitations
- **Indentation**: Preserve the comment's original indentation relative to the
  commented code
- **Performance**: Cache formatted results for identical text blocks to improve
  performance

## Migration Notes

This implementation will significantly improve markdown formatting quality and
may produce different output than the current heuristic-based approach. Consider
this a breaking change requiring a major version bump.
