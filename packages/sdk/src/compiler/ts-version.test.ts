import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

describe('typescript runtime', () => {
  test('resolved typescript is a supported major with a working compiler api', () => {
    // Logged so CI matrix lanes prove which compiler actually resolved.
    console.log(`resolved typescript version: ${ts.version}`);
    expect(ts.version).toMatch(/^[56]\./);
    // Guards against resolving TypeScript 7, whose main export is a version
    // stub with no compiler API, and against stub-alias packages.
    expect(typeof ts.createProgram).toBe('function');
  });
});
