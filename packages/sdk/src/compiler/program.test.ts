import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ts from 'typescript';
import { createProgram } from './program';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('createProgram local re-export resolution', () => {
  test('resolves barrel re-exports from subdirectories', () => {
    const entryFile = path.join(fixturesDir, 'barrel-reexport/index.ts');
    const { program } = createProgram({ entryFile });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(entryFile);

    expect(sourceFile).toBeDefined();
    if (!sourceFile) throw new Error('sourceFile not found');

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    expect(moduleSymbol).toBeDefined();
    if (!moduleSymbol) throw new Error('moduleSymbol not found');

    const exports = checker.getExportsOfModule(moduleSymbol);
    const getDataExport = exports.find((e) => e.getName() === 'getData');

    expect(getDataExport).toBeDefined();
    if (!getDataExport) throw new Error('getDataExport not found');
    expect(getDataExport.flags & ts.SymbolFlags.Alias).toBeTruthy();

    // Aliased symbol should have declarations
    const aliased = checker.getAliasedSymbol(getDataExport);
    expect(aliased.declarations?.length).toBeGreaterThan(0);

    // Verify the declaration is in the correct file
    const decl = aliased.declarations?.[0];
    if (!decl) throw new Error('expected aliased symbol to have a declaration');
    expect(decl.getSourceFile().fileName).toContain('subdir/data.ts');
  });

  test('resolves type re-exports correctly', () => {
    const entryFile = path.join(fixturesDir, 'barrel-reexport/index.ts');
    const { program } = createProgram({ entryFile });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(entryFile);
    if (!sourceFile) throw new Error('sourceFile not found');

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) throw new Error('moduleSymbol not found');
    const exports = checker.getExportsOfModule(moduleSymbol);
    const dataResultExport = exports.find((e) => e.getName() === 'DataResult');

    expect(dataResultExport).toBeDefined();
    if (!dataResultExport) throw new Error('dataResultExport not found');

    const aliased = checker.getAliasedSymbol(dataResultExport);
    expect(aliased.declarations?.length).toBeGreaterThan(0);
    expect(aliased.declarations?.[0].getSourceFile().fileName).toContain('subdir/data.ts');
  });

  test('resolves tsx re-exports when extended config is unresolvable', () => {
    // This test reproduces the @json-render/react bug:
    // - tsconfig extends an unresolvable config (workspace package)
    // - jsx option is not inherited
    // - .tsx files can be resolved but not loaded into program
    // - re-exported symbols have 0 declarations
    const entryFile = path.join(fixturesDir, 'unresolved-deps/index.ts');
    const { program } = createProgram({ entryFile });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(entryFile);

    expect(sourceFile).toBeDefined();
    if (!sourceFile) throw new Error('sourceFile not found');

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) throw new Error('moduleSymbol not found');
    const exports = checker.getExportsOfModule(moduleSymbol);
    const dataProviderExport = exports.find((e) => e.getName() === 'DataProvider');

    expect(dataProviderExport).toBeDefined();
    if (!dataProviderExport) throw new Error('dataProviderExport not found');
    expect(dataProviderExport.flags & ts.SymbolFlags.Alias).toBeTruthy();

    // Key assertion: aliased symbol should have declarations
    // Before fix: 0 declarations (undefined)
    // After fix: 1+ declarations
    const aliased = checker.getAliasedSymbol(dataProviderExport);
    const declCount = aliased.declarations?.length ?? 0;
    expect(declCount).toBeGreaterThan(0);
    expect(aliased.declarations?.[0].getSourceFile().fileName).toContain('contexts/data.tsx');
  });
});

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function exportedTypeString(entryFile: string, exportName: string): string {
  const { program } = createProgram({ entryFile });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryFile);
  if (!sourceFile) throw new Error('sourceFile not found');
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error('moduleSymbol not found');
  const exp = checker.getExportsOfModule(moduleSymbol).find((e) => e.getName() === exportName);
  if (!exp) throw new Error(`${exportName} not exported`);
  return checker.typeToString(checker.getTypeOfSymbol(exp));
}

