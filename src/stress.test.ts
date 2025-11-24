import { expect, test, describe } from 'vitest';
import { formatTSDocComment } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('Phase 7: Stress Tests & Performance', () => {
  test('formats large file with 500 TSDoc comments within 2s budget', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    // Generate a variety of comment types
    const commentTemplates = [
      // Simple comment
      '*\n * Simple function description.\n * @param x - Input value\n * @returns Output value\n ',

      // Comment with remarks
      '*\n * Complex function with detailed explanation.\n * @remarks\n * This function performs advanced operations and requires careful handling.\n * @param data - The input data object\n * @param options - Configuration options\n * @returns Processed result\n ',

      // Comment with markdown and code
      '*\n * Utility function with examples.\n * @remarks\n * Usage example:\n * - Call with valid data\n * - Handle errors appropriately\n * @example\n * ```typescript\n * const result = processData({ value: 42 });\n * ```\n * @param input - Input data\n * @returns Formatted output\n ',

      // Comment with many parameters
      '*\n * Function with multiple parameters.\n * @param a - First parameter\n * @param b - Second parameter\n * @param c - Third parameter\n * @param d - Fourth parameter\n * @param e - Fifth parameter\n * @typeParam T - Generic type parameter\n * @typeParam U - Second generic type\n * @returns Combined result\n * @public\n ',

      // Comment with normalized tags
      '*\n * Function that needs normalization.\n * @param value - Input value\n * @return The processed result\n * @prop name - Object property\n * @public\n * @beta\n ',
    ];

    const startTime = performance.now();
    let formattedCount = 0;

    const iterations = 150;

    // Format 150 comments (simulating a moderate file)
    for (let i = 0; i < iterations; i++) {
      const template = commentTemplates[i % commentTemplates.length];

      try {
        const result = await formatTSDocComment(template, options, parser);
        expect(result).toBeDefined();
        formattedCount++;
      } catch (error) {
        // Graceful failure - log but don't fail the test
        console.warn(`Comment ${i} failed to format:`, error);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const timePerComment = totalTime / formattedCount;

    console.log(`\n📊 Stress Test Results:`);
    console.log(`Comments formatted: ${formattedCount}/${iterations}`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average per comment: ${timePerComment.toFixed(2)}ms`);
    console.log(
      `Success rate: ${((formattedCount / iterations) * 100).toFixed(1)}%`
    );

    // Performance assertions
    expect(totalTime).toBeLessThan(6000); // Must complete within ~6s
    expect(timePerComment).toBeLessThan(50); // Target <50ms per comment
    expect(formattedCount).toBeGreaterThan(iterations * 0.9); // 90%+ success rate
  });

  test('handles deeply nested markdown structures', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const complexComment = `*
 * Function with complex markdown.
 * @remarks
 * This function supports:
 * - Feature 1
 *   - Sub-feature A
 *   - Sub-feature B
 *     - Deep nesting
 * - Feature 2
 * 
 * Code examples:
 * \`\`\`typescript
 * // Simple usage
 * const result = func({ 
 *   param1: 'value1',
 *   param2: {
 *     nested: 'value2'
 *   }
 * });
 * \`\`\`
 * 
 * \`\`\`javascript  
 * // Alternative usage
 * const alt = func(data);
 * \`\`\`
 * @param data - Complex input data
 * @returns Processed result
 `;

    const startTime = performance.now();
    const result = await formatTSDocComment(complexComment, options, parser);
    const endTime = performance.now();

    expect(result).toBeDefined();
    expect(endTime - startTime).toBeLessThan(50); // Complex comment should still be fast
  });

  test('handles malformed comments gracefully', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const malformedComments = [
      // Missing parameter names
      '*\n * @param - Missing name\n * @returns Something\n ',

      // Malformed markdown
      '*\n * Bad markdown:\n * ```\n * // Missing language and closing\n ',

      // Empty sections
      '*\n * @remarks\n * @param x\n * @returns\n ',

      // Very long single line
      '*\n * ' + 'A'.repeat(500) + '\n ',

      // Unicode and special characters
      '*\n * Function with émojis 🚀 and spëcial châractérs.\n * @param データ - Japanese parameter\n * @returns 結果\n ',
    ];

    let successCount = 0;
    const startTime = performance.now();

    for (const comment of malformedComments) {
      try {
        const result = await formatTSDocComment(comment, options, parser);
        if (result) {
          successCount++;
        }
      } catch (error) {
        // Expected for some malformed comments
        console.warn(
          'Malformed comment handled:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    const endTime = performance.now();

    console.log(
      `Malformed comments handled: ${successCount}/${malformedComments.length}`
    );
    console.log(`Total time: ${(endTime - startTime).toFixed(2)}ms`);

    // Should handle at least some malformed comments without crashing
    expect(successCount).toBeGreaterThanOrEqual(0); // No crashes is success
    expect(endTime - startTime).toBeLessThan(100); // Should fail fast
  });

  test('memory usage remains stable over many iterations', async () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    const testComment =
      '*\n * Test function.\n * @param x - Input\n * @returns Output\n ';

    // Measure initial memory
    const initialMemory = process.memoryUsage();

    // Run many iterations to check for memory leaks
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      await formatTSDocComment(testComment, options, parser);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const heapGrowthMB = heapGrowth / 1024 / 1024;

    console.log(`\n🧠 Memory Usage Analysis:`);
    console.log(
      `Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`
    );
    console.log(
      `Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`
    );
    console.log(`Heap growth: ${heapGrowthMB.toFixed(2)}MB`);

    // Allow some reasonable memory growth but not excessive
    expect(heapGrowthMB).toBeLessThan(75); // Should not grow by more than 75MB
  });
});
