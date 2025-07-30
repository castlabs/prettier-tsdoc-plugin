# Phase Plan Overview

This document enumerates the phased implementation strategy for the **Prettier
Plugin for TSDoc** described in `context.md`.

Each phase lives in its own file whose name starts with a three–digit numeric
prefix so the files sort naturally. At least when the implementation is done but
potentially also during development:

1. Run `npm check` for a full check. This runs:
   1. All TypeScript source code targeted by the phase compiles successfully via
      `npm run typecheck`.
   1. The Vitest test-suite for the phase (`npm test`) passes.
   1. Run `npm run prettier` to make sure that files are properly formatted
   1. Run `npm run lint:fix` to make sure that there are no linting issues

More information about the project can be found in:

- `context.md`

The general structure is that

- `src/` contains all the sources with `src/index.ts` as the primary entry point
- `dist/` contains the build results
- `example/` contains a standalone example project. You can use this and once
  the plugin is build, inside the `example` folder you can:
  - use `npm run prettier` to run prettier with the plugin enabled. You can then
    introspect `example/src/` and the files in there for the result and what the
    plugin did. You can use this for development, but do not use this for the
    actual test suite.
  - use `npm run typedoc` to check the TypeDoc results and check if the
    rendering worked as expected.
- We create module tests inside the `src` folder using `XXX.test.ts` file names

Phases are strictly additive—later phases build upon the artifacts delivered by
earlier ones without breaking them. Refactors are allowed, but must preserve
public behaviour proven by existing tests.

## Architectural Patterns

### AST-Based Transformations Over Regex

When implementing comment transformations, prefer AST-based approaches over
regex or direct text manipulations for reliability and idempotency:

**Pattern**: Register custom tags in TSDoc configuration, then handle different
node types in the AST traversal.

**Benefits**:

- **Perfect Idempotency**: AST naturally differentiates between original tags
  and transformed content
- **Robust Parsing**: Leverages TSDoc's built-in parsing for complex comment
  structures
- **Performance**: Faster than multiple regex passes with better error handling
- **Maintainability**: Clear separation between parsing logic and transformation
  logic

**Implementation Strategy**:

1. Register custom tags in `parser-config.ts` with appropriate
   `TSDocTagSyntaxKind`
2. Handle multiple node types in transformation logic (e.g., `InlineTag` vs
   `CodeSpan`)
3. Ensure transformations are idempotent by properly handling both original and
   transformed states
