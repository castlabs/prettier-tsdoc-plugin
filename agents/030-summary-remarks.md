# Phase 030 – Summary & `@remarks` Formatting

## Status: ✅ COMPLETED

## Goal

Emit consistently wrapped and indented summary paragraphs and optional
`@remarks` blocks, honouring `printWidth`, indentation and blank-line rules
(§5.1–§5.4).

## Deliverables

1. **Text Width Utilities**
   - `utils/text-width.ts` with helpers `effectiveWidth(options): number` and
     `wrapText()` (word-flow using Prettier `fill`).

2. **Intermediate Model**
   - Define `Section` types for `summary` & `remarks`.

3. **`formatTSDocComment()` Implementation (partial)**
   - Strip delimiters → parse → build model → emit Prettier `Doc` representing
     summary + remarks only.

4. **`softline` / `hardline` Handling**
   - Ensure exactly one blank `*` line between summary and first tag.

5. **Tests**
   - Fixture with long summary that must wrap; verify output matches snapshot.
   - Fixture with `@remarks` containing two sentences; verify positioning &
     wrapping.

6. **Update Build**
   - No special changes; keep type-safety.

## Acceptance Criteria

- Running Prettier with the plugin on fixtures produces snapshot matching spec
  rules.
- Summary remains idempotent on second format pass.

## Migration Notes

Projects will start seeing changes to formatted comments for summary/remarks.
Release this under a **minor** version bump with a CHANGELOG entry.
