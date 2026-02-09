import { defineConfig } from 'bunup';

const shared = [
  'react',
  'react-dom',
  'ai',
  '@openpkg-ts/sdk',
  '@openpkg-ts/sdk/browser',
  '@openpkg-ts/spec',
  '@openpkg-ts/registry',
  '@openpkg-ts/registry/docskit',
  '@json-render/core',
  '@json-render/react',
  'zod',
];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    dts: true,
    clean: true,
    format: ['esm'],
    target: 'browser',
    external: shared,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  {
    entry: ['src/server.ts'],
    outDir: 'dist',
    dts: true,
    format: ['esm'],
    external: shared,
  },
  {
    entry: ['src/codegen/index.ts'],
    outDir: 'dist/codegen',
    dts: true,
    format: ['esm'],
    external: [...shared, '@json-render/codegen'],
  },
]);
