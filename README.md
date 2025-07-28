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
- **Markdown & Code Support**: Format markdown and fenced code blocks within
  comments
- **Release Tag Management**:
  - **AST-aware insertion**: Only add release tags to exported API constructs
  - **API Extractor compatible**: Follows inheritance rules for class/interface
    members
  - Automatic insertion of default release tags (`@internal` by default)
  - Deduplication of duplicate release tags (`@public`, `@beta`, etc.)
  - Preservation of existing release tags
- **Multi-language Code Formatting**: Enhanced support for TypeScript,
  JavaScript, HTML, CSS, and more
- **Performance Optimized**: Efficient parsing with telemetry and debug support
- **Highly Configurable**: 13+ configuration options via Prettier config
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
    "forceFormatTSDoc": false,
    "normalizeTagOrder": false,
    "dedupeReleaseTags": true,
    "splitModifiers": true,
    "singleSentenceSummary": false,
    "alignParamTags": false,
    "defaultReleaseTag": "@internal",
    "onlyExportedAPI": true,
    "inheritanceAware": true,
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
| `forceFormatTSDoc`      | `boolean`                       | `false`        | Force format all `/** */` comments as TSDoc                      |
| `normalizeTagOrder`     | `boolean`                       | `false`        | Normalize tag order based on conventional patterns               |
| `dedupeReleaseTags`     | `boolean`                       | `true`         | Deduplicate release tags (`@public`, `@beta`, etc.)              |
| `splitModifiers`        | `boolean`                       | `true`         | Split modifiers to separate lines                                |
| `singleSentenceSummary` | `boolean`                       | `false`        | Enforce single sentence summaries                                |
| `alignParamTags`        | `boolean`                       | `false`        | Align parameter descriptions across @param tags                  |
| `defaultReleaseTag`     | `string` \| `null`              | `"@internal"`  | Default release tag when none exists (null to disable)           |
| `onlyExportedAPI`       | `boolean`                       | `true`         | Only add release tags to exported API constructs (AST-aware)     |
| `inheritanceAware`      | `boolean`                       | `true`         | Respect inheritance rules - skip tagging class/interface members |
| `extraTags`             | `string[]`                      | `[]`           | Additional custom tags to recognize                              |
| `normalizeTags`         | `Record<string, string>`        | `{}`           | Custom tag spelling normalizations                               |
| `releaseTagStrategy`    | `"keep-first"` \| `"keep-last"` | `"keep-first"` | Strategy for release tag deduplication                           |

### Built-in Tag Normalizations

The plugin includes these built-in normalizations:

- `@return` → `@returns`
- `@prop` → `@property`

You can add custom normalizations or override built-in ones using the
`normalizeTags` option.

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
2. **Enable force formatting**: Set `forceFormatTSDoc: true` to format all
   `/** */` comments
3. **Check debug output**: Use `PRETTIER_TSDOC_DEBUG=1` to see which comments
   are being processed

#### Performance issues

1. **Large files**: Comments > 1000 characters may take longer to format
2. **Custom tags**: Excessive `extraTags` can impact performance
3. **Debug mode**: Use `PRETTIER_TSDOC_DEBUG=1` to identify slow comments

#### Unexpected tag changes

1. **Tag normalization**: Built-in normalizations are applied by default
2. **AST-aware release tag insertion**: Only exported declarations get default
   tags
3. **Inheritance rules**: Class/interface members inherit from container
4. **Custom normalizations**: Check your `normalizeTags` configuration

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
  forceFormatTSDoc?: boolean;
  normalizeTagOrder?: boolean;
  dedupeReleaseTags?: boolean;
  splitModifiers?: boolean;
  singleSentenceSummary?: boolean;
  alignParamTags?: boolean;
  defaultReleaseTag?: string | null;
  onlyExportedAPI?: boolean;
  inheritanceAware?: boolean;
  extraTags?: string[];
  normalizeTags?: Record<string, string>;
  releaseTagStrategy?: 'keep-first' | 'keep-last';
}
```

## Development Status

Phase 8 (Release Tags) - ✅ COMPLETED

All 8 phases of the implementation plan have been completed successfully:

- ✅ Phase 1: Bootstrap
- ✅ Phase 2: Parser Detection
- ✅ Phase 3: Summary & Remarks
- ✅ Phase 4: Tags & Alignment
- ✅ Phase 5: Markdown & Codeblocks
- ✅ Phase 6: Configuration & Normalization
- ✅ Phase 7: Edge Cases & Performance
- ✅ Phase 8: Release Tags

See [agents/context.md](./agents/context.md) for the detailed specification.

## License

MIT
