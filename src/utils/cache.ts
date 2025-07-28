/**
 * Performance optimization utilities with enhanced caching
 */

import type { TSDocParser } from '@microsoft/tsdoc';
import type { CacheEntry } from '../types.js';
import { PERFORMANCE, FORMATTING } from '../constants.js';
import { createCacheKey, isDebugEnabled } from './common.js';

/**
 * Generic LRU cache implementation
 */
class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(
    maxSize: number = PERFORMANCE.MAX_PARSER_CACHE_SIZE,
    ttl: number = PERFORMANCE.PARSER_CACHE_TTL
  ) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V, customTtl?: number): void {
    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
      ttl: customTtl || this.ttl,
    };

    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, entry);
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean up expired entries before returning size
    this.cleanupExpired();
    return this.cache.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const toDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    expiredEntries: number;
  } {
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses separately
      expiredEntries: expiredCount,
    };
  }
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

/**
 * Enhanced parser cache with statistics
 */
class ParserCache {
  private cache = new LRUCache<string, TSDocParser>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
  };

  get(extraTags: string[] = []): TSDocParser | undefined {
    const key = createCacheKey(extraTags);
    const result = this.cache.get(key);

    if (result) {
      this.stats.hits++;
      if (isDebugEnabled()) {
        console.debug(`[TSDoc Cache] Hit for key: ${key}`);
      }
    } else {
      this.stats.misses++;
      if (isDebugEnabled()) {
        console.debug(`[TSDoc Cache] Miss for key: ${key}`);
      }
    }

    this.stats.size = this.cache.size();
    return result;
  }

  set(extraTags: string[], parser: TSDocParser): void {
    const key = createCacheKey(extraTags);
    this.cache.set(key, parser);
    this.stats.sets++;
    this.stats.size = this.cache.size();

    if (isDebugEnabled()) {
      console.debug(`[TSDoc Cache] Set for key: ${key}`);
    }
  }

  has(extraTags: string[]): boolean {
    const key = createCacheKey(extraTags);
    return this.cache.has(key);
  }

  delete(extraTags: string[]): boolean {
    const key = createCacheKey(extraTags);
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.cache.size();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
    };
  }

  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate,
    };
  }

  /**
   * Get detailed cache information for debugging
   */
  getDetailedStats(): CacheStats & {
    hitRate: number;
    cacheDetails: ReturnType<LRUCache<string, TSDocParser>['getStats']>;
  } {
    return {
      ...this.getStats(),
      cacheDetails: this.cache.getStats(),
    };
  }
}

/**
 * Global parser cache instance
 */
export const parserCache = new ParserCache();

/**
 * Compiled regex patterns for performance
 */
class RegexCache {
  private static instance: RegexCache;
  private patterns = new Map<string, RegExp>();

  static getInstance(): RegexCache {
    if (!RegexCache.instance) {
      RegexCache.instance = new RegexCache();
    }
    return RegexCache.instance;
  }

  private constructor() {
    // Pre-compile common patterns
    this.patterns.set('tsdocComment', FORMATTING.PATTERNS.TSDOC_COMMENT);
    this.patterns.set('leadingAsterisk', FORMATTING.PATTERNS.LEADING_ASTERISK);
    this.patterns.set('multipleSpaces', FORMATTING.PATTERNS.MULTIPLE_SPACES);
    this.patterns.set(
      'trailingWhitespace',
      FORMATTING.PATTERNS.TRAILING_WHITESPACE
    );
    this.patterns.set('blankLines', FORMATTING.PATTERNS.BLANK_LINES);
  }

  get(name: string): RegExp | undefined {
    return this.patterns.get(name);
  }

  set(name: string, pattern: RegExp): void {
    this.patterns.set(name, pattern);
  }

  compile(name: string, source: string, flags?: string): RegExp {
    if (this.patterns.has(name)) {
      return this.patterns.get(name)!;
    }

    const regex = new RegExp(source, flags);
    this.patterns.set(name, regex);
    return regex;
  }

  clear(): void {
    this.patterns.clear();
  }

  size(): number {
    return this.patterns.size;
  }
}

/**
 * Global regex cache instance
 */
export const regexCache = RegexCache.getInstance();

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  private static counters = new Map<string, number>();
  private static measurements = new Map<string, number[]>();

  static startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  static endTimer(name: string): number {
    const start = this.timers.get(name);
    if (!start) {
      console.warn(`[TSDoc Perf] Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - start;
    this.timers.delete(name);

    // Store measurement for statistics
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    if (isDebugEnabled()) {
      console.debug(`[TSDoc Perf] ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  static increment(name: string, amount: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + amount);
  }

  static getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  static getTimerStats(name: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const total = measurements.reduce((sum, duration) => sum + duration, 0);
    const average = total / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return {
      count: measurements.length,
      total,
      average,
      min,
      max,
    };
  }

  static getAllStats(): Record<string, any> {
    const timerStats: Record<string, any> = {};
    const counterStats: Record<string, number> = {};

    // Collect timer statistics
    for (const name of this.measurements.keys()) {
      timerStats[name] = this.getTimerStats(name);
    }

    // Collect counter statistics
    for (const [name, value] of this.counters.entries()) {
      counterStats[name] = value;
    }

    return {
      timers: timerStats,
      counters: counterStats,
      cache: parserCache.getDetailedStats(),
      regex: {
        patternsCompiled: regexCache.size(),
      },
    };
  }

  static reset(): void {
    this.timers.clear();
    this.counters.clear();
    this.measurements.clear();
  }
}

/**
 * Memoization decorator for expensive operations
 */
export function memoize<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  keyFn?: (...args: TArgs) => string,
  ttl: number = PERFORMANCE.PARSER_CACHE_TTL
): (...args: TArgs) => TReturn {
  const cache = new LRUCache<string, TReturn>(50, ttl);

  return (...args: TArgs): TReturn => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Debounce utility for expensive operations
 */
export function debounce<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: TArgs) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle utility for rate-limiting operations
 */
export function throttle<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let lastCall = 0;

  return (...args: TArgs) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}
