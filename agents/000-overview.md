# Phase Plan Overview

This document enumerates the phased implementation strategy for the
**Prettier&nbsp;Plugin&nbsp;for&nbsp;TSDoc** described in `context.md`.

Each phase lives in its own file whose name starts with a three–digit numeric
prefix so the files sort naturally. A phase is considered _done_ when:

1. All TypeScript source code targeted by the phase compiles successfully via
   `npm run build`.
2. The Vitest test-suite for the phase (`npm test`) passes.
3. Run `npm run prettier` to make sure that files are properly formatted

More information about the project can be found in:

- `context.md`

The general structure is that

- `src/` contains all the sources with `src/index.ts` as the primary entry point
- `dist/` contains the build results
- We create module tests inside the `src` folder using `XXX.test.ts` file names

Phases are strictly additive—later phases build upon the artifacts delivered by
earlier ones without breaking them. Refactors are allowed, but must preserve
public behaviour proven by existing tests.

| File                                 | High-level goal                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `010-bootstrap.md`                   | Package scaffolding, continuous integration, empty plugin shell + sanity tests |
| `020-parser-detection.md`            | Wire up comment detection & TSDoc parsing with graceful fallback               |
| `030-summary-remarks.md`             | Format summary & `@remarks` sections, implement width calculations             |
| `040-tags-alignment.md`              | Handle `@param`, `@typeParam`, `@returns`, alignment & hyphen rules            |
| `050-markdown-codeblocks.md`         | Delegate Markdown & fenced-code to Prettier, support language mapping          |
| `060-configuration-normalization.md` | Expose user options, tag spelling normalisation, deduping                      |
| `070-edge-cases-performance.md`      | Performance tuning, large-file stress tests, failure telemetry                 |

Use this table as a quick index into the per-phase details.
