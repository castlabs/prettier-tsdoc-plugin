# Phase 060 – Configuration Surface & Tag Normalisation

## Status: ✅ COMPLETED

## Goal

Expose user-configurable options under the `tsdoc` Prettier namespace and honour
them during formatting. Implement tag spelling normalisation and
duplicate-release-tag deduping.

## Deliverables

1. **Option Definitions**
   - Add `options.tsdoc` object in plugin export as per §9.

2. **Runtime Option Handling**
   - Read options inside `formatTSDocComment` and pass to helpers.

3. **Spelling Normalisation**
   - Table from §8.1 hard-coded; merge with user-supplied `normalizeTags`.

4. **Release-Tag Deduplication**
   - Implement `dedupeReleaseTags` & `releaseTagStrategy` logic.

5. **Tests**
   - Verify `@return` becomes `@returns` when formatting.
   - Verify duplicate `@public` tags are collapsed when option enabled.

6. **Documentation**
   - Update `README.md` with option table and examples.

## Acceptance Criteria

- Option defaults match spec.
- Tests cover both default behaviour and overridden settings.

## Migration Notes

Marks feature completeness for v1. Backwards compatibility contract begins here.
