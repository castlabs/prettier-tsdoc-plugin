# Phase 080 – Release Tags

## Status: 🔄 ENHANCED (AST-Aware Implementation)

## Goal

Ensure that **exported API constructs** in TSDoc comments are annotated with a
release tag for API Extractor compatibility. Automatically detect exported
declarations and apply default release tags only where required, avoiding
over-annotation of internal code.

## Planning and Design

### API Extractor Requirements (Research Summary)

Based on comprehensive API Extractor documentation research:

- **Required Scope**: Release tags are required for **exported API items** only:
  - Classes, functions, interfaces, enums, types, variables
  - Namespace members (inherit from namespace)
  - **NOT** required for class/interface members (inherit from container)
  - **NOT** required for non-exported internal code

- **Tag Inheritance**: 
  - Release tags apply recursively to container members
  - Class members inherit from class release tag
  - Namespace members inherit from namespace release tag
  - Only the "outermost container" needs explicit tagging

- **Validation Rules**:
  - API Extractor reports `ae-missing-release-tag` for exported items without tags
  - Logical compatibility rules apply (e.g., `@public` function can't return `@beta` type)

### AST-Aware Detection Strategy

- **Integration Point**: Enhance `format.ts` to analyze TypeScript AST context
- **Export Detection**: Identify `export` keywords, `export default`, re-exports
- **Container Analysis**: Detect if comment belongs to class member vs top-level construct
- **Namespace Handling**: Apply inheritance rules for namespace members

### Enhanced Configuration Options

- **`defaultReleaseTag`**: Default tag for exported constructs (`@internal`)
- **`onlyExportedAPI`**: Enable AST-aware detection (default: `true`)
- **`inheritanceAware`**: Skip tagging when inheritance applies (default: `true`)

### Parsing Logic Enhancement

1. **Comment Context Analysis**: 
   - Parse following AST node to determine construct type
   - Check for export keywords and declaration patterns
   - Identify parent containers (classes, namespaces)

2. **Smart Tag Application**:
   - Apply default tag only to exported top-level constructs
   - Skip class/interface members (inherit from container)
   - Respect existing release tags completely
   - Handle namespace member inheritance

3. **Edge Case Handling**:
   - `export default` declarations
   - Re-exports (`export { foo } from './module'`)
   - Overloaded functions
   - Ambient declarations

## Implementation Plan

### Enhanced Tasks

1. **AST Context Access**
   - Investigate Prettier plugin context to access parent AST nodes
   - Research comment-to-declaration mapping in Prettier's architecture
   - Implement helper functions to analyze TypeScript AST patterns

2. **Export Detection Module**
   - Create `src/utils/ast-analysis.ts` for AST pattern detection
   - Implement `isExportedDeclaration()` function
   - Handle all export variants: `export`, `export default`, re-exports
   - Detect declaration types: function, class, interface, enum, type, variable

3. **Container Analysis Module**
   - Implement `isClassMember()` detection
   - Implement `isNamespaceMember()` detection
   - Create inheritance chain analysis
   - Handle nested namespace scenarios

4. **Enhanced Configuration**
   - Add `onlyExportedAPI: boolean` option (default: `true`)
   - Add `inheritanceAware: boolean` option (default: `true`)
   - Update configuration types and validation
   - Maintain backward compatibility

5. **Smart Tag Application Logic**
   - Enhance `format.ts` with AST-aware context analysis
   - Implement decision tree for tag application
   - Create comprehensive logging for debugging
   - Ensure performance optimization

6. **Comprehensive Testing Strategy**
   - **Unit Tests**: AST detection functions with mock nodes
   - **Integration Tests**: Real TypeScript code scenarios
   - **Edge Case Tests**: Complex export patterns
   - **Performance Tests**: Large file handling
   - **Regression Tests**: Backward compatibility

## Enhanced Acceptance Criteria

### Functionality Requirements
- **Export Detection**: Only exported declarations receive default release tags
- **Container Inheritance**: Class/interface members are skipped (inherit from container)
- **Namespace Handling**: Namespace members inherit from namespace tag
- **Backward Compatibility**: Existing configurations work unchanged
- **Performance**: No significant performance degradation for AST analysis

### Quality Gates
- Successfully compiles via `npm run build`
- All existing tests continue to pass
- New AST-aware tests achieve >95% coverage
- Performance tests show <10ms overhead for AST analysis
- Integration tests cover all API Extractor scenarios

## Enhanced Test Matrix

### Core Scenarios
| Scenario | Input | Expected Behavior |
|----------|--------|------------------|
| **Exported function without tag** | `export function foo() {}` | Add `@internal` tag |
| **Non-exported function** | `function internal() {}` | No tag added |
| **Class with existing tag** | `/** @public */ export class Foo {}` | Preserve existing tag |
| **Class method** | Method inside `@public` class | No tag added (inherits) |
| **Interface member** | Property in `@beta` interface | No tag added (inherits) |
| **Namespace member** | `export namespace N { export function f() {} }` | Inherits from namespace |
| **Export default** | `export default class Widget {}` | Add default tag |
| **Re-export** | `export { Widget } from './widget'` | Skip (no local declaration) |

### Edge Cases
| Scenario | Expected Behavior |
|----------|------------------|
| **Function overloads** | Tag only the implementation |
| **Ambient declarations** | Skip (`.d.ts` context) |
| **Generic constraints** | Handle type parameters correctly |
| **Nested classes** | Detect export context properly |

### Configuration Scenarios
| Config | Behavior |
|--------|----------|
| `onlyExportedAPI: false` | Fallback to current behavior (tag everything) |
| `inheritanceAware: false` | Tag all declarations regardless of container |
| `defaultReleaseTag: null` | Disable automatic tagging |
| `defaultReleaseTag: "@public"` | Use custom default tag |

## Migration & Compatibility Notes

### Breaking Changes
- **Default behavior change**: New installations will use AST-aware detection
- **Existing users**: Behavior changes only if they update configuration

### Migration Path
1. **Current users**: No immediate changes - existing behavior preserved
2. **New feature adoption**: Users can enable via configuration
3. **Gradual migration**: Option to disable AST-awareness for gradual transition

### Backward Compatibility
- All existing configuration options remain functional
- Existing `defaultReleaseTag` behavior maintained when AST detection disabled
- Performance characteristics maintained for non-AST mode
