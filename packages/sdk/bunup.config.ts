import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/browser.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['typescript', '@openpkg-ts/spec'],
});
