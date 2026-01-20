import { describe, expect, test } from 'bun:test';
import { type DocAdapter, getAdapter, listAdapters, registerAdapter } from './registry';

// Clear registry between tests by re-importing fresh module
describe('adapter registry', () => {
  const mockAdapter: DocAdapter = {
    id: 'test-adapter',
    name: 'Test Adapter',
    generate: async () => {},
  };

  test('registerAdapter adds adapter to registry', () => {
    registerAdapter(mockAdapter);
    expect(getAdapter('test-adapter')).toBe(mockAdapter);
  });

  test('getAdapter returns undefined for unknown adapter', () => {
    expect(getAdapter('nonexistent')).toBeUndefined();
  });

  test('listAdapters returns all registered adapters', () => {
    const adapter2: DocAdapter = {
      id: 'another-adapter',
      name: 'Another Adapter',
      generate: async () => {},
    };
    registerAdapter(adapter2);
    const adapters = listAdapters();
    expect(adapters.some((a) => a.id === 'test-adapter')).toBe(true);
    expect(adapters.some((a) => a.id === 'another-adapter')).toBe(true);
  });
});
