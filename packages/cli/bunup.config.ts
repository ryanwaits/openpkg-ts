import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: false,
  clean: true,
  format: ['esm'],
  target: 'node',
  external: ['@openpkg-ts/sdk'],
});
