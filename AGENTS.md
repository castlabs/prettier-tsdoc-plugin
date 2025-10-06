# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the plugin source and colocated `*.test.ts` specs; keep new
  logic modular (e.g., `format.ts` for printers, `ast-analyzer.ts` for
  traversal) and reuse helpers in `src/utils/`.
- `dist/` is the Rollup build output—never edit manually; regenerate via the
  build pipeline.
- `example/` hosts a sample project for manual verification with its own npm
  scripts.
- `agents/` holds deep-dive design notes; update the relevant brief when
  architectural behavior changes.

## Build, Test, and Development Commands

- `npm run build`: bundles the plugin with Rollup into `dist/`.
- `npm run typecheck`: runs `tsc --noEmit` using the strict NodeNext config.
- `npm run lint` / `npm run lint:fix`: applies the ESLint +
  `eslint-plugin-tsdoc` rules, optionally auto-fixing.
- `npm run prettier`: formats the workspace using the repository Prettier
  config.
- `npm run test` / `npm run test:watch`: executes the Vitest suite once or in
  watch mode.
- `npm run check`: sequentially runs build, prettier, typecheck, lint:fix, and
  test; use before publishing.

## Coding Style & Naming Conventions

- Follow the Prettier defaults: 2-space indentation, 80-character wrap,
  semicolons, and single quotes.
- Prefer descriptive module and export names (e.g., `parseConfig`,
  `normalizeTags`) and keep test filenames aligned with their subjects.
- Use TypeScript strict mode idioms; `any` is allowed only where demanded by
  Prettier APIs and must be documented.
- Maintain TSDoc syntax compliance—ESLint enforces `@tsdoc/syntax` errors during
  linting.

## Testing Guidelines

- Write Vitest cases alongside implementations as `*.test.ts`; leverage
  `src/test-utils.ts` helpers for shared fixtures.
- Cover new parser behaviors with scenario-focused integration tests (e.g.,
  extend `end-to-end.test.ts`).
- Run `npm run test` locally before each PR and add regression cases for any bug
  fix.

## Commit & Pull Request Guidelines

- Commit subjects should stay concise, capitalized, and imperative, following
  the existing history (e.g., “Add multi-line param formatting”).
- Break larger efforts into logical commits that isolate behavior changes from
  mechanical formatting.
- PRs must include: a clear summary of formatting effects, references to related
  issues, confirmation that `npm run check` passed, and before/after TSDoc
  snippets when UX changes.
- Update README examples and the relevant `agents/*.md` brief whenever new
  options or behaviors are introduced.
