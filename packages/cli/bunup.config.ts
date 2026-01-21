import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/openpkg.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  external: ['typescript', '@openpkg-ts/sdk', '@openpkg-ts/adapters', '@openpkg-ts/spec'],
});
