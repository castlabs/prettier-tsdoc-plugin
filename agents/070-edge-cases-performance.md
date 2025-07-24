# Phase 070 – Edge-Cases, Performance & Telemetry

## Goal

Stabilise the plugin for real-world repositories, optimise hot paths, and
surface diagnostic telemetry for parse failures.

## Deliverables

1. **Performance Benchmarks**
   - `benchmarks/` folder using
     [`tinybench`](https://github.com/tinylabs/tinybench) measuring:
     - Mean formatting time per comment across varying sizes.
     - Memory consumption snapshot.

2. **Large-file Stress Tests**
   - Vitest that formats a synthetic 10 k-line TypeScript file containing 500
     TSDoc comments; asserts time budget < 2 s on CI.

3. **Failure Telemetry**
   - Collect parse-error counts; expose `options.logger` ‑based debug summary
     when `PRETTIER_TSDOC_DEBUG=1` env var set.

4. **Internal Caching**
   - Memoize parser + configuration.
   - Memoize Markdown `textToDoc` results keyed by `(hash(markdown), parser)`.

5. **Documentation**
   - Performance tuning tips in `README.md`.

## Acceptance Criteria

- Benchmarks show <10 ms mean per comment on Node 18 (MacBook-class CPU).
- No memory leaks detected by simple heap-snapshot diff.

## Migration Notes

No user-visible formatting changes; patch-level release (`x.y.+1`).
