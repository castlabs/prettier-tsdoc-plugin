# Phase 055 – Multi-Language Code Block Formatting

## Status: ✅ COMPLETED

## Goal

Extend the basic code block formatting to support multiple programming languages
within `@example` blocks, providing language-specific formatting rules and
proper syntax highlighting preservation.

## Deliverables

1. **Language Detection and Mapping**
   - Comprehensive language-to-parser mapping table
   - Support for TypeScript, JavaScript, HTML, CSS, JSON, YAML, Markdown,
     GraphQL
   - Graceful fallback for unsupported languages

2. **Enhanced Code Formatters**
   - Custom HTML formatter with proper tag indentation and line breaks
   - JavaScript/TypeScript basic formatter with syntax cleanup
   - Language-agnostic whitespace normalization

3. **Integration with @example Tags**
   - Automatic language detection from fenced code block identifiers
   - Preserve @example descriptions on the same line as the tag
   - Support for multiple code blocks within single @example

4. **Comprehensive Test Coverage**
   - Multi-language formatting tests for all supported languages
   - Integration tests with other TSDoc features
   - Error handling and fallback scenarios

## Implementation Strategy

```typescript
// Language mapping used by formatEmbeddedCode helper
const LANGUAGE_TO_PARSER: Record<string, string> = {
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'babel',
  js: 'babel',
  jsx: 'babel',
  tsx: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  json5: 'json5',
  yaml: 'yaml',
  yml: 'yaml',
  markdown: 'markdown',
  md: 'markdown',
  graphql: 'graphql',
};

async function formatCodeBlock(
  code: string,
  language: string,
  parentOptions: ParserOptions<any>,
  embeddedPreference: 'auto' | 'off'
) {
  const fallback = cleanupCodeSnippet(code);

  if (embeddedPreference === 'off') {
    return fallback;
  }

  const formatted = await formatEmbeddedCode({
    code,
    language,
    parentOptions,
    embeddedLanguageFormatting: embeddedPreference,
  });

  return formatted || fallback;
}
```

## Acceptance Criteria

- ✅ TypeScript code blocks formatted with proper syntax cleanup
- ✅ HTML code blocks formatted with multi-line structure and indentation
- ✅ JavaScript code blocks formatted with spacing normalization
- ✅ Unsupported languages handled gracefully with basic cleanup
- ✅ @example descriptions preserved on same line as tag
- ✅ Multiple code blocks within single @example supported
- ✅ Language detection from fenced code block identifiers
- ✅ Integration with existing TSDoc parameter and remarks formatting
- ✅ Comprehensive test coverage with 14 specific tests

## Technical Notes

- **Language Support**: Focus on most commonly used languages in documentation
- **Embedded Formatting Toggle**: `embeddedLanguageFormatting` allows projects
  to disable Prettier-based snippet formatting and fall back to trimmed output.
- **Performance**: Language detection is lightweight string matching
- **Extensibility**: Easy to add new languages by extending the mapping table
- **Error Handling**: Graceful degradation for parsing errors or unsupported
  syntax

## Migration Notes

This is an additive feature that enhances existing @example block formatting
without breaking existing functionality. All previously working examples
continue to work, but now with improved multi-language support.

## Testing

Comprehensive test suite in `src/multi-language-formatting.test.ts`:

- 12 tests for individual language formatting
- 2 integration tests with other TSDoc features
- Coverage for TypeScript, JavaScript, HTML, CSS, JSON, and unsupported
  languages
- Edge cases like empty code blocks and mixed content
