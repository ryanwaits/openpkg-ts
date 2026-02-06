import { defineConfig } from 'bunup';

export default defineConfig([
  {
    entry: ['src/registry.ts'],
    outDir: 'dist',
    dts: true,
    clean: true,
    format: ['esm'],
    external: ['@openpkg-ts/sdk', '@openpkg-ts/spec'],
  },
  {
    entry: ['src/fumadocs/index.ts', 'src/fumadocs/components/index.ts'],
    outDir: 'dist/fumadocs',
    dts: true,
    format: ['esm'],
    external: [
      'react',
      'react-dom',
      '@openpkg-ts/adapters',
      '@openpkg-ts/sdk',
      '@openpkg-ts/spec',
      '@openpkg-ts/registry',
      'fumadocs-core',
    ],
  },
]);
