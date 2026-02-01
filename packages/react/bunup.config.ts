import { defineConfig } from 'bunup';

const shared = {
  outDir: 'dist',
  dts: true,
  format: ['esm'] as const,
  target: 'browser' as const,
  external: ['react', 'react-dom', 'tailwindcss', /^next(\/.*)?$/],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

export default defineConfig([
  {
    ...shared,
    entry: ['src/styled.ts'],
    clean: true,
  },
  {
    ...shared,
    entry: ['src/index.ts'],
    clean: false,
  },
]);
