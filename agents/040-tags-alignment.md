# Phase 040 – Parameter-like Tag Formatting & Alignment

## Status: ✅ COMPLETED

## Goal

Provide fully formatted `@param`, `@typeParam`, and `@returns` tags, including:

- Hyphen separators (`-`) where required.
- Vertical alignment of description columns within like-tag groups.
- Wrapping of long names & descriptions.

## Deliverables

1. **Tag Helper Utilities**
   - `utils/tags.ts` containing:
     - `splitParamTag(node): { name: string; desc: string }`.
     - `computeColumnWidths(tags): number`.
     - `printAligned(tags, width, builders): Doc`.

2. **Formatting Logic in `formatTSDocComment`**
   - Detect contiguous tag groups, compute widths, emit aligned output per
     §5.6–§5.8.

3. **Edge-case Handling**
   - Extremely long identifier > `printWidth` forces description onto next line.
   - Missing description omits `-`.

4. **Tests**
   - Multi-line fixture with mixed-length parameter names – snapshot expected
     alignment.
   - Fixture without description – assert no hyphen.

5. **Build**
   - Ensure type-checking of utilities.

## Acceptance Criteria

- Alignment column consistent across tag group.
- Output stable across multiple format passes.

## Migration Notes

Formatting of parameter-like tags will now change; communicate clearly in
release notes and bump MINOR version.
