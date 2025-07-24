/**
 * Performance benchmarks for TSDoc comment formatting
 */

import { Bench } from 'tinybench';
import { TSDocParser } from '@microsoft/tsdoc';
import { createTSDocConfiguration } from '../dist/parser-config.js';
import { formatTSDocComment } from '../dist/format.js';

// Initialize parser once for reuse
const config = createTSDocConfiguration();
const parser = new TSDocParser(config);
const options = { printWidth: 80, tabWidth: 2, useTabs: false };

// Generate test comments of varying sizes
function generateComment(size) {
  const lines = [];
  lines.push('/**');
  lines.push(' * ' + 'A'.repeat(Math.min(size, 60))); // Summary
  
  if (size > 100) {
    lines.push(' * @remarks');
    lines.push(' * ' + 'B'.repeat(Math.min(size - 100, 200))); // Remarks
  }
  
  // Add parameters based on size
  const paramCount = Math.min(Math.floor(size / 50), 10);
  for (let i = 0; i < paramCount; i++) {
    lines.push(` * @param param${i} - ${'C'.repeat(Math.min(size / 10, 40))}`);
  }
  
  if (size > 200) {
    lines.push(' * @returns ' + 'D'.repeat(Math.min(size / 5, 80)));
  }
  
  if (size > 300) {
    lines.push(' * @public');
    lines.push(' * @example');
    lines.push(' * ```typescript');
    lines.push(' * const x = ' + 'E'.repeat(Math.min(size / 20, 30)) + ';');
    lines.push(' * ```');
  }
  
  lines.push(' */');
  return lines.join('\n').slice(3, -2); // Remove /** and */ for the formatter
}

// Test data sets
const smallComment = generateComment(50);
const mediumComment = generateComment(200);
const largeComment = generateComment(500);
const xlargeComment = generateComment(1000);

const bench = new Bench({ time: 1000 });

bench
  .add('Small comment (50 chars)', () => {
    formatTSDocComment(smallComment, options, parser);
  })
  .add('Medium comment (200 chars)', () => {
    formatTSDocComment(mediumComment, options, parser);
  })
  .add('Large comment (500 chars)', () => {
    formatTSDocComment(largeComment, options, parser);
  })
  .add('X-Large comment (1000 chars)', () => {
    formatTSDocComment(xlargeComment, options, parser);
  })
  .add('Batch of 10 medium comments', () => {
    for (let i = 0; i < 10; i++) {
      formatTSDocComment(mediumComment, options, parser);
    }
  });

console.log('🚀 Running TSDoc formatting performance benchmarks...\n');

await bench.run();

console.table(bench.table());

// Memory usage reporting
const memUsage = process.memoryUsage();
console.log('\n📊 Memory Usage:');
console.log(`RSS: ${Math.round(memUsage.rss / 1024 / 1024)} MB`);
console.log(`Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`);
console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`);

// Performance analysis
const results = bench.tasks.map(task => ({
  name: task.name,
  avgTime: task.result?.mean || 0,
  opsPerSec: task.result?.hz || 0
}));

console.log('\n📈 Performance Analysis:');
results.forEach(result => {
  const avgTimeMs = result.avgTime * 1000;
  const status = avgTimeMs < 10 ? '✅' : avgTimeMs < 50 ? '⚠️' : '❌';
  console.log(`${status} ${result.name}: ${avgTimeMs.toFixed(2)}ms avg (${Math.round(result.opsPerSec)} ops/sec)`);
});

const maxTime = Math.max(...results.map(r => r.avgTime * 1000));
if (maxTime < 10) {
  console.log('\n🎉 All benchmarks meet <10ms target!');
} else {
  console.log(`\n⚠️  Some benchmarks exceed 10ms target (max: ${maxTime.toFixed(2)}ms)`);
}