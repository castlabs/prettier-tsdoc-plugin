# Phase Plan Overview

This document enumerates the phased implementation strategy for the
**Prettier&nbsp;Plugin&nbsp;for&nbsp;TSDoc** described in `context.md`.

Each phase lives in its own file whose name starts with a three–digit numeric
prefix so the files sort naturally. A phase is considered _done_ when:

1. All TypeScript source code targeted by the phase compiles successfully via
   `npm run typecheck`.
2. The Vitest test-suite for the phase (`npm test`) passes.
3. Run `npm run prettier` to make sure that files are properly formatted
4. Run `npm run lint` to make sure that there are no linting issues

More information about the project can be found in:

- `context.md`

The general structure is that

- `src/` contains all the sources with `src/index.ts` as the primary entry point
- `dist/` contains the build results
- We create module tests inside the `src` folder using `XXX.test.ts` file names

Phases are strictly additive—later phases build upon the artifacts delivered by
earlier ones without breaking them. Refactors are allowed, but must preserve
public behaviour proven by existing tests.
