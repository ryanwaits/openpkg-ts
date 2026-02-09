import { describe, expect, test } from 'bun:test';
import { extract } from './spec-builder';

describe('Bug 1: boolean decomposed into literal union', () => {
  test('boolean property should have {type: "boolean"}, not anyOf literals', async () => {
    const code = `
      export interface Config {
        enabled: boolean;
        name: string;
      }
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Config');
    const enabledMember = exp?.members?.find((m) => m.name === 'enabled');
    expect(enabledMember?.schema).toEqual({ type: 'boolean' });
  });
});

describe('Bug 2: maxProperties=20 drops properties', () => {
  test('interface with 25 properties should capture all 25', async () => {
    const props = Array.from({ length: 25 }, (_, i) => `prop${i}: string;`).join('\n');
    const code = `export interface Big {\n${props}\n}`;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Big');
    expect(exp?.members?.length).toBe(25);
  });
});

describe('Bug 3: $constructor exports classified as variable', () => {
  test('variable with construct signature should be kind=class', async () => {
    const code = `
      interface FooInstance { value: string; }
      export const Foo: { new(x: string): FooInstance } = null as any;
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Foo');
    expect(exp?.kind).toBe('class');
  });
});

describe('Bug 4: never serialized correctly', () => {
  test('required never property should be {not: {}} after normalization', async () => {
    const code = `
      export interface Foo {
        bar: never;
        baz: string;
      }
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Foo');
    const barMember = exp?.members?.find((m) => m.name === 'bar');
    expect(barMember?.schema).toEqual({ not: {} });
  });

  test('optional never property becomes undefined (TS resolves never|undefined to undefined)', async () => {
    const code = `
      export interface Foo {
        bar?: never;
        baz: string;
      }
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Foo');
    const barMember = exp?.members?.find((m) => m.name === 'bar');
    // TS resolves `never | undefined` → `undefined` → normalized to {type: "null"}
    expect(barMember?.schema).toEqual({ type: 'null' });
  });
});

describe('Bug 5: member-level @deprecated lost', () => {
  test('deprecated class method should have deprecated flag', async () => {
    const code = `
      export class MyClass {
        /** @deprecated Use newMethod instead */
        oldMethod(): void {}
        newMethod(): void {}
      }
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'MyClass');
    const oldMethod = exp?.members?.find((m) => m.name === 'oldMethod');
    expect(oldMethod).toBeDefined();
    expect(oldMethod?.deprecated).toBe(true);
  });

  test('deprecated interface property should have deprecated flag', async () => {
    const code = `
      export interface Config {
        /** @deprecated Use newProp */
        oldProp: string;
        newProp: string;
      }
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Config');
    const oldProp = exp?.members?.find((m) => m.name === 'oldProp');
    expect(oldProp).toBeDefined();
    expect(oldProp?.deprecated).toBe(true);
  });

  test('deprecated class property should have deprecated flag', async () => {
    const code = `
      export class Foo {
        /** @deprecated */
        oldValue: string = '';
        newValue: string = '';
      }
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'Foo');
    const oldValue = exp?.members?.find((m) => m.name === 'oldValue');
    expect(oldValue).toBeDefined();
    expect(oldValue?.deprecated).toBe(true);
  });
});

describe('Bug 6: @deprecated on re-export specifiers not detected', () => {
  test('deprecated re-export should have deprecated flag', async () => {
    const code = `
      function foo() { return 1; }
      /** @deprecated Use bar instead */
      export { foo };
    `;
    const result = await extract({ entryFile: 'test.ts', content: code });
    const exp = result.spec.exports.find((e) => e.id === 'foo');
    expect(exp).toBeDefined();
    expect(exp?.deprecated).toBe(true);
  });
});
