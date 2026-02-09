import { defineConfig } from 'bunup';

export default defineConfig([
  {
    entry: ['src/docskit.ts'],
    outDir: 'dist/docskit',
    dts: true,
    format: ['esm'],
    target: 'browser',
    external: [
      'react',
      'react-dom',
      'codehike',
      'codehike/code',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      '@radix-ui/*',
      '@openpkg-ts/sdk',
      '@openpkg-ts/sdk/browser',
      '@openpkg-ts/spec',
      'seti-icons',
      'zod',
    ],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  {
    entry: ['src/badge.ts'],
    outDir: 'dist/badge',
    dts: true,
    format: ['esm'],
    target: 'browser',
    external: ['react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  {
    entry: ['lib/utils.ts'],
    outDir: 'dist/lib',
    dts: true,
    format: ['esm'],
    target: 'browser',
    external: ['clsx', 'tailwind-merge'],
  },
]);
