# Prettier Plugin for TSDoc — Detailed Specification

- **Status:** Draft (ready for initial implementation)
- **Scope:** Formatting _only_ (no semantic validation).
- **Implementation:** Written in TypeScript.
- **Testing:** Uses [Vitest](https://vitest.dev/) for all tests.
- **Runtime:** Node ≥ 18; ESM module
- **Integrations:** Prettier core printers (`estree`, `typescript`, etc.),
  `@microsoft/tsdoc` AST, optional TypeDoc/AEDoc tag awareness, API Extractor
  conventions.

---

## 1. Goals & Non‑Goals

### 1.1 Goals

- Provide consistent, idempotent formatting of multi‑line TSDoc block comments
  (`/** ... */`).
- Enforce structural conventions: leading `/**`, aligned leading `*`, single
  space after `*`, controlled blank lines, aligned tags, wrapped prose
  respecting Prettier `printWidth`.
- Normalize a constrained set of common tag spelling variants (e.g., `@return` →
  `@returns`).
- Preserve and properly format inline tags (e.g., `{@link}`, `{@inheritDoc}`)
  without breaking them across lines.
- Reflow Markdown and fenced code blocks inside comments by delegating to
  Prettier’s existing language formatters when possible.
- Support extended ecosystems (TypeDoc, API Extractor/AEDoc) without requiring
  them at runtime.
- Fail safe: if parsing fails, fall back to minimally normalized original
  comment text (never emit invalid syntax).

### 1.2 Non‑Goals

- **No semantic analysis:** Do _not_ verify that `@param` names match function
  parameters, that release tags are allowed in project config, etc. That’s for
  linters / API Extractor.
- **No content generation:** Never synthesize missing tags or descriptions.
- **No reordering of tags** by default (except optional grouping rules when
  explicitly enabled by config; see §5.5).
- **No mutation of code outside comments.**

---

## 2. Operating Model

The plugin _does not_ introduce a new Prettier language. Instead, it augments
existing JavaScript/TypeScript printers by intercepting comment printing via a
custom `printComment` that:

1. Detects eligible multi‑line `/**` doc comments.
2. Uses `@microsoft/tsdoc` to parse into a TSDoc AST (with an augmented
   configuration that includes common TypeDoc/AEDoc tags; see §4.3).
3. Converts the parsed structure into a Prettier `Doc` tree using `doc.builders`
   (`group`, `line`, `softline`, `fill`, `indent`, etc.).
4. Delegates Markdown and fenced code formatting to Prettier via `textToDoc`
   calls using the appropriate parser.
5. Emits a fully formatted doc comment string that Prettier then embeds in the
   final output.

Because we hook only `printComment`, we inherit all upstream Prettier logic for
code formatting and comment attachment.

---

## 3. Comment Detection

A comment is considered a candidate for TSDoc formatting when _all_ are true:

- Starts with `/**` (not `/*!`).
- Is multi‑line (i.e., contains a newline before closing `*/`).
- Contains at least one recognized TSDoc element (summary text counts; tags
  optional).

Heuristics:

- If the body contains `@` followed by an identifier or any `{@...}` inline
  form, treat as TSDoc.
- If parse throws, log (debug) and fall back to original comment normalized for
  leading `*` alignment only.

---

## 4. Parsing Configuration

### 4.1 Base Parser

Use `@microsoft/tsdoc` `TSDocParser` with a `TSDocConfiguration` instance.

### 4.2 Standard Tags

Include the TSDoc core tag definitions (`@param`, `@returns`, `@remarks`,
`@example`, `@defaultValue`, `@deprecated`, `@link`, `@inheritDoc`, etc.).

### 4.3 Extended Tag Set (TypeDoc & AEDoc)

Augment the configuration (if not already present) with _known but optional_
tags so that parsing succeeds and we can format them:

- **Block tags:** `@category`, `@categoryDescription`, `@group`,
  `@groupDescription`, `@default`, `@document`, `@expandType`, `@import`,
  `@inlineType`, `@license`, `@module`, `@preventExpand`, `@preventInline`,
  `@privateRemarks`, `@property`/`@prop`, `@returns`/`@return`, `@see`,
  `@since`, `@sortStrategy`, `@summary`, `@template`, `@throws`, `@typeParam`,
  `@type` (legacy), etc.
- **Modifier tags:** `@abstract`, `@alpha`, `@beta`, `@event`, `@eventProperty`,
  `@experimental`, `@hidden`, `@inline`, `@internal`, `@override`, `@public`,
  `@readonly`, `@sealed`, `@virtual`, ... (add others from TypeDoc tag list /
  AEDoc as needed).
- **Inline tags:** `@link`, `@linkcode`, `@linkplain`, `@inheritDoc`, `@label`,
  `@include`, `@includeCode`.

> **Rationale:** Even if downstream tools ignore some tags, formatting should
> remain stable and non‑destructive.

### 4.4 Custom Tag Support

Expose a config option `extraTags: string[]` to add custom tag definitions
(syntaxKind = block | inline | modifier) without rebuilding.

---

## 5. Formatting Rules

### 5.1 Block Structure & Indentation

- Emit `/**` on its own line.
- For each subsequent line, emit `*` followed by exactly one space _unless_ the
  line is intentionally empty (then emit `*`).
- Close with `*/` on its own line aligned with the opening `/**`.
- Respect file indentation context supplied by Prettier (use `options.tabWidth`,
  `useTabs`).

### 5.2 Blank Lines

- **Between summary and first block tag:** exactly one empty `*` line.
- **Between logical sections (e.g., summary → remarks → params):** preserve at
  most one blank; collapse multiple blanks to one.
- **Before closing `*/`:** no trailing blank lines unless comment body ends with
  a fenced code block that requires a newline to terminate (handled
  automatically).

### 5.3 Summary Section

- Capture contiguous initial prose until first explicit block tag (`@...`) as
  the _summary_.
- Soft‑wrap to `printWidth` minus comment prefix width.
- Summary should remain a single paragraph; internal blank lines terminate
  summary.
- Option: `singleSentenceSummary: boolean` — if `true`, stop summary at first
  period followed by space and newline; remaining prose goes to `@remarks`.

### 5.4 `@remarks` Section

- Treat as long‑form Markdown; format using Markdown pipeline (see §6.2).
  Enforce separation blank line before `@remarks` tag.

### 5.5 Tag Ordering (Configurable)

Default: **preserve order** from source. Optional
(`normalizeTagOrder: boolean`): reorder into canonical blocks: release tag
modifiers → summary/remarks (already positioned) → parameter‑like tags
(`@param`, `@typeParam`, `@returns`) → examples → other tags alphabetical. Never
enabled by default to avoid surprising diffs.

### 5.6 Alignment of Like Tags

When two or more adjacent tags of the same family appear (`@param`,
`@typeParam`, `@property`, etc.):

- Vertically align the _description start column_ by padding spaces after the
  tag name / parameter identifier / hyphen.
- Use a hyphen separator pattern for `@param` and `@typeParam` (see §5.7).
- Continuation lines in wrapped descriptions are indented two spaces past the
  starting column.

**Example:**

```ts
/**
 * Do a thing.
 *
 * @param veryLongParameterName - Explanation that wraps.
 * @param id - Short.
 * @typeParam TItem - Item type.
 * @returns Result value.
 */
```

### 5.7 `@param` & `@typeParam` Formatting Rules

- Syntax: `@param <name> - <description>`; `@typeParam <T> - <description>`.
- Exactly one space before and after `-`.
- If no description text, omit `-` entirely (configurable; default omit).
- Long names wrap onto next line; description starts on following line indented
  two spaces (so visual alignment remains clear).

### 5.8 `@returns` Formatting Rules

- Normalize lone `@return` → `@returns`.
- Use `@returns <description>` (no hyphen).
- Wrap description like prose.

### 5.9 Other Common Block Tags

Handle consistently with prose wrapping & indentation: `@remarks`, `@example`,
`@defaultValue`/`@default`, `@deprecated`, `@throws`, `@see`, `@category`,
`@group`, `@privateRemarks`, etc.

### 5.10 Release Tags (Modifier Tags)

Release tags (visibility modifiers) are: `@public`, `@beta`, `@alpha`,
`@internal`.

Formatting behavior:

- Collapse duplicates (keep the first encountered instance; drop others) when
  `dedupeReleaseTags: true` (default **true** because extra tags are never
  useful and can produce downstream warnings).
- Optionally normalize multiple distinct release tags to the _most restrictive_
  or _first one_ (config
  `releaseTagStrategy: 'first' | 'maxVisibility' | 'none'`; default `'first'`).
  _Formatting plugin does not introduce new tags._
- Preferred placement: first modifier block after summary/remarks when
  `normalizeTagOrder` enabled; otherwise preserve.

### 5.11 Modifier Tags (General)

Modifier tags have no following prose. Emit each on its own `* @tag` line.
Multiple modifiers may share a line in source; if `splitModifiers: true`
(default), print one per line for readability (except when preserving original
text is requested).

### 5.12 Inline Tags

Inline tags are printed atomically; never insert interior line breaks.

#### 5.12.1 `{@link}` Variants & Display Text

Supported syntaxes:

- `{@link Symbol}`
- `{@link https://example.com}`
- `{@link Symbol | custom text}` (display text separated by `|`)
- `{@link https://example.com | descriptive text}`

Formatting:

- Collapse internal whitespace: exactly one space after tag name; one space
  around pipe when present.
- If display text present, entire inline tag must be kept together; treat as a
  `group` that is never broken.
- Escape closing brace `}` as needed (delegate to parser re‑emit).

#### 5.12.2 Other Inline Tags

- `{@inheritDoc}` printed verbatim.
- `{@label foo}` — preserve content.
- `{@include file.md}` / `{@includeCode file.ts}` — treat content as opaque.

### 5.13 Markdown Lists & Emphasis

- Prettier Markdown printer handles bullet re‑indentation and wrapping; plugin
  simply passes raw Markdown out of the TSDoc block region to Prettier.
- Ensure that list indentation is relative to comment `*` prefix width.

### 5.14 Code Spans & Backticks

Inline code enclosed in backticks is preserved; no wrapping within backticks.

---

## 6. Markdown & Embedded Code Handling

### 6.1 Markdown Partitioning

TSDoc text nodes may contain inline HTML/Markdown. Strategy:

1. Extract contiguous Markdown prose segments.
2. Strip comment prefix and accumulate the raw Markdown text.
3. Call `textToDoc(markdownText, { parser: 'markdown', ...prettierOptions })`.
4. Re‑emit into comment with proper prefixing.

### 6.2 Fenced Code Blocks

When Markdown contains fenced code blocks (```lang), apply language‑specific
formatting:

- Determine language from fence info string.
- Map known aliases → Prettier parser names: `ts`, `typescript` → `typescript`;
  `js`, `javascript` → `babel-ts` or `babel`; `json` → `json`; `html` → `html`;
  `css` → `css`; `shell`, `sh`, `bash` → `babel` _as plain text_ unless a shell
  plugin supplied; treat unknown languages as verbatim.
- Use `textToDoc(code, { parser: mappedParser })` where available; otherwise
  emit code unchanged.
- Preserve triple‑backtick fence style; normalize closing fence to match opening
  length.

### 6.3 Indentation in Fenced Blocks

Indent fenced block content by one space relative to the `*` column (common
TSDoc style) or leave flush (configurable `fencedIndent: 'space' | 'none'`,
default `'space'`).

---

## 7. Wrapping & Width Calculation

### 7.1 Effective Width

Available width per line is `printWidth - leadingPrefixWidth`, where
`leadingPrefixWidth` = indentation of comment start + 3 (for `*` prefix). When
using tabs, compute visual width using Prettier’s utilities.

### 7.2 Wrap Strategy

- Use Prettier `fill` builder for flowing sequences of words.
- Break only at whitespace boundaries.
- Never wrap inside inline code backticks or inline tags.
- Preserve manual hard line breaks in user text _iff_ `respectHardBreaks: true`
  (default **false** for fully managed wrap; Markdown printer may override in
  Markdown sections).

---

## 8. Normalization & Canonicalization

### 8.1 Tag Spelling Normalization Table (Initial)

| Input      | Output          | Notes                                                                                         |
| ---------- | --------------- | --------------------------------------------------------------------------------------------- |
| `@return`  | `@returns`      | Always normalize.                                                                             |
| `@prop`    | `@property`     | When followed by name; safe alias.                                                            |
| `@default` | `@defaultValue` | Alias; preserve only if config `expandDefault` true (default **false**, leave as `@default`). |

Extendable via config `normalizeTags: Record<string,string>`.

### 8.2 Whitespace Collapsing

- Collapse multiple spaces after tag name to one.
- Trim trailing spaces at line end.
- Replace mixed indentation in comment body with single space after `*`.

### 8.3 Duplicate Tag Collapsing

- Release tag duplicates collapsed (see §5.10).
- Repeated identical `@deprecated` lines collapsed when
  `dedupeIdenticalTags: true`.

---

## 9. Configuration Options

All exposed via Prettier plugin options namespace `tsdoc` (to avoid global
clutter). Example `.prettierrc`:

```json
{
  "printWidth": 100,
  "plugins": ["./tools/prettier-plugin-tsdoc"],
  "tsdoc": {
    "normalizeTagOrder": false,
    "dedupeReleaseTags": true,
    "splitModifiers": true,
    "singleSentenceSummary": false,
    "fencedIndent": "space",
    "extraTags": [],
    "normalizeTags": { "@return": "@returns" }
  }
}
```

> All options optional; sensible defaults aim to match widely used community
> style.

---

## 10. Implementation Plan

### 10.1 Package Layout (Zero Build)

```
prettier-plugin-tsdoc/
├─ package.json ("type": "module")
├─ index.js            # plugin entry (exports default plugin object)
├─ parser-config.js    # builds TSDocConfiguration incl. extended tags
├─ format.js           # core printComment implementation
├─ utils/
│   ├─ text-width.js   # compute effective widths
│   ├─ tags.js         # normalization maps & alignment helpers
│   └─ markdown.js     # extraction & embed helpers
└─ test/
    ├─ fixtures/
    └─ snapshots/
```

### 10.2 index.js Sketch (illustrative, not production)

```js
import * as prettier from 'prettier';
import { createTSDocConfiguration, formatTSDocComment } from './format.js';

/** @type {import('prettier').Plugin} */
export default function createPlugin() {
  // build once; reuse
  const tsdocConfig = createTSDocConfiguration();

  function printComment(path, options, print) {
    const comment = path.getValue();
    if (!comment || comment.type !== 'CommentBlock') return false; // let Prettier handle
    if (!comment.value.startsWith('*')) return false; // not /** */

    try {
      return formatTSDocComment(comment, options, tsdocConfig);
    } catch (e) {
      if (options.logger && options.logger.warn) {
        options.logger.warn('TSDoc formatting failed: ' + e.message);
      }
      return false; // fallback to Prettier default
    }
  }

  return {
    // no new languages
    printers: {
      estree: { ...prettier.plugins.estree.printers.estree, printComment },
      typescript: {
        ...prettier.plugins.typescript.printers.typescript,
        printComment,
      },
    },
    options: {
      tsdoc: { type: 'path', category: 'TSDOC', default: {} },
    },
  };
}
```

_(Pseudo‑code; actual wiring may differ depending on Prettier version; see §10.5
Compatibility.)_

### 10.3 Formatting Pipeline Steps

1. **Strip delimiters**: remove `/*`, leading `*`, trailing `*/`, reconstruct
   raw text.
2. **Parse** with TSDoc.
3. **Normalize tag spellings** (table §8.1) _before_ building Doc nodes, update
   AST or maintain mapping.
4. **Build intermediate model** representing ordered sections: summary, remarks,
   blocks (params, returns, others), modifiers.
5. **Apply config transforms** (reorder, dedupe, split modifiers).
6. **Build Prettier Doc** using builders; measure width for alignment.
7. **Stringify** with final indentation/prefix re‑applied.

### 10.4 Width & Alignment Calculation

- Determine maximum tag header width across like‑tag groups (e.g., longest
  `@param name -`).
- Add minimum 1 space between header and description start.
- Guard against exceeding `printWidth`; if header itself too long, break header
  and indent description on next line.

### 10.5 Prettier Version Compatibility

- Target Prettier ≥ 3.0.
- Detect runtime Prettier major; if <3, fallback to legacy injection strategy
  (documented in README; out of mainline spec).

---

## 11. Safety, Fallbacks & Idempotence

### 11.1 Parse Failures

If TSDoc parsing fails:

- Emit original comment, normalized for leading `*` spacing only (so we at least
  clean indentation).
- Append a hidden diagnostic via Prettier `options.logger` (debug only).

### 11.2 Unknown Tags

Unknown tags are preserved verbatim with canonical spacing
(`@unknownTag rest of line`). They participate in alignment only within their
contiguous group of identical tag names.

### 11.3 Idempotence Contract

Running Prettier+plugin repeatedly without source changes must produce
byte‑identical output (except for irrelevant whitespace at file end controlled
by Prettier). Add golden snapshot tests to enforce.

---

## 12. Testing Strategy

| Area               | Test Type | Notes                                                |
| ------------------ | --------- | ---------------------------------------------------- | ------- |
| Happy path parse   | Snapshot  | Various mixes of tags, markdown, code fences.        |
| Alignment          | Unit      | Check computed columns for param group.              |
| Wrapping           | Snapshot  | Vary `printWidth` small/large.                       |
| Inline link pipe   | Snapshot  | Ensure no breaks inside `{@link Foo                  | text}`. |
| Release tag dedupe | Unit      | Multiple `@public` collapse → one.                   |
| Fallback           | Unit      | Malformed comment returns minimally normalized text. |
| Config toggles     | Snapshot  | flip each option.                                    |
| Idempotence        | Roundtrip | Run format twice; diff.                              |

---

## 13. Performance Considerations

- Parse cost: TSDoc parse per comment; acceptable for typical project sizes.
  Consider memoizing when identical raw comment strings repeat (rare).
- Avoid constructing large intermediate strings; operate on AST nodes & builder
  docs.
- Lazy Markdown reformat: only call `textToDoc` when segment length > N
  (configurable threshold) or contains Markdown triggers.

---

## 14. Extensibility Hooks

Expose internal utilities for advanced users:

- `createTSDocConfiguration(extraTags?)` — returns configuration instance.
- `formatTSDoc(rawComment: string, options)` — pure function for programmatic
  use (unit tests, custom pipelines).
- `parseAndFormatFromNode(node, options)` — convenience for AST integration.

---

## 15. Known Edge Cases & Handling Guidelines

| Case                                   | Desired Behavior                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Mixed line endings                     | Normalize to host OS or Prettier `endOfLine` option.                                                              |
| Windows comment indentation misaligned | Recompute prefix per line; ignore incoming spacing.                                                               |
| Stars missing on some lines            | Reconstruct canonical `*` prefix for _all_ lines.                                                                 |
| User‑aligned ASCII tables in comments  | If fenced as code, preserve; if raw, plugin may reflow and break alignment—recommend triple backticks to protect. |
| HTML blocks in comments                | Treat as Markdown HTML; delegate to Markdown printer; if fails, emit verbatim.                                    |
| `*/` inside code fence                 | Escaped by comment extractor before parse; ensure safe sentinel replacement.                                      |

---

## 16. Documentation & User Guidance (README Outline)

1. Install & configure Prettier plugin.
2. Recommended `.prettierrc` snippet.
3. Supported tags & normalization table.
4. Configuration reference (§9).
5. Limitations (formatting only; no linting).
6. Interop notes for API Extractor & TypeDoc.
7. Troubleshooting (parse errors, unsupported tag warnings).

---

## 17. Open Questions / TODO Before 1.0

- Should we _auto‑promote_ multi‑paragraph summaries into `@remarks`? (Currently
  off.)
- Should we normalize `@throws` vs `@exception`? (Lean yes; alias list.)
- Accept `{@linkcode}` vs `{@linkplain}` variants? (Yes, treat as inline; no
  splitting.)
- Provide per‑tag wrap overrides? e.g., never wrap `@deprecated` contents
  mid‑sentence? (Investigate.)
- Detect and protect `eslint-disable` style pragmas inside comments? (Likely out
  of scope.)

---

## 18. Appendices

### 18.1 Minimal Grammar Fragments (Reference)

_(Non‑normative; summarizing TSDoc + Markdown interplay)_

```
TSDocComment ::= "/**" Newline CommentBody "*/"
CommentBody  ::= { CommentLine }
CommentLine  ::= "*" [Space Content]? Newline
Content      ::= Summary | BlockTag | ModifierTag | InlineTag | Markdown
         ...
```

### 18.2 Tag Families (Starter Matrix)

| Tag           | Kind  | Has Name Param? | Uses Hyphen? | Wrap Behavior             |
| ------------- | ----- | --------------- | ------------ | ------------------------- |
| @param        | block | Yes             | Yes          | flow prose                |
| @typeParam    | block | Yes             | Yes          | flow prose                |
| @returns      | block | No              | No           | flow prose                |
| @remarks      | block | No              | No           | markdown                  |
| @example      | block | No              | No           | markdown (fenced allowed) |
| @defaultValue | block | No              | No           | inline code allowed       |
| @deprecated   | block | No              | No           | short prose               |
| @see          | block | Optional        | No           | prose or links            |
| @category     | block | Yes             | No           | single token or words     |

(Extend as additional tags added.)
