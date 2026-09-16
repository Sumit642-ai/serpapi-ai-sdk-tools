import type { CacheOptions } from "./types.js";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * A small in-memory cache.
 *
 * Why it exists: the SerpApi free plan allows 250 searches a month. Agents ask
 * the same question twice more often than you would think — a retry, a second
 * step that re-checks a fact, two users asking about the same city. Serving
 * those from memory costs nothing.
 *
 * It is deliberately not clever: no background timers, no persistence. Entries
 * expire when they are read, and the least recently used entry is dropped once
 * the cache is full.
 */
export class SearchCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 100;
  }

  get(key: string): unknown | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    // Re-inserting moves the key to the end of the Map's iteration order, so
    // the entry we just used is the last one to be evicted.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: unknown): void {
    // Delete first so that overwriting an existing key does not count as growth.
    this.entries.delete(key);

    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) break;
      this.entries.delete(oldest.value);
    }

    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

/**
 * Builds the key a response is cached under.
 *
 * The API key is never part of this string. Two callers with different keys
 * asking the same question get the same cached answer, which is what we want —
 * the response does not depend on who asked.
 */
export function buildCacheKey(engine: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return `${engine}?${sorted}`;
}
