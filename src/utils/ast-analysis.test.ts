import { expect, test, describe } from 'vitest';
import {
  analyzeCommentContext,
  shouldAddReleaseTag,
  type ExportAnalysis,
} from './ast-analysis.js';

describe('AST Analysis Utilities', () => {
  describe('analyzeCommentContext', () => {
    test('handles null comment path gracefully', () => {
      const result = analyzeCommentContext(null as any);
      
      expect(result).toEqual({
        isExported: false,
        exportType: 'none',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      });
    });

    test('handles comment path without parent', () => {
      const mockPath = {
        getValue: () => ({ type: 'Block', value: 'test' }),
        getParentNode: () => null,
      };

      const result = analyzeCommentContext(mockPath as any);
      
      expect(result.isExported).toBe(false);
      expect(result.exportType).toBe('none');
    });

    test('detects exported function declaration', () => {
      const mockPath = {
        getValue: () => ({ type: 'Block', value: 'test comment' }),
        getParentNode: () => ({
          type: 'ExportNamedDeclaration',
          declaration: {
            type: 'FunctionDeclaration',
            id: { name: 'testFunction' }
          }
        }),
      };

      const result = analyzeCommentContext(mockPath as any);
      
      expect(result.isExported).toBe(true);
      expect(result.exportType).toBe('named');
    });

    test('detects export default declaration', () => {
      const mockPath = {
        getValue: () => ({ type: 'Block', value: 'test comment' }),
        getParentNode: () => ({
          type: 'ExportDefaultDeclaration',
          declaration: {
            type: 'ClassDeclaration',
            id: { name: 'TestClass' }
          }
        }),
      };

      const result = analyzeCommentContext(mockPath as any);
      
      expect(result.isExported).toBe(true);
      expect(result.exportType).toBe('default');
    });

    test('detects non-exported declaration', () => {
      const mockPath = {
        getValue: () => ({ type: 'Block', value: 'test comment' }),
        getParentNode: () => ({
          type: 'FunctionDeclaration',
          id: { name: 'internalFunction' }
        }),
      };

      const result = analyzeCommentContext(mockPath as any);
      
      expect(result.isExported).toBe(false);
      expect(result.exportType).toBe('none');
    });

    test('handles AST analysis errors gracefully', () => {
      const mockPath = {
        getValue: () => ({ type: 'Block', value: 'test comment' }),
        getParentNode: () => {
          throw new Error('AST error');
        },
      };

      // Should not throw, should return default analysis
      const result = analyzeCommentContext(mockPath as any);
      
      expect(result).toEqual({
        isExported: false,
        exportType: 'none',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      });
    });
  });

  describe('shouldAddReleaseTag', () => {
    test('returns false when release tag already exists', () => {
      const analysis: ExportAnalysis = {
        isExported: true,
        exportType: 'named',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      };

      const result = shouldAddReleaseTag(analysis, true);
      expect(result).toBe(false);
    });

    test('returns false for non-exported declarations', () => {
      const analysis: ExportAnalysis = {
        isExported: false,
        exportType: 'none',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      };

      const result = shouldAddReleaseTag(analysis, false);
      expect(result).toBe(false);
    });

    test('returns false for container members that should inherit', () => {
      const analysis: ExportAnalysis = {
        isExported: true,
        exportType: 'named',
        isContainerMember: true,
        containerType: 'class',
        shouldInheritReleaseTag: true,
      };

      const result = shouldAddReleaseTag(analysis, false);
      expect(result).toBe(false);
    });

    test('returns true for exported top-level constructs without existing tags', () => {
      const analysis: ExportAnalysis = {
        isExported: true,
        exportType: 'named',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      };

      const result = shouldAddReleaseTag(analysis, false);
      expect(result).toBe(true);
    });

    test('returns true for export default declarations', () => {
      const analysis: ExportAnalysis = {
        isExported: true,
        exportType: 'default',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      };

      const result = shouldAddReleaseTag(analysis, false);
      expect(result).toBe(true);
    });

    test('returns true for namespace exports', () => {
      const analysis: ExportAnalysis = {
        isExported: true,
        exportType: 'namespace',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      };

      const result = shouldAddReleaseTag(analysis, false);
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('handles malformed AST nodes', () => {
      const mockPath = {
        getValue: () => ({}), // Missing properties
        getParentNode: () => ({}), // Missing type property
      };

      const result = analyzeCommentContext(mockPath as any);
      
      // Should return default analysis without throwing
      expect(result.isExported).toBe(false);
      expect(result.exportType).toBe('none');
    });

    test('handles circular or deeply nested structures', () => {
      const circularNode: any = { type: 'Program' };
      circularNode.parent = circularNode; // Create circular reference

      const mockPath = {
        getValue: () => ({ type: 'Block', value: 'test' }),
        getParentNode: () => circularNode,
      };

      // Should handle gracefully without infinite loops
      const result = analyzeCommentContext(mockPath as any);
      expect(result).toBeDefined();
    });

    test('handles undefined or null values in AST', () => {
      const mockPath = {
        getValue: () => null,
        getParentNode: () => undefined,
      };

      const result = analyzeCommentContext(mockPath as any);
      expect(result).toEqual({
        isExported: false,
        exportType: 'none',
        isContainerMember: false,
        shouldInheritReleaseTag: false,
      });
    });
  });
});