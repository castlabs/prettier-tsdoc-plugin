# Phase 080 – Release Tags

## Status: ✅ COMPLETED

## Goal

Ensure that all high-level constructs in TSDoc comments are annotated with a
release tag, allowing users to specify a default tag if none exists, defaulting
to `@internal`.

## Planning and Design

- **Identify Integration Points**: Review and understand existing phases and
  integration points where release tags can be seamlessly injected or appended.
  - Existing integration point: `format.ts` where TSDoc comments are parsed and
    formatted.
  - Configuration expansion: `parser-config.js` for handling additional tag
    configurations.

- **Define Configuration Options**:
  - Introduce `defaultReleaseTag` in `.prettierrc` under the `tsdoc` namespace
    with a default value set to `@internal`.
  - Ensure backward compatibility by verifying that existing configurations are
    not impacted.

- **Outline Parsing Logic**:
  - If no release tag exists in a high-level construct, append the
    `defaultReleaseTag` during formatting.
  - Leverage the TSDoc AST to detect missing release tags efficiently.
  - Ensure the appended tag adheres to existing formatting standards.

- **Test Scenarios and Coverage**:
  - Test with various scenarios including existing release tags, missing release
    tags, and custom default tags.
  - Validate that tags are correctly appended and that existing functionality
    remains stable.

## Implementation Plan

### Tasks

1. **Development Setup**
   - Configure and ensure development environment supports the new phase.
   - Update `tsconfig.json` as needed to accommodate potential new dependencies.
2. **Apply Configuration Changes**
   - Modify `parser-config.js` to include the `defaultReleaseTag` option.
   - Ensure the configuration is correctly loaded and accessible in `format.ts`.

3. **Modify Formatting Logic**
   - Update `format.ts` to detect missing release tags and append the default if
     necessary.
   - Use Prettier API for maintaining formatting standards when adding tags.

4. **Testing and Validation**
   - Implement unit tests verifying correct behavior with and without existing
     tags.
   - Write integration tests to ensure seamless operation with overall TSDoc
     formatting.
   - Ensure regression tests pass, maintaining overall project stability.

## Acceptance Criteria

- Successfully compiles via `npm run build`.
- All tests covering new logic pass, with no new errors introduced.
- Configuration changes do not impact existing users unless they opt into new
  options.

## Out-of-Scope

- Semantic validation of TSDoc content outside formatting requirements.
- Deprecation or removal of existing tag functionalities.

## Test Matrix

| Scenario                          | Expectation                                   |
| --------------------------------- | --------------------------------------------- |
| Existing release tag present      | No changes; original tag maintained           |
| Missing release tag               | `@internal` appended                          |
| Custom default tag defined        | Specified custom tag appended                 |
| Mixed existing and new tag config | No duplication; respects most restrictive tag |

## Migration Notes

This phase is additive and focuses on backward-compatible enhancement, ensuring
users can opt into new behavior by extending their configurations as needed.
