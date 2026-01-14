import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/styled.ts'],
  outDir: 'dist',
  dts: true,
  clean: true,
  format: ['esm'],
  target: 'browser',
  external: ['react', 'react-dom', 'tailwindcss', 'next'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