describe('NodeNext workspace resolver preserves import mode', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function setupWorkspace() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-nodenext-'));
    write(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }),
    );
    write(
      path.join(tmp, 'packages/app/package.json'),
      JSON.stringify({ name: 'app', type: 'module' }),
    );
    write(path.join(tmp, 'packages/other/package.json'), JSON.stringify({ name: 'other' }));
    write(path.join(tmp, 'packages/other/src/index.ts'), 'export const other = 1;\n');
  }

  test('ESM import picks the import condition, not require', () => {
    setupWorkspace();
    const dep = path.join(tmp, 'node_modules/dual-cond');
    write(
      path.join(dep, 'package.json'),
      JSON.stringify({
        name: 'dual-cond',
        version: '1.0.0',
        exports: {
          '.': {
            import: { types: './import.d.ts', default: './import.js' },
            require: { types: './require.d.ts', default: './require.js' },
          },
        },
      }),
    );
    write(path.join(dep, 'import.d.ts'), 'export declare const which: "import";\n');
    write(path.join(dep, 'require.d.ts'), 'export declare const which: "require";\n');
    write(path.join(dep, 'import.js'), 'export const which = "import";\n');
    write(path.join(dep, 'require.js'), 'exports.which = "require";\n');
    const entry = path.join(tmp, 'packages/app/src/index.ts');
    write(entry, 'import { which } from "dual-cond";\nexport const got = which;\n');

    expect(exportedTypeString(entry, 'got')).toBe('"import"');
  });

  test('import-only dependency resolves under ESM', () => {
    setupWorkspace();
    const dep = path.join(tmp, 'node_modules/import-only');
    write(
      path.join(dep, 'package.json'),
      JSON.stringify({
        name: 'import-only',
        version: '1.0.0',
        exports: {
          '.': { import: { types: './import.d.ts', default: './import.js' } },
        },
      }),
    );
    write(path.join(dep, 'import.d.ts'), 'export declare const which: "import";\n');
    write(path.join(dep, 'import.js'), 'export const which = "import";\n');
    const entry = path.join(tmp, 'packages/app/src/index.ts');
    write(entry, 'import { which } from "import-only";\nexport const got = which;\n');

    expect(exportedTypeString(entry, 'got')).toBe('"import"');
  });
});

describe('ambient @types discovery follows symlinks', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function writeConsumer() {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-ambient-'));
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'consumer' }));
    const entry = path.join(tmp, 'src/index.ts');
    write(entry, 'export const g = AuditGlobal;\n');
    return entry;
  }

  function writeAmbient(dir: string) {
    write(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: '@types/ambient', version: '1.0.0' }),
    );
    write(path.join(dir, 'index.d.ts'), 'declare const AuditGlobal: "ok";\n');
  }

  test('physical @types package is discovered', () => {
    const entry = writeConsumer();
    writeAmbient(path.join(tmp, 'node_modules/@types/ambient'));
    const { compilerOptions } = createProgram({ entryFile: entry });
    expect(compilerOptions.types).toContain('ambient');
  });

  test('symlinked @types package is discovered', () => {
    const entry = writeConsumer();
    const real = path.join(tmp, '.store/@types/ambient');
    writeAmbient(real);
    fs.mkdirSync(path.join(tmp, 'node_modules/@types'), { recursive: true });
    fs.symlinkSync(real, path.join(tmp, 'node_modules/@types/ambient'));
    const { compilerOptions } = createProgram({ entryFile: entry });
    expect(compilerOptions.types).toContain('ambient');
  });

  test('mixed physical and symlink @types are both discovered', () => {
    const entry = writeConsumer();
    writeAmbient(path.join(tmp, 'node_modules/@types/ambient'));
    const real = path.join(tmp, '.store/@types/other');
    write(
      path.join(real, 'package.json'),
      JSON.stringify({ name: '@types/other', version: '1.0.0' }),
    );
    write(path.join(real, 'index.d.ts'), 'declare type OtherGlobal = "yes";\n');
    fs.mkdirSync(path.join(tmp, 'node_modules/@types'), { recursive: true });
    fs.symlinkSync(real, path.join(tmp, 'node_modules/@types/other'));
    const { compilerOptions } = createProgram({ entryFile: entry });
    expect(compilerOptions.types).toEqual(expect.arrayContaining(['ambient', 'other']));
  });

  test('explicit types list is preserved', () => {
    const entry = writeConsumer();
    writeAmbient(path.join(tmp, 'node_modules/@types/ambient'));
    write(path.join(tmp, 'tsconfig.json'), JSON.stringify({ compilerOptions: { types: [] } }));
    const { compilerOptions } = createProgram({ entryFile: entry });
    expect(compilerOptions.types).toEqual([]);
  });
});

describe('tsconfig module settings are not mixed with NodeNext defaults', () => {
  let tmp: string;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function writeBoundMethodPackage(compilerOptions: Record<string, unknown>): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-module-pair-'));
    write(path.join(tmp, 'package.json'), JSON.stringify({ name: 'pkg' }));
    write(path.join(tmp, 'tsconfig.json'), JSON.stringify({ compilerOptions }));
    write(
      path.join(tmp, 'src/internal.ts'),
      'export class Counter {\n  add(amount: number, label?: string): number {\n    return amount + (label ? 1 : 0);\n  }\n}\n',
    );
    const entry = path.join(tmp, 'src/index.ts');
    write(
      entry,
      'import { Counter } from "./internal";\nconst counter = new Counter();\nexport const add = /* @__PURE__ */ counter.add.bind(counter);\n',
    );
    return entry;
  }

  test('module without moduleResolution resolves extensionless relative imports', () => {
    const entry = writeBoundMethodPackage({ module: 'ES6', strict: true });
    expect(exportedTypeString(entry, 'add')).toBe(
      '(amount: number, label?: string | undefined) => number',
    );
  });

  test('moduleResolution without module resolves extensionless relative imports', () => {
    const entry = writeBoundMethodPackage({ moduleResolution: 'bundler', strict: true });
    expect(exportedTypeString(entry, 'add')).toBe(
      '(amount: number, label?: string | undefined) => number',
    );
  });
});
