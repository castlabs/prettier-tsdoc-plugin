# Phase 020 – Comment Detection & TSDoc Parsing

## Status: ✅ COMPLETED

## Goal

Detect candidate multi-line `/** … */` comments inside the Prettier print
pipeline and parse them with `@microsoft/tsdoc`, laying the groundwork for real
formatting.

## Deliverables

1. **Comment Detection Logic**
   - Implement
     `isTSDocCandidate(comment: CommentNode, force?: boolean): boolean`
     following rules in §3 of the spec.

2. **Parser Configuration Builder**
   - `src/parser-config.ts` exports
     `createTSDocConfiguration(extra?: string[]): TSDocConfiguration` that
     registers core & extended tags (TypeDoc/AEDoc) per §4.3.

3. **Basic `printComment` Hook**
   - In `src/index.ts`, call the detection helper.
   - If eligible, parse via a singleton `TSDocParser` (reuse across calls).
   - For now, do _not_ transform—simply return `false` so Prettier prints the
     original comment, but **ensure that parsing errors are swallowed
     gracefully** and surfaced via `options.logger.warn`.

4. **Tests**
   - Add fixture input containing:
     - A TSDoc block with `@param` & inline `{@link}`.
     - A non-doc `/* plain */` block.
   - Test that detection returns `true` only for the former.
   - Test that `createTSDocConfiguration()` includes sample extended tags such
     as `@category` and `@beta`.

5. **Build**
   - No new build requirements—`npm run build` must still succeed.

## Acceptance Criteria

- `isTSDocCandidate` matches rules in §3 and passes the test matrix.
- Parser successfully processes complex tag soup without throwing.
- Non-TSDoc comments are left untouched.

## Migration Notes

No emitted code changes yet; downstream projects see no formatting difference,
but internal plumbing is now exercised by tests.
