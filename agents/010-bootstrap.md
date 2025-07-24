# Phase 010 – Project Bootstrap & Continuous Integration

## Goal

Lay a solid foundation for the plugin so that subsequent phases can focus purely
on functionality.

## Deliverables

1. **Package Scaffolding**
   - `package.json` with:
     - `"type": "module"`
     - `exports` field that exposes the `dist/index.js` plugin entry
     - scripts: `build`, `test`, `lint`
   - `.npmignore` / `.gitignore`
   - MIT license & rudimentary `README.md` linking to spec.

2. **TypeScript & Build**
   - `tsconfig.json` targeting `ES2020`, `moduleResolution: NodeNext`.
   - No [`ts-node`](https://github.com/TypeStrong/ts-node) at runtime—compile
     via `tsc`.
   - Output written to `dist/`; declaration files enabled.

3. **Runtime Skeleton**
   - `src/index.ts` – exports a minimal Prettier plugin object with an empty
     `printComment` that always returns `false` (fall-through to Prettier
     default).
   - `src/format.ts` – placeholder that will later host formatting logic.

4. **Testing Setup**
   - Vitest configured (`vitest.config.ts`): ESM if the default configuration is
     not enough
   - One sanity test that loads the built plugin via `import` and asserts it has
     `printers`.

## Acceptance Criteria

- `npm run build` emits the compiled artifacts without TypeScript errors.
- `npm test` executes Vitest and all tests pass.
- Publishing the package (dry-run) results in ✅ no extraneous files.

## Out-of-Scope

- No real formatting or parsing yet.
- No Prettier option wiring.

## Test Matrix

| Scenario                                        | Expectation                           |
| ----------------------------------------------- | ------------------------------------- |
| Require plugin from compiled `dist`             | Object has keys `printers`, `options` |
| Running Prettier on a file without doc comments | Output identical to input             |

## Migration Notes

This phase can be merged immediately; it produces no observable formatting
changes for downstream consumers.
