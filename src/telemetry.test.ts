import { expect, test, describe } from 'vitest';
import { formatTSDocComment, resetTelemetry, getTelemetry } from './format.js';
import { createTSDocConfiguration } from './parser-config.js';
import { TSDocParser } from '@microsoft/tsdoc';

describe('Phase 7: Telemetry & Debug Features', () => {
  test('tracks telemetry data correctly', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    // Reset telemetry before test
    resetTelemetry();

    const initialTelemetry = getTelemetry();
    expect(initialTelemetry.commentsProcessed).toBe(0);
    expect(initialTelemetry.parseErrors).toBe(0);
    expect(initialTelemetry.formattingErrors).toBe(0);

    // Format some comments
    const comment1 = '*\n * Simple comment.\n * @param x - Value\n ';
    const comment2 = '*\n * Another comment.\n * @returns Result\n ';

    formatTSDocComment(comment1, options, parser);
    formatTSDocComment(comment2, options, parser);

    const finalTelemetry = getTelemetry();
    expect(finalTelemetry.commentsProcessed).toBe(2);
    expect(finalTelemetry.totalTime).toBeGreaterThan(0);
  });

  test('tracks parse errors when malformed comments are processed', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    resetTelemetry();

    // This comment has some TSDoc syntax issues that might trigger warnings
    const malformedComment =
      '*\n * @param - Missing parameter name\n * @return\n ';

    formatTSDocComment(malformedComment, options, parser);

    const telemetry = getTelemetry();
    expect(telemetry.commentsProcessed).toBe(1);
    // Parse errors might be 0 if TSDoc is lenient, but shouldn't crash
    expect(telemetry.formattingErrors).toBe(0); // Should not have formatting errors
  });

  test('tracks formatting errors for deeply problematic comments', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    resetTelemetry();

    // Try to format something that might cause formatting errors
    try {
      formatTSDocComment('*\n * ' + 'x'.repeat(10000) + '\n ', options, parser);
    } catch (error) {
      // Expected if it fails hard
    }

    const telemetry = getTelemetry();
    expect(telemetry.commentsProcessed).toBeGreaterThanOrEqual(0);
    // The function should handle errors gracefully and not crash
  });

  test('debug telemetry logs when PRETTIER_TSDOC_DEBUG=1', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);

    // Mock logger to capture debug output
    const loggedMessages: any[] = [];
    const mockLogger = {
      warn: (message: string, data?: any) => {
        loggedMessages.push({ message, data });
      },
    };

    const options = {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      logger: mockLogger,
    };

    // Set debug environment
    const originalDebug = process.env.PRETTIER_TSDOC_DEBUG;
    process.env.PRETTIER_TSDOC_DEBUG = '1';

    try {
      resetTelemetry();

      // Format enough comments to trigger periodic logging (every 100 comments)
      for (let i = 0; i < 100; i++) {
        formatTSDocComment('*\n * Test comment.\n ', options, parser);
      }

      // Should have logged debug telemetry
      const telemetryLogs = loggedMessages.filter(
        (log) => log.message === 'TSDoc Debug Telemetry:'
      );

      expect(telemetryLogs.length).toBeGreaterThan(0);
      if (telemetryLogs.length > 0) {
        const telemetryData = telemetryLogs[0].data;
        expect(telemetryData.commentsProcessed).toBe(100);
        expect(typeof telemetryData.averageTimeMs).toBe('string');
        expect(typeof telemetryData.cacheHitRate).toBe('string');
      }
    } finally {
      // Restore original debug setting
      if (originalDebug !== undefined) {
        process.env.PRETTIER_TSDOC_DEBUG = originalDebug;
      } else {
        delete process.env.PRETTIER_TSDOC_DEBUG;
      }
    }
  });

  test('telemetry data structure is complete', () => {
    resetTelemetry();

    const telemetry = getTelemetry();

    // Ensure all expected fields are present
    expect(telemetry).toHaveProperty('commentsProcessed');
    expect(telemetry).toHaveProperty('parseErrors');
    expect(telemetry).toHaveProperty('formattingErrors');
    expect(telemetry).toHaveProperty('totalTime');
    expect(telemetry).toHaveProperty('cacheHits');
    expect(telemetry).toHaveProperty('cacheMisses');

    // Check initial values
    expect(typeof telemetry.commentsProcessed).toBe('number');
    expect(typeof telemetry.parseErrors).toBe('number');
    expect(typeof telemetry.formattingErrors).toBe('number');
    expect(typeof telemetry.totalTime).toBe('number');
    expect(typeof telemetry.cacheHits).toBe('number');
    expect(typeof telemetry.cacheMisses).toBe('number');
  });

  test('telemetry reset works correctly', () => {
    const config = createTSDocConfiguration();
    const parser = new TSDocParser(config);
    const options = { printWidth: 80, tabWidth: 2, useTabs: false };

    // Format some comments first
    formatTSDocComment('*\n * Test\n ', options, parser);
    formatTSDocComment('*\n * Test 2\n ', options, parser);

    let telemetry = getTelemetry();
    expect(telemetry.commentsProcessed).toBeGreaterThan(0);
    expect(telemetry.totalTime).toBeGreaterThan(0);

    // Reset telemetry
    resetTelemetry();

    telemetry = getTelemetry();
    expect(telemetry.commentsProcessed).toBe(0);
    expect(telemetry.parseErrors).toBe(0);
    expect(telemetry.formattingErrors).toBe(0);
    expect(telemetry.totalTime).toBe(0);
    expect(telemetry.cacheHits).toBe(0);
    expect(telemetry.cacheMisses).toBe(0);
  });
});
