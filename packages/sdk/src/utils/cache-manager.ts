/**
 * LRU Cache implementation with optional TTL support.
 * Used for bounded caching in spec extraction to prevent memory leaks.
 */

export interface CacheManagerOptions {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Time-to-live in milliseconds (optional, no expiry if not set) */
  ttl?: number;
}

interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
}

/**
 * Bounded LRU cache with optional TTL.
 *
 * @example
 * ```ts
 * const cache = new CacheManager<string, number>({ maxSize: 100 });
 * cache.set('key', 42);
 * cache.get('key'); // 42
 * cache.clear();
 * ```
 */
export class CacheManager<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private readonly maxSize: number;
  private readonly ttl?: number;

  constructor(options: CacheManagerOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache.
   * Returns undefined if not found or expired.
   * Moves accessed entry to end (most recently used).
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used) - delete and re-add
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Check if key exists (without affecting LRU order).
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set a value in the cache.
   * Evicts least recently used entry if at capacity.
   */
  set(key: K, value: V): void {
    // Delete first if exists (to update LRU order)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest (first) entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry<V> = {
      value,
      ...(this.ttl ? { expiresAt: Date.now() + this.ttl } : {}),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of entries.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys (for debugging/testing).
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /**
   * Get all values (for debugging/testing).
   */
  values(): V[] {
    const result: V[] = [];
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        continue;
      }
      result.push(entry.value);
    }
    return result;
  }
}
