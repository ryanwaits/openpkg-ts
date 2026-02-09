import { describe, expect, test } from 'bun:test';
import { getAdapter } from '../registry';

// Import triggers self-registration
import '../fumadocs/index';

describe('fumadocs self-registration', () => {
  test('import triggers registration', () => {
    const adapter = getAdapter('fumadocs');
    expect(adapter).toBeDefined();
    expect(adapter?.id).toBe('fumadocs');
    expect(adapter?.name).toBe('Fumadocs');
  });

  test('getAdapter fumadocs returns the adapter', () => {
    const adapter = getAdapter('fumadocs');
    expect(adapter).toBeDefined();
    expect(typeof adapter?.generate).toBe('function');
  });
});
