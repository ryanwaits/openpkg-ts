import { expect, test } from 'bun:test';
import { packageNameFromPath } from './type-identity';

test('flat node_modules', () => {
  expect(packageNameFromPath('/r/node_modules/zod/lib/index.d.ts')).toBe('zod');
  expect(packageNameFromPath('/r/node_modules/@ai-sdk/provider/dist/index.d.ts')).toBe(
    '@ai-sdk/provider',
  );
});

// Store layouts nest the real package under a second node_modules; the first
// segment is the store dir (`.pnpm`, `.bun`), never a package.
test('pnpm and bun stores resolve to the package, not the store dir', () => {
  expect(packageNameFromPath('/r/node_modules/.pnpm/zod@3.23.8/node_modules/zod/index.d.ts')).toBe(
    'zod',
  );
  expect(
    packageNameFromPath(
      '/r/node_modules/.pnpm/@ai-sdk+provider@2.0.0/node_modules/@ai-sdk/provider/dist/index.d.ts',
    ),
  ).toBe('@ai-sdk/provider');
  expect(packageNameFromPath('/r/node_modules/.bun/zod@4.1.0/node_modules/zod/index.d.ts')).toBe(
    'zod',
  );
});

test('nested dependency resolves to the innermost package', () => {
  expect(packageNameFromPath('/r/node_modules/a/node_modules/b/index.d.ts')).toBe('b');
});

test('project files have no package', () => {
  expect(packageNameFromPath('/r/packages/sdk/src/index.ts')).toBeUndefined();
});
