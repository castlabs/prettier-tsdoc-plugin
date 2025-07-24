# Phase 050 – Markdown & Fenced Code Block Formatting

## Status: ✅ COMPLETED

## Goal

Delegate Markdown paragraphs and fenced code blocks inside TSDoc comments to
Prettier's own printers, adhering to rules in §§6.1–6.3.

## Deliverables

1. **Markdown Extraction Utility**
   - `utils/markdown.ts` with `extractMarkdownSections(docNodes)` that returns
     ranges & raw text.

2. **Language Mapping Table**
   - Map aliases (`ts`, `typescript`, `js`, `bash`, …) → Prettier parser names.

3. **Formatter Enhancement**
   - Within `formatTSDocComment`, detect markdown nodes, call `textToDoc`, and
     splice results back into the main `Doc`.

4. **Config Option**
   - `fencedIndent` (`space` | `none`) with default `space`.

5. **Tests**
   - Fixture containing bullet lists and a fenced TypeScript code block → expect
     code block to be formatted by Prettier TS parser.

6. **Performance**
   - Cache language map; avoid repeated `textToDoc` when identical snippet
     repeats.

## Acceptance Criteria

- Markdown lists are re-indented relative to comment prefix.
- Fenced code formatted exactly as standalone code with identical Prettier
  options.

## Migration Notes

Producing wrapped Markdown can change many lines; _major_ release recommended if
existing consumers rely on raw Markdown formatting.
