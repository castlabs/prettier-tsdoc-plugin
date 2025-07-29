# Phase 120: Plugin Architecture Refactor

**Status**: ✅ COMPLETED

**Priority:** Critical - Required for test fixes and proper TSDoc formatting  
**Dependencies:** Phases 1-110 (formatting logic is sound)

---

## Problem Analysis

The current plugin implementation fails because:

1. **Incorrect Plugin Structure**: Using `printComment` without proper printer
   inheritance
2. **Missing AST Context**: Cannot detect exported constructs for release tag
   logic
3. **Hook Not Triggering**: Prettier isn't calling our formatting code
4. **Architecture Mismatch**: Fighting against Prettier's design instead of
   working with it

---

## Prettier Plugin Architecture Analysis

Based on <https://prettier.io/docs/plugins>, here's how Prettier plugins should
work:

### Core Components

1. **Parsers**: Convert source text → AST
   - `parse(text, options)`: Main parsing function
   - `preprocess(text, options)`: Optional text preprocessing
   - `astFormat`: Specifies AST format name
   - `locStart/locEnd`: Extract node positions

2. **Printers**: Convert AST → Formatted Doc
   - `print(path, options, print)`: Main printing function
   - `printComment(commentPath, options)`: Comment-specific formatting
   - Works with existing AST structures

3. **Languages**: Define file type support
   - Associates file extensions with parsers
   - Can extend existing language support

### Key Insight: Plugin Extension Strategy

Prettier plugins can **extend existing parsers** rather than replace them:

```javascript
// Correct approach: Extend existing TypeScript parser
const plugin = {
  parsers: {
    typescript: {
      ...originalTypescriptParser,
      preprocess: customPreprocess, // Add custom preprocessing
    },
  },
  printers: {
    estree: {
      ...originalEstreePrinter,
      printComment: customPrintComment, // Override comment printing
    },
  },
};
```

---

## Proposed Architecture

### Parser Extension with Preprocess (Recommended)

**Approach**: Extend existing TypeScript/JavaScript parsers with custom
preprocessing

**Advantages**:

- ✅ Full AST access for export detection
- ✅ Source position preservation
- ✅ Works with existing Prettier infrastructure
- ✅ Can detect declaration context (exported/non-exported)

**Implementation**:

```javascript
const plugin = {
  parsers: {
    typescript: {
      ...parserTypescript.parsers.typescript,
      preprocess: (text, options) => {
        // Parse and analyze AST to find TSDoc comments
        // Extract export context information
        // Transform TSDoc comments in place
        // Return modified source with formatted comments
        return transformedText;
      },
    },
    babel: {
      ...parserBabel.parsers.babel,
      preprocess: (text, options) => {
        // Same logic for JavaScript
        return transformedText;
      },
    },
  },
};
```

**Preprocess Strategy**:

1. **Parse with TypeScript compiler API** to get full AST
2. **Identify TSDoc comments** and their associated declarations
3. **Extract export context** (exported/non-exported, class members, etc.)
4. **Format TSDoc comments** using existing formatting logic
5. **Replace comments in source** while preserving positions
6. **Return modified source** for normal Prettier processing

---

## Detailed Implementation Plan

### Phase 1: AST-Aware Preprocessing

1. **Create AST Analyzer**:

   ```typescript
   interface CommentContext {
     comment: Comment;
     declaration: Declaration | null;
     isExported: boolean;
     isClassMember: boolean;
     container: ClassDeclaration | InterfaceDeclaration | null;
   }

   function analyzeSourceForTSDoc(sourceText: string): CommentContext[];
   ```

2. **Implement Export Detection**:
   - Use TypeScript compiler API for accurate AST parsing
   - Detect `export` keywords and declarations
   - Handle class/interface member inheritance
   - Map comments to their associated declarations

3. **Position-Preserving Comment Replacement**:
   - Calculate exact comment positions
   - Format comments using existing logic
   - Replace in source while maintaining line/column positions
   - Ensure no syntax corruption

### Phase 2: Parser Extension

1. **Extend TypeScript Parser**:

   ```typescript
   const plugin = {
     parsers: {
       typescript: {
         ...parserTypescript.parsers.typescript,
         preprocess: preprocessTypescript,
       },
       babel: {
         ...parserBabel.parsers.babel,
         preprocess: preprocessJavaScript,
       },
     },
   };
   ```

2. **Implement Preprocessing Logic**:

   ```typescript
   function preprocessTypescript(text: string, options: any): string {
     // 1. Parse with TypeScript compiler
     // 2. Find all TSDoc comments
     // 3. Analyze export context
     // 4. Format comments with context
     // 5. Replace in source
     // 6. Return modified text
   }
   ```

### Phase 3: Integration Testing

1. **Ensure Test Compatibility**:
   - All existing tests should pass
   - `normalizeTagOrder: true` behavior works
   - Blank lines added correctly
   - Export detection works properly

2. **Validate Source Preservation**:
   - No syntax errors introduced
   - Line numbers preserved for debugging
   - TypeScript compilation still works

---

## Risk Analysis

### High Risk Items

1. **TypeScript Compiler API Complexity**:
   - **Risk**: Difficult integration with different TS versions
   - **Mitigation**: Use stable API subset, version constraints

2. **Position Calculation Errors**:
   - **Risk**: Incorrect replacements breaking syntax
   - **Mitigation**: Extensive testing, position validation

3. **Performance Impact**:
   - **Risk**: Double parsing (TS compiler + Prettier)
   - **Mitigation**: Caching, lazy evaluation

### Medium Risk Items

1. **Source Map Compatibility**:
   - **Risk**: Breaking source maps with text modifications
   - **Mitigation**: Document limitations, preserve mappings where possible

2. **Edge Case Handling**:
   - **Risk**: Complex nested structures (namespaces, modules)
   - **Mitigation**: Comprehensive test suite

---

## Success Criteria

1. ✅ All existing tests pass
2. ✅ `normalizeTagOrder: true` adds blank lines correctly
3. ✅ Export detection works for release tags
4. ✅ No TypeScript syntax errors introduced
5. ✅ Performance acceptable (< 2x slowdown)
6. ✅ Works with different TypeScript versions
7. ✅ Source positions preserved for debugging

---

## Implementation Priority

1. **Phase 1 (Critical)**: AST analyzer and export detection
2. **Phase 2 (Critical)**: Parser extension with preprocessing
3. **Phase 3 (High)**: Test integration and validation
4. **Phase 4 (Medium)**: Performance optimization
5. **Phase 5 (Low)**: Edge case handling and documentation

---

## Alternative Considerations

If the preprocessing approach proves too complex, we have fallback options:

1. **Hybrid Approach**: Use preprocessing for export detection, printer
   extension for formatting
2. **External Tool**: Separate CLI tool that runs before Prettier
3. **VS Code Extension**: Editor-specific implementation

However, the preprocessing approach is most likely to succeed given Prettier's
architecture and our requirements.
