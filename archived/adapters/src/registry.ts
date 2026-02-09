import type { OpenPkg } from '@openpkg-ts/spec';

/**
 * Doc adapter interface for extensible documentation generation.
 */
export interface DocAdapter {
  /** Unique adapter identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Generate documentation to output directory */
  generate: (spec: OpenPkg, outDir: string) => Promise<void>;
}

const registry = new Map<string, DocAdapter>();

/**
 * Register a documentation adapter.
 */
export function registerAdapter(adapter: DocAdapter): void {
  registry.set(adapter.id, adapter);
}

/**
 * Get an adapter by ID.
 * @returns The adapter or undefined if not found
 */
export function getAdapter(id: string): DocAdapter | undefined {
  return registry.get(id);
}

/**
 * List all registered adapters.
 */
export function listAdapters(): DocAdapter[] {
  return Array.from(registry.values());
}
