import { describe, expect, test } from 'bun:test';
import { CacheManager } from './cache-manager';

describe('CacheManager', () => {
  test('basic get/set', () => {
    const cache = new CacheManager<string, number>();
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBeUndefined();
  });

  test('has() checks existence', () => {
    const cache = new CacheManager<string, number>();
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  test('delete() removes entry', () => {
    const cache = new CacheManager<string, number>();
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(cache.delete('a')).toBe(false);
  });

  test('clear() removes all entries', () => {
    const cache = new CacheManager<string, number>();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  test('size returns count', () => {
    const cache = new CacheManager<string, number>();
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  test('LRU eviction at maxSize', () => {
    const cache = new CacheManager<string, number>({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);

    // Adding 'd' should evict 'a' (oldest)
    cache.set('d', 4);
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  test('get() updates LRU order', () => {
    const cache = new CacheManager<string, number>({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to make it most recently used
    cache.get('a');

    // Adding 'd' should evict 'b' (now oldest)
    cache.set('d', 4);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  test('set() on existing key updates LRU order', () => {
    const cache = new CacheManager<string, number>({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Update 'a' to make it most recently used
    cache.set('a', 10);

    // Adding 'd' should evict 'b' (now oldest)
    cache.set('d', 4);
    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBeUndefined();
  });

  test('TTL expiration', async () => {
    const cache = new CacheManager<string, number>({ ttl: 50 });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get('a')).toBeUndefined();
  });

  test('has() respects TTL', async () => {
    const cache = new CacheManager<string, number>({ ttl: 50 });
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.has('a')).toBe(false);
  });

  test('values() filters expired entries', async () => {
    const cache = new CacheManager<string, number>({ ttl: 50 });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.values()).toEqual([1, 2]);

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.values()).toEqual([]);
  });

  test('default maxSize is 1000', () => {
    const cache = new CacheManager<number, number>();
    for (let i = 0; i < 1001; i++) {
      cache.set(i, i);
    }
    expect(cache.size).toBe(1000);
    expect(cache.get(0)).toBeUndefined(); // First entry evicted
    expect(cache.get(1000)).toBe(1000); // Last entry present
  });
});
