# Phase 090 – Bundling

## Status: 🔄 PROPOSED

## Goal

Use Rollup to produce a single entry-point JavaScript bundle in the `dist/`
folder and discontinue emitting raw TypeScript code. Include a source map
(`.js.map`) to preserve debug traceability.

## Deliverables

1. **Rollup Configuration**
   - Add a `rollup.config.js` in the project root to bundle the plugin entry
     (e.g., `src/index.js`) into `dist/index.js`.
   - Configure input, output (ESM), and source map generation.

2. **Build Script Update**
   - Modify `package.json` `build` script to invoke Rollup instead of `tsc` for
     JavaScript output.
     - Make sure that the `tsc` call is still available as a `typecheck` task
   - Since we are exposing a prettier plugin, we do no longer need to produce
     `.d.ts` files.

3. **TypeScript Emit Adjustment**
   - Update `tsconfig.json` to disable JS emit (`"noEmit": true` → using Rollup)
     and make sure that we are not creating declarations.

4. **Plugin Dependencies**
   - Install and configure necessary Rollup plugins:
     - `@rollup/plugin-node-resolve`
     - `@rollup/plugin-typescript` or equivalent for declaration handling

5. **Source Map Support**
   - Enable `sourcemap: true` in Rollup output settings to emit `.js.map`.

6. **Package Entry Points**
   - Update `package.json` `main`, `module`, and/or `exports` fields to point to
     `dist/index.js`.

7. **Documentation**
   - Revise `README.md` build instructions to reflect the Rollup bundle step and
     list any new dependencies or scripts.

## Acceptance Criteria

- `npm run build` produces exactly `dist/index.js`, `dist/index.js.map`, with no
  raw `.ts` or unbundled `.js` files in `dist/`.
- Consumers can import the plugin via the single entry point without loss of
  functionality.
- Source maps correctly map the bundled code back to the original sources.
- Package install (`npm pack`) includes only the `dist/` folder, type
  declarations, `package.json`, and `README.md`.

## Migration & Compatibility Notes

- This is a breaking change: existing consumers relying on per-module output or
  raw JS/TS in `dist/` must update to use the bundled entry point.
