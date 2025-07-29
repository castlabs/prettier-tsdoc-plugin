# Prettier Plugin for TSDoc

- [Prettier Plugin for TSDoc](#prettier-plugin-for-tsdoc)
  - [Features](#features)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Configuration Options](#configuration-options)
    - [Option Details](#option-details)
    - [Built-in Tag Normalizations](#built-in-tag-normalizations)
    - [Release Tags](#release-tags)
      - [AST-Aware Release Tag Insertion](#ast-aware-release-tag-insertion)
  - [Examples](#examples)
    - [Basic Usage](#basic-usage)
    - [With Fenced Code Blocks](#with-fenced-code-blocks)
    - [Release Tag Deduplication](#release-tag-deduplication)
    - [Parameter Alignment](#parameter-alignment)
  - [Performance and Debugging](#performance-and-debugging)
    - [Performance Characteristics](#performance-characteristics)
    - [Performance Tuning Tips](#performance-tuning-tips)
    - [Debug Mode](#debug-mode)
    - [Benchmarking](#benchmarking)
  - [Migration and Troubleshooting](#migration-and-troubleshooting)
    - [Migration Notes](#migration-notes)
    - [Common Issues](#common-issues)
      - [Comments not being formatted](#comments-not-being-formatted)
      - [Performance issues](#performance-issues)
      - [Unexpected tag changes](#unexpected-tag-changes)
      - [Release tags not being added](#release-tags-not-being-added)
    - [Configuration Validation](#configuration-validation)
  - [Development Status](#development-status)
  - [License](#license)
  <!--toc:end-->

A Prettier plugin that formats TSDoc comments consistently.

## Features

- **Structural Formatting**: Consistent leading `/**`, aligned `*`, controlled
  blank lines
- **Tag Normalization**: Normalize common tag spelling variants (e.g., `@return`
  → `@returns`)
- **Parameter Alignment**: Align parameter descriptions across `@param` tags
- **Tag Ordering**: Canonical ordering of TSDoc tags for improved readability
- **Example Formatting**: Automatic blank lines before `@example` tags
- **Markdown & Code Support**: Format markdown and fenced code blocks within
  comments
- **Release Tag Management**:
  - **AST-aware insertion**: Only add release tags to exported API constructs
  - **API Extractor compatible**: Follows inheritance rules for class/interface
    members
  - Automatic insertion of default release tags (`@internal` by default)
  - Deduplication of duplicate release tags (`@public`, `@beta`, etc.)
  - Preservation of existing release tags
- **Legacy Migration Support**: Automatic transformation of legacy Closure
  Compiler annotations to modern TSDoc syntax
- **Multi-language Code Formatting**: Enhanced support for TypeScript,
  JavaScript, HTML, CSS, and more
- **Performance Optimized**: Efficient parsing with telemetry and debug support
- **Highly Configurable**: 14+ configuration options via Prettier config
- **TypeDoc/AEDoc Compatible**: Support for extended tag sets beyond core TSDoc

## Installation

```bash
npm install prettier-tsdoc-plugin
```

## Usage

Add the plugin to your Prettier configuration:

```json
{
  "plugins": ["prettier-tsdoc-plugin"]
}
```

## Configuration Options

All options are configured under the `tsdoc` namespace in your Prettier
configuration:

```json
{
  "plugins": ["prettier-tsdoc-plugin"],
  "tsdoc": {
    "fencedIndent": "space",
    "normalizeTagOrder": true,
    "dedupeReleaseTags": true,
    "splitModifiers": true,
    "singleSentenceSummary": false,
    "alignParamTags": false,
    "defaultReleaseTag": "@internal",
    "onlyExportedAPI": true,
    "inheritanceAware": true,
    "closureCompilerCompat": true,
    "extraTags": [],
    "normalizeTags": {
      "@return": "@returns",
      "@prop": "@property"
    },
    "releaseTagStrategy": "keep-first"
  }
}
```

### Option Details

| Option                  | Type                            | Default        | Description                                                      |
| ----------------------- | ------------------------------- | -------------- | ---------------------------------------------------------------- |
| `fencedIndent`          | `"space"` \| `"none"`           | `"space"`      | Indentation style for fenced code blocks                         |
| `normalizeTagOrder`     | `boolean`                       | `true`         | Normalize tag order based on conventional patterns (see below)   |
| `dedupeReleaseTags`     | `boolean`                       | `true`         | Deduplicate release tags (`@public`, `@beta`, etc.)              |
| `splitModifiers`        | `boolean`                       | `true`         | Split modifiers to separate lines                                |
| `singleSentenceSummary` | `boolean`                       | `false`        | Enforce single sentence summaries                                |
| `alignParamTags`        | `boolean`                       | `false`        | Align parameter descriptions across @param tags                  |
| `defaultReleaseTag`     | `string` \| `null`              | `"@internal"`  | Default release tag when none exists (null to disable)           |
| `onlyExportedAPI`       | `boolean`                       | `true`         | Only add release tags to exported API constructs (AST-aware)     |
| `inheritanceAware`      | `boolean`                       | `true`         | Respect inheritance rules - skip tagging class/interface members |
| `closureCompilerCompat` | `boolean`                       | `true`         | Enable legacy Closure Compiler annotation transformations        |
| `extraTags`             | `string[]`                      | `[]`           | Additional custom tags to recognize                              |
| `normalizeTags`         | `Record<string, string>`        | `{}`           | Custom tag spelling normalizations                               |
| `releaseTagStrategy`    | `"keep-first"` \| `"keep-last"` | `"keep-first"` | Strategy for release tag deduplication                           |

### Built-in Tag Normalizations

The plugin includes these built-in normalizations:

- `@return` → `@returns`
- `@prop` → `@property`

You can add custom normalizations or override built-in ones using the
`normalizeTags` option.

### Tag Ordering

When `normalizeTagOrder` is enabled (default: `true`), TSDoc tags are reordered
into a canonical structure for improved readability:

#### Canonical Tag Order

1. **Input Parameters**: `@param` and `@typeParam` tags
2. **Output**: `@returns` tag
3. **Error Conditions**: `@throws` tags
4. **Deprecation Notices**: `@deprecated` tag
5. **Cross-references**: `@see` tags
6. **Release Tags**: `@public`, `@internal`, `@beta`, etc.
7. **Examples**: `@example` tags (always last, with automatic blank lines)

#### Example

**Before** (mixed order):

````typescript
/**
 * A complex function.
 * @see https://example.com
 * @beta
 * @throws {Error} If input is invalid
 * @returns The result
 * @param a The first number
 * @deprecated Use newFunction instead
 * @example
 * ```ts
 * complexFunction(1, 2);
 * ```
 */
````

**After** (canonical order):

````typescript
/**
 * A complex function.
 *
 * @param a - The first number
 * @returns The result
 * @throws {Error} If input is invalid
 * @deprecated Use newFunction instead
 * @see https://example.com
 * @beta
 *
 * @example
 * ```ts
 * complexFunction(1, 2);
 * ```
 */
````

**Note**: When `normalizeTagOrder` is `false`, the original tag order is
preserved as much as possible, though TSDoc's parsing structure may still impose
some organization.

### Release Tags

The following tags are considered release tags and can be deduplicated:

- `@public`
- `@beta`
- `@alpha`
- `@internal`
- `@experimental`

#### AST-Aware Release Tag Insertion

The plugin uses **AST analysis** to intelligently determine which comments need
release tags, following API Extractor conventions:

- **Only exported declarations** receive default release tags
- **Class/interface members inherit** from their container's release tag
- **Namespace members inherit** from the namespace's release tag
- **Non-exported code** remains untagged (not part of public API)

**Configuration Options:**

```json
{
  "tsdoc": {
    "defaultReleaseTag": "@internal", // Default tag to add
    "defaultReleaseTag": "@public", // Use @public instead
    "defaultReleaseTag": null // Disable feature
  }
}
```

**Example - AST-aware insertion for exported functions:**

**Input:**

```typescript
/**
 * Exported helper function.
 * @param value - Input value
 * @returns Processed value
 */
export function helper(value: string): string {
  return value.trim();
}

/**
 * Internal helper (not exported).
 * @param value - Input value
 */
function internal(value: string): void {
  console.log(value);
}
```

**Output:**

```typescript
/**
 * Exported helper function.
 * @internal
 * @param value - Input value
 * @returns Processed value
 */
export function helper(value: string): string {
  return value.trim();
}

/**
 * Internal helper (not exported).
 * @param value - Input value
 */
function internal(value: string): void {
  console.log(value);
}
```

**Example - Existing tags are preserved:**

**Input:**

```typescript
/**
 * Public API function.
 * @public
 * @param data - Input data
 */
function publicApi(data: any): void {}
```

**Output (no change):**

```typescript
/**
 * Public API function.
 * @public
 * @param data - Input data
 */
function publicApi(data: any): void {}
```

**Example - Inheritance rules (class members inherit from class):**

**Input:**

```typescript
/**
 * Widget class for the public API.
 * @public
 */
export class Widget {
  /**
   * Method that inherits @public from class.
   * @param value - Input value
   */
  process(value: string): void {
    // implementation
  }
}
```

**Output (no change - method inherits @public from class):**

```typescript
/**
 * Widget class for the public API.
 * @public
 */
export class Widget {
  /**
   * Method that inherits @public from class.
   * @param value - Input value
   */
  process(value: string): void {
    // implementation
  }
}
```

### Legacy Closure Compiler Support

**Phase 130 Feature** - The plugin provides automatic transformation of legacy
Google Closure Compiler annotations to modern TSDoc/JSDoc syntax, making it easy
to migrate older JavaScript codebases to modern tooling.

#### Configuration

```json
{
  "tsdoc": {
    "closureCompilerCompat": true // Default: true - enabled by default
  }
}
```

#### Supported Transformations

The plugin automatically modernizes the following legacy annotations:

##### 1. Visibility and Export Tags

- `@export` → `@public`
- `@protected` → `@internal`
- `@private` → `@internal`

##### 2. Typed Tags (Type Information Removal)

- `@param {type} name` → `@param name`
- `@throws {Error}` → `@throws` (when type is the only content)
- `@this {type}` → `@this`

##### 3. Class Heritage Tags (Complete Removal)

- `@extends {BaseClass}` → _(removed)_
- `@implements {IInterface}` → _(removed)_

**Note**: Only curly-brace syntax is removed. Modern TypeDoc overrides like
`@extends BaseClass` (without braces) are preserved.

##### 4. Redundant Language Tags (Complete Removal)

- `@constructor` → _(removed)_
- `@const` → _(removed)_
- `@define` → _(removed)_
- `@noalias` → _(removed)_
- `@nosideeffects` → _(removed)_

##### 5. @see Tag Normalization

- `@see http://example.com` → `@see {@link http://example.com}`
- `@see MyClass` → `@see {@link MyClass}` (code constructs only)
- `@see Also check the documentation` → _(unchanged - descriptive text
  preserved)_

#### Migration Examples

**Before (Legacy Closure Compiler):**

```typescript
/**
 * Creates a new widget with configuration.
 * @constructor
 * @param {string} id - The unique identifier for the widget.
 * @param {object} [options] - Configuration options.
 * @extends {BaseWidget}
 * @implements {IWidget}
 * @export
 * @see MyOtherClass
 * @see http://example.com/docs
 */
```

**After (Modern TSDoc):**

```typescript
/**
 * Creates a new widget with configuration.
 *
 * @param id - The unique identifier for the widget.
 * @param [options] - Configuration options.
 * @public
 * @see {@link MyOtherClass}
 * @see {@link http://example.com/docs}
 */
```

#### Smart Pattern Recognition

The transformation engine uses intelligent pattern recognition to avoid false
positives:

- **Code blocks are protected**: Transformations skip content inside ``` fenced
  blocks
- **Prose detection**: `@see First reference` is NOT transformed (common English
  words)
- **Code construct detection**: `@see MyClass` IS transformed (follows naming
  patterns)
- **Partial transformations**: `@throws {Error} When invalid` preserves the
  description

#### Integration with Other Features

Legacy transformations work seamlessly with all other plugin features:

- **Tag ordering**: Transformed tags participate in canonical ordering
- **Release tag deduplication**: Duplicate tags are removed after transformation
- **Parameter alignment**: Transformed `@param` tags align properly
- **Markdown formatting**: Content formatting applies after transformation

#### Disabling Legacy Support

To disable legacy transformations (e.g., for modern codebases):

```json
{
  "tsdoc": {
    "closureCompilerCompat": false
  }
}
```

#### Migration Workflow

1. **Enable the plugin** with default settings (`closureCompilerCompat: true`)
2. **Run Prettier** on your legacy codebase - transformations happen
   automatically
3. **Review changes** - the process is conservative and avoids false positives
4. **Commit transformed code** - all legacy annotations are now modern TSDoc
5. **Optional**: Disable `closureCompilerCompat` once migration is complete

## Examples

### Basic Usage

**Input:**

```typescript
/**
 * Calculate the sum of two numbers.
 * @param a - First number
 * @return Second number result
 */
function add(a: number, b: number): number {
  return a + b;
}
```

**Output:**

```typescript
/**
 * Calculate the sum of two numbers.
 * @param a - First number
 * @returns Second number result
 */
function add(a: number, b: number): number {
  return a + b;
}
```

### With Fenced Code Blocks

**Input:**

````typescript
/**
 * Process data with example:
 * ```typescript
 * const result=process({value:42});
 * ```
 */
function process(data: any): any {
  return data;
}
````

**Output:**

````typescript
/**
 * Process data with example:
 * ```typescript
 *  const result = process({ value: 42 });
 * ```
 */
function process(data: any): any {
  return data;
}
````

### Release Tag Deduplication

**Input:**

```typescript
/**
 * Internal function.
 * @public
 * @param x - Value
 * @public
 * @beta
 */
function internalFn(x: number): void {}
```

**Output (with `dedupeReleaseTags: true, releaseTagStrategy: "keep-first"`):**

```typescript
/**
 * Internal function.
 * @public
 * @param x - Value
 * @beta
 */
function internalFn(x: number): void {}
```

### Parameter Alignment

**With `alignParamTags: true`:**

**Input:**

```typescript
/**
 * Function with parameters.
 * @param shortName - Short description
 * @param veryLongParameterName - Long description that may wrap
 * @param id - ID value
 * @returns Result
 */
function example(
  shortName: string,
  veryLongParameterName: string,
  id: number
): string {
  return '';
}
```

**Output:**

```typescript
/**
 * Function with parameters.
 * @param shortName             - Short description
 * @param veryLongParameterName - Long description that may wrap
 * @param id                    - ID value
 * @returns Result
 */
function example(
  shortName: string,
  veryLongParameterName: string,
  id: number
): string {
  return '';
}
```

## Performance and Debugging

### Performance Characteristics

- **Small comments (< 100 chars)**: ~5ms average formatting time
- **Medium comments (100-500 chars)**: ~15-20ms average formatting time
- **Large comments (> 500 chars)**: ~40-50ms average formatting time
- **Memory usage**: Stable, no memory leaks detected
- **Cache efficiency**: Parser and configuration caching for optimal performance

### Performance Tuning Tips

1. **Use consistent configuration**: Avoid changing TSDoc options frequently to
   benefit from parser caching
2. **Limit custom tags**: Excessive `extraTags` can reduce parser cache
   efficiency
3. **Consider comment size**: Very large comments (> 1000 chars) may exceed 10ms
   formatting budget
4. **Enable markdown caching**: Repeated markdown/code blocks are automatically
   cached
5. **Monitor with debug mode**: Use `PRETTIER_TSDOC_DEBUG=1` to track
   performance metrics

### Debug Mode

Set the `PRETTIER_TSDOC_DEBUG=1` environment variable to enable debug telemetry:

```bash
PRETTIER_TSDOC_DEBUG=1 npx prettier --write "**/*.ts"
```

This will log performance metrics including:

- Comments processed count
- Parse error frequency
- Average formatting time per comment
- Cache hit rates
- Memory usage patterns

### Benchmarking

Run the included benchmarks to measure performance on your system:

```bash
npm run benchmark
```

## Building

This project uses Rollup to create a single bundled entry point. The build
process includes:

- **TypeScript compilation**: TypeScript is compiled to JavaScript with source
  maps
- **Bundling**: All source files are bundled into a single `dist/index.js` file
- **Source maps**: Generated for debugging support

### Build Scripts

```bash
# Build the plugin bundle
npm run build

# Type checking only (no JavaScript output)
npm run typecheck

# Run tests
npm test
```

The build output consists of:

- `dist/index.js` - Single bundled entry point
- `dist/index.js.map` - Source map for debugging

## Migration and Troubleshooting

### Migration Notes

The plugin is designed to be backward-compatible. New AST-aware features are
enabled by default:

- **AST-aware release tags**: Enabled by default (`onlyExportedAPI: true`). Set
  to `false` for legacy behavior.
- **Inheritance awareness**: Enabled by default (`inheritanceAware: true`). Set
  to `false` to tag all constructs.
- **Default release tags**: Enabled by default with `@internal`. Set to `null`
  to disable.
- **Parameter alignment**: Disabled by default. Set `alignParamTags: true` to
  enable.
- **Tag normalization**: Only built-in normalizations (`@return` → `@returns`)
  are applied by default.

### Common Issues

#### Comments not being formatted

1. **Check comment syntax**: Only `/** */` comments are processed, not `/* */`
   or `//`
2. **Check debug output**: Use `PRETTIER_TSDOC_DEBUG=1` to see which comments
   are being processed

#### Performance issues

1. **Large files**: Comments > 1000 characters may take longer to format
2. **Custom tags**: Excessive `extraTags` can impact performance
3. **Debug mode**: Use `PRETTIER_TSDOC_DEBUG=1` to identify slow comments

#### Unexpected tag changes

1. **Tag normalization**: Built-in normalizations are applied by default
2. **Legacy Closure Compiler transformations**: Enabled by default
   (`closureCompilerCompat: true`)
3. **AST-aware release tag insertion**: Only exported declarations get default
   tags
4. **Inheritance rules**: Class/interface members inherit from container
5. **Custom normalizations**: Check your `normalizeTags` configuration

#### Release tags not being added

1. **Check export status**: Only exported declarations get default tags with
   `onlyExportedAPI: true`
2. **Check inheritance**: Class members inherit from class release tag
3. **Disable AST analysis**: Set `onlyExportedAPI: false` for legacy behavior
4. **Debug AST analysis**: Use `PRETTIER_TSDOC_DEBUG=1` to see analysis results

### Configuration Validation

To validate your configuration, use this TypeScript interface:

```typescript
interface TSDocPluginOptions {
  fencedIndent?: 'space' | 'none';
  normalizeTagOrder?: boolean;
  dedupeReleaseTags?: boolean;
  splitModifiers?: boolean;
  singleSentenceSummary?: boolean;
  alignParamTags?: boolean;
  defaultReleaseTag?: string | null;
  onlyExportedAPI?: boolean;
  inheritanceAware?: boolean;
  closureCompilerCompat?: boolean;
  extraTags?: string[];
  normalizeTags?: Record<string, string>;
  releaseTagStrategy?: 'keep-first' | 'keep-last';
}
```

## Development Status

Phase 130 (Legacy Closure Compiler Support) - ✅ COMPLETED

All phases of the implementation plan have been completed successfully:

- ✅ Phase 1: Bootstrap
- ✅ Phase 2: Parser Detection
- ✅ Phase 3: Summary & Remarks
- ✅ Phase 4: Tags & Alignment
- ✅ Phase 5: Markdown & Codeblocks
- ✅ Phase 6: Configuration & Normalization
- ✅ Phase 7: Edge Cases & Performance
- ✅ Phase 8: Release Tags
- ✅ Phase 110: Newline and Tag Management
- ✅ Phase 130: Legacy Closure Compiler Support

See [agents/context.md](./agents/context.md) for the detailed specification.

## License

MIT
