# Prettier Plugin for TSDoc

A Prettier plugin that formats TSDoc comments consistently.

## Features

- **Structural Formatting**: Consistent leading `/**`, aligned `*`, controlled blank lines
- **Tag Normalization**: Normalize common tag spelling variants (e.g., `@return` → `@returns`)
- **Parameter Alignment**: Align parameter tags with consistent hyphen rules
- **Markdown & Code Support**: Format markdown and fenced code blocks within comments
- **Release Tag Deduplication**: Remove duplicate release tags (`@public`, `@beta`, etc.)
- **Configurable Options**: Extensive configuration options via Prettier config

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

All options are configured under the `tsdoc` namespace in your Prettier configuration:

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fencedIndent` | `"space"` \| `"none"` | `"space"` | Indentation style for fenced code blocks |
| `forceFormatTSDoc` | `boolean` | `false` | Force format all `/** */` comments as TSDoc |
| `normalizeTagOrder` | `boolean` | `false` | Normalize tag order based on conventional patterns |
| `dedupeReleaseTags` | `boolean` | `true` | Deduplicate release tags (`@public`, `@beta`, etc.) |
| `splitModifiers` | `boolean` | `true` | Split modifiers to separate lines |
| `singleSentenceSummary` | `boolean` | `false` | Enforce single sentence summaries |
| `extraTags` | `string[]` | `[]` | Additional custom tags to recognize |
| `normalizeTags` | `Record<string, string>` | `{}` | Custom tag spelling normalizations |
| `releaseTagStrategy` | `"keep-first"` \| `"keep-last"` | `"keep-first"` | Strategy for release tag deduplication |

### Built-in Tag Normalizations

The plugin includes these built-in normalizations:

- `@return` → `@returns`
- `@prop` → `@property`

You can add custom normalizations or override built-in ones using the `normalizeTags` option.

### Release Tags

The following tags are considered release tags and can be deduplicated:

- `@public`
- `@beta`
- `@alpha`
- `@internal`
- `@experimental`

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
```typescript
/**
 * Process data with example:
 * ```typescript
 * const result=process({value:42});
 * ```
 */
function process(data: any): any {
  return data;
}
```

**Output:**
```typescript
/**
 * Process data with example:
 * ```typescript
 *  const result = process({ value: 42 });
 * ```
 */
function process(data: any): any {
  return data;
}
```

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

## Development Status

Phase 6 (Configuration & Normalization) - ✅ COMPLETED

See [agents/context.md](./agents/context.md) for the detailed specification.

## License

MIT