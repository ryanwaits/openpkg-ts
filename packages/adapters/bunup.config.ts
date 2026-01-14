import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/fumadocs/index.ts', 'src/fumadocs/components/index.ts'],
  outDir: 'dist',
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['react', 'react-dom', '@openpkg-ts/sdk', '@openpkg-ts/spec', '@openpkg-ts/ui', 'fumadocs-core'],
});
