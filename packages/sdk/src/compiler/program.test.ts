import { describe, expect, test } from 'bun:test';
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

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile!);
    expect(moduleSymbol).toBeDefined();

    const exports = checker.getExportsOfModule(moduleSymbol!);
    const getDataExport = exports.find((e) => e.getName() === 'getData');

    expect(getDataExport).toBeDefined();
    expect(getDataExport!.flags & ts.SymbolFlags.Alias).toBeTruthy();

    // Aliased symbol should have declarations
    const aliased = checker.getAliasedSymbol(getDataExport!);
    expect(aliased.declarations?.length).toBeGreaterThan(0);

    // Verify the declaration is in the correct file
    const decl = aliased.declarations![0];
    expect(decl.getSourceFile().fileName).toContain('subdir/data.ts');
  });

  test('resolves type re-exports correctly', () => {
    const entryFile = path.join(fixturesDir, 'barrel-reexport/index.ts');
    const { program } = createProgram({ entryFile });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(entryFile);

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile!);
    const exports = checker.getExportsOfModule(moduleSymbol!);
    const dataResultExport = exports.find((e) => e.getName() === 'DataResult');

    expect(dataResultExport).toBeDefined();

    const aliased = checker.getAliasedSymbol(dataResultExport!);
    expect(aliased.declarations?.length).toBeGreaterThan(0);
    expect(aliased.declarations![0].getSourceFile().fileName).toContain('subdir/data.ts');
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

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile!);
    const exports = checker.getExportsOfModule(moduleSymbol!);
    const dataProviderExport = exports.find((e) => e.getName() === 'DataProvider');

    expect(dataProviderExport).toBeDefined();
    expect(dataProviderExport!.flags & ts.SymbolFlags.Alias).toBeTruthy();

    // Key assertion: aliased symbol should have declarations
    // Before fix: 0 declarations (undefined)
    // After fix: 1+ declarations
    const aliased = checker.getAliasedSymbol(dataProviderExport!);
    const declCount = aliased.declarations?.length ?? 0;
    expect(declCount).toBeGreaterThan(0);
    expect(aliased.declarations![0].getSourceFile().fileName).toContain('contexts/data.tsx');
  });
});
