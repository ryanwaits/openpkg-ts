/**
 * Checker-vs-spec differential for corpus extract.
 * Oracle is TypeScript: getExportsOfModule + signatures + JSDoc tags.
 */
import * as path from 'node:path';
import type { OpenPkg, SpecExport, SpecSchema } from '@openpkg-ts/spec';
import ts from 'typescript';
import { getExportKind } from '../../packages/sdk/src/ast/utils.ts';
import { createProgram } from '../../packages/sdk/src/compiler/program.ts';
import { buildSignatureString, formatSchema } from '../../packages/sdk/src/core/query.ts';

export const AXES = [
  'robustness',
  'coverage',
  'kind',
  'signatures',
  'resolution',
  'roundtrip',
  'defaults',
  'members',
  'jsdoc',
] as const;

export type Axis = (typeof AXES)[number];

export type Finding = {
  fingerprint: string;
  axis: Axis;
  export?: string;
  expected: string;
  actual: string;
  loc?: string;
};

export type AuditResult = {
  scores: Record<Axis, number>;
  overall: number;
  findings: Finding[];
  sizes: Record<Axis, number>;
};

const MAX_FINDINGS = 40;
const JSDOC_TAGS = new Set(['deprecated', 'param', 'returns', 'example', 'throws', 'default']);

export function crashResult(reason: string): AuditResult {
  const findings: Finding[] = [
    {
      fingerprint: fingerprintForCrash(reason),
      axis: 'robustness',
      expected: 'extract completes inside budget',
      actual: reason,
    },
  ];
  const scores = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
  const sizes = Object.fromEntries(AXES.map((a) => [a, a === 'robustness' ? 1 : 0])) as Record<
    Axis,
    number
  >;
  return { scores, overall: 0, findings, sizes };
}

function fingerprintForCrash(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('heap') || r.includes('oom') || r.includes('enomem') || r.includes('max-old-space'))
    return 'robustness/oom';
  if (r.includes('timeout') || r.includes('etimedout') || r.includes('killed by sig'))
    return 'robustness/timeout';
  return 'robustness/crash';
}

export function auditSpec(args: {
  spec: OpenPkg;
  entryFile: string;
  content?: string;
}): AuditResult {
  const findings: Finding[] = [];
  const sizes = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
  sizes.robustness = 1;

  const push = (f: Finding) => {
    if (findings.length < MAX_FINDINGS) findings.push(f);
  };

  const programResult = createProgram({
    entryFile: args.entryFile,
    content: args.content,
  });
  const { program, sourceFile } = programResult;
  if (!sourceFile) {
    return crashResult(`no source file: ${args.entryFile}`);
  }

  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return crashResult(`no module symbol: ${args.entryFile}`);
  }

  const exported = checker.getExportsOfModule(moduleSymbol);
  const specByName = new Map(args.spec.exports.map((e) => [e.name, e]));
  const typeById = new Map((args.spec.types ?? []).map((t) => [t.id, t]));
  const entryDir = path.dirname(path.resolve(args.entryFile));

  sizes.coverage = exported.length;

  for (const symbol of exported) {
    const name = symbol.getName();
    const specExp = specByName.get(name);
    const decl = declarationOf(symbol, checker);
    const loc = locOf(decl);

    if (!specExp) {
      push({
        fingerprint: coverageFingerprint(symbol),
        axis: 'coverage',
        export: name,
        expected: `exported ${name}`,
        actual: 'missing from spec',
        loc,
      });
      continue;
    }

    compareKind(symbol, specExp, checker, decl, loc, push, sizes);
    compareSignatures(symbol, specExp, checker, decl, loc, push, sizes);
    compareRoundtrip(symbol, specExp, checker, decl, loc, push, sizes);
    compareDefaults(symbol, specExp, checker, loc, push, sizes);
    compareMembers(symbol, specExp, checker, loc, push, sizes);
    compareJsdoc(symbol, specExp, checker, loc, push, sizes);
  }

  compareResolution(args.spec, typeById, entryDir, push, sizes);

  const scores = Object.fromEntries(
    AXES.map((axis) => {
      if (axis === 'robustness') return [axis, 1];
      const size = sizes[axis];
      const n = findings.filter((f) => f.axis === axis).length;
      return [axis, size <= 0 ? 1 : Math.max(0, 1 - n / size)];
    }),
  ) as Record<Axis, number>;

  const overall = AXES.reduce((s, a) => s + scores[a], 0) / AXES.length;
  return { scores, overall, findings, sizes };
}

function declarationOf(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Declaration | undefined {
  let target = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = checker.getAliasedSymbol(symbol);
    if (aliased && aliased !== symbol) target = aliased;
  }
  return target.valueDeclaration ?? target.declarations?.[0] ?? symbol.declarations?.[0];
}

function locOf(decl: ts.Declaration | undefined): string | undefined {
  if (!decl) return undefined;
  const sf = decl.getSourceFile();
  const { line } = sf.getLineAndCharacterOfPosition(decl.getStart());
  return `${sf.fileName}:${line + 1}`;
}

function coverageFingerprint(symbol: ts.Symbol): string {
  if (symbol.getName() === 'default') return 'coverage/default';
  for (const d of symbol.getDeclarations() ?? []) {
    if (ts.isExportAssignment(d) && d.isExportEquals) return 'coverage/export-equals';
    if (ts.isExportSpecifier(d)) {
      if (d.propertyName) return 'coverage/export-as';
      const exp = d.parent?.parent;
      if (exp && ts.isExportDeclaration(exp) && exp.moduleSpecifier) return 'coverage/star-reexport';
    }
    if (ts.isExportDeclaration(d) && d.moduleSpecifier && !d.exportClause) return 'coverage/export-star';
    if (ts.isNamespaceExport(d)) return 'coverage/export-star';
  }
  return 'coverage/missing';
}

function oracleKind(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  decl: ts.Declaration | undefined,
): string {
  if (!decl) return 'variable';
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
  return getExportKind(decl, type);
}

function compareKind(
  symbol: ts.Symbol,
  spec: SpecExport,
  checker: ts.TypeChecker,
  decl: ts.Declaration | undefined,
  loc: string | undefined,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  sizes.kind++;
  const want = oracleKind(symbol, checker, decl);
  const got = spec.kind;
  if (want === got) return;
  if (want === 'function' && got === 'variable' && (spec.signatures?.length ?? 0) > 0) return;
  if (want === 'function' && got === 'variable') {
    push({
      fingerprint: 'kind/callable-const',
      axis: 'kind',
      export: spec.name,
      expected: 'function (call signatures)',
      actual: 'variable, no signatures',
      loc,
    });
    return;
  }
  if (want === 'namespace' || got === 'namespace') {
    push({
      fingerprint: 'kind/namespace',
      axis: 'kind',
      export: spec.name,
      expected: want,
      actual: got,
      loc,
    });
    return;
  }
  push({
    fingerprint: `kind/${want}-as-${got}`,
    axis: 'kind',
    export: spec.name,
    expected: want,
    actual: got,
    loc,
  });
}

function callSigs(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  decl: ts.Declaration | undefined,
): readonly ts.Signature[] {
  if (!decl) return [];
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
  const fromType = type.getCallSignatures();
  if (fromType.length > 0) return fromType;
  const declared = checker.getDeclaredTypeOfSymbol(
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol,
  );
  return declared.getCallSignatures();
}

function compareSignatures(
  symbol: ts.Symbol,
  spec: SpecExport,
  checker: ts.TypeChecker,
  decl: ts.Declaration | undefined,
  loc: string | undefined,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  const sigs = callSigs(symbol, checker, decl);
  if (sigs.length === 0) return;
  sizes.signatures++;

  const specSigs = spec.signatures ?? [];
  if (specSigs.length === 0) {
    push({
      fingerprint: 'signatures/overload-drop',
      axis: 'signatures',
      export: spec.name,
      expected: `${sigs.length} call signature(s)`,
      actual: 'none',
      loc,
    });
    return;
  }
  if (specSigs.length < sigs.length) {
    push({
      fingerprint: 'signatures/overload-drop',
      axis: 'signatures',
      export: spec.name,
      expected: `${sigs.length} overloads`,
      actual: `${specSigs.length}`,
      loc,
    });
  }

  const n = Math.min(sigs.length, specSigs.length);
  for (let i = 0; i < n; i++) {
    const want = sigs[i].parameters;
    const got = specSigs[i].parameters ?? [];
    if (want.length !== got.length) {
      push({
        fingerprint: 'signatures/arity-mismatch',
        axis: 'signatures',
        export: spec.name,
        expected: `${want.length} params`,
        actual: `${got.length}`,
        loc,
      });
    }
    const ret = specSigs[i].returns?.schema;
    if (isEmptySchema(ret)) {
      const checkerRet = checker.typeToString(checker.getReturnTypeOfSignature(sigs[i]));
      push({
        fingerprint: checkerRet.includes('<') ? 'signatures/generic-arity' : 'signatures/empty-return',
        axis: 'signatures',
        export: spec.name,
        expected: checkerRet,
        actual: '{}',
        loc,
      });
    }
    const tpWant = sigs[i].typeParameters?.length ?? 0;
    const tpGot = specSigs[i].typeParameters?.length ?? spec.typeParameters?.length ?? 0;
    if (tpWant > 0 && tpGot === 0) {
      push({
        fingerprint: 'signatures/typeparam-drop',
        axis: 'signatures',
        export: spec.name,
        expected: `${tpWant} type parameter(s)`,
        actual: 'none',
        loc,
      });
    }
  }
}

function compareRoundtrip(
  symbol: ts.Symbol,
  spec: SpecExport,
  checker: ts.TypeChecker,
  decl: ts.Declaration | undefined,
  loc: string | undefined,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  const sigs = callSigs(symbol, checker, decl);
  if (decl && sigs.length > 0) {
    sizes.roundtrip++;

    const checkerRet = checker.typeToString(checker.getReturnTypeOfSignature(sigs[0]));
    const specRet = spec.signatures?.[0]?.returns
      ? formatSchema(spec.signatures[0].returns.schema)
      : '';
    const collapse = classifyCollapse(specRet, checkerRet);
    if (collapse) {
      push({
        fingerprint: collapse,
        axis: 'roundtrip',
        export: spec.name,
        expected: checkerRet,
        actual: specRet || '(empty)',
        loc,
      });
    } else {
      const checkerSig = checker.signatureToString(sigs[0]);
      const specSig = buildSignatureString(spec, 0);
      const collapseSig = classifyCollapse(specSig, checkerSig);
      if (collapseSig) {
        push({
          fingerprint: collapseSig,
          axis: 'roundtrip',
          export: spec.name,
          expected: checkerSig,
          actual: specSig,
          loc,
        });
      }
    }
  }

  if (spec.kind === 'class' || spec.kind === 'interface') {
    const type = checker.getDeclaredTypeOfSymbol(
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol,
    );
    for (const prop of type.getProperties()) {
      if (!isPublicMember(prop)) continue;
      const mType = checker.getTypeOfSymbol(prop);
      const mSigs = mType.getCallSignatures();
      if (mSigs.length === 0) continue;
      sizes.roundtrip++;
      const member = spec.members?.find((m) => m.name === prop.getName());
      const specRet = member?.signatures?.[0]?.returns
        ? formatSchema(member.signatures[0].returns.schema)
        : member?.schema
          ? formatSchema(member.schema)
          : '';
      const checkerRet = checker.typeToString(checker.getReturnTypeOfSignature(mSigs[0]));
      const fp = classifyCollapse(specRet, checkerRet);
      if (!fp) continue;
      push({
        fingerprint: fp,
        axis: 'roundtrip',
        export: `${spec.name}.${prop.getName()}`,
        expected: checkerRet,
        actual: specRet || '(empty)',
        loc,
      });
    }
  }
}

function classifyCollapse(specStr: string, checkerStr: string): string | undefined {
  const spec = specStr.replace(/\s+/g, ' ').trim();
  const chk = checkerStr.replace(/\s+/g, ' ').trim();
  if (!spec || spec === '{}' || spec === 'unknown' || spec === 'any') {
    if (chk.includes('<')) return 'roundtrip/generic-arity';
    return 'roundtrip/empty-return';
  }
  if (/\bundefined\b/.test(chk) && /\bnull\b/.test(spec) && !/\bundefined\b/.test(spec))
    return 'roundtrip/undefined-as-null';
  if (/Readonly\s*</.test(chk) && (spec === 'object' || spec === '{}'))
    return 'roundtrip/utility-over-typeparam';
  if (/<[A-Z][\w.]*>/.test(chk) && spec === 'object') return 'roundtrip/utility-over-typeparam';
  if (chk.includes('<') && !spec.includes('<') && (spec === 'object' || spec === 'unknown'))
    return 'roundtrip/generic-arity';
  return undefined;
}

function compareDefaults(
  symbol: ts.Symbol,
  spec: SpecExport,
  checker: ts.TypeChecker,
  loc: string | undefined,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  const sigs = spec.signatures ?? [];
  const decl = declarationOf(symbol, checker);
  if (!decl) return;
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
  const call = type.getCallSignatures();
  for (let i = 0; i < call.length; i++) {
    const sigDecl = call[i].getDeclaration();
    if (!sigDecl || !ts.isFunctionLike(sigDecl)) continue;
    const specParams = sigs[i]?.parameters ?? [];
    for (let p = 0; p < sigDecl.parameters.length; p++) {
      const param = sigDecl.parameters[p];
      if (!param.initializer) continue;
      sizes.defaults++;
      const specParam = specParams[p];
      const text = param.initializer.getText();
      if (hasDefault(specParam)) continue;
      push({
        fingerprint: 'defaults/param-initializer',
        axis: 'defaults',
        export: spec.name,
        expected: `${param.name.getText()} = ${text}`,
        actual: 'no default',
        loc,
      });
    }
  }
}

function hasDefault(param: { default?: unknown; schema?: SpecSchema } | undefined): boolean {
  if (!param) return false;
  if (param.default !== undefined) return true;
  const schema = param.schema;
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    const rec = schema as Record<string, unknown>;
    return rec.default !== undefined || rec['x-ts-default'] !== undefined;
  }
  return false;
}

function compareMembers(
  symbol: ts.Symbol,
  spec: SpecExport,
  checker: ts.TypeChecker,
  loc: string | undefined,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  if (spec.kind !== 'class' && spec.kind !== 'interface') return;
  const decl = declarationOf(symbol, checker);
  if (!decl) return;
  const type = checker.getDeclaredTypeOfSymbol(
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol,
  );
  const want = type.getProperties().filter((p) => isPublicMember(p));
  if (want.length === 0) return;
  sizes.members++;
  const got = new Set((spec.members ?? []).map((m) => m.name).filter(Boolean) as string[]);
  const missing = want.map((p) => p.getName()).filter((n) => n && !n.startsWith('_') && !got.has(n));
  if (missing.length === 0) return;
  push({
    fingerprint: 'members/missing-public',
    axis: 'members',
    export: spec.name,
    expected: missing.slice(0, 8).join(', '),
    actual: 'missing from spec.members',
    loc,
  });
}

function isPublicMember(sym: ts.Symbol): boolean {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  if (!decl || !ts.canHaveModifiers(decl)) return true;
  const flags = ts.getCombinedModifierFlags(decl);
  if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) return false;
  return true;
}

function compareJsdoc(
  symbol: ts.Symbol,
  spec: SpecExport,
  checker: ts.TypeChecker,
  loc: string | undefined,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  const tags = symbol.getJsDocTags();
  const interesting = tags.filter((t) => JSDOC_TAGS.has(t.name));
  const docParts = symbol.getDocumentationComment(checker);
  if (interesting.length === 0 && docParts.length === 0) return;
  sizes.jsdoc++;

  const specTagNames = new Set((spec.tags ?? []).map((t) => t.name.replace(/^@/, '')));
  if (interesting.some((t) => t.name === 'deprecated') && !spec.deprecated) {
    push({
      fingerprint: 'jsdoc/deprecated',
      axis: 'jsdoc',
      export: spec.name,
      expected: '@deprecated',
      actual: 'not on spec',
      loc,
    });
  }
  if (
    interesting.some((t) => t.name === 'example') &&
    !(spec.examples && spec.examples.length > 0) &&
    !specTagNames.has('example')
  ) {
    push({
      fingerprint: 'jsdoc/example',
      axis: 'jsdoc',
      export: spec.name,
      expected: '@example',
      actual: 'not on spec',
      loc,
    });
  }
  if (interesting.some((t) => t.name === 'param') && !specTagNames.has('param')) {
    const hasParamDesc = spec.signatures?.some((s) =>
      s.parameters?.some((p) => Boolean(p.description)),
    );
    if (!hasParamDesc) {
      push({
        fingerprint: 'jsdoc/param-tag',
        axis: 'jsdoc',
        export: spec.name,
        expected: '@param',
        actual: 'not on spec',
        loc,
      });
    }
  }

  const docs = ts.displayPartsToString(docParts).trim();
  if (docs && !spec.description) {
    push({
      fingerprint: 'jsdoc/description',
      axis: 'jsdoc',
      export: spec.name,
      expected: docs.slice(0, 80),
      actual: 'no description',
      loc,
    });
  }
}

function compareResolution(
  spec: OpenPkg,
  typeById: Map<string, { id: string; name: string; external?: boolean; source?: { file?: string } }>,
  entryDir: string,
  push: (f: Finding) => void,
  sizes: Record<Axis, number>,
): void {
  const refs = new Set<string>();
  const empty: string[] = [];
  walk(spec, (node, trail) => {
    if (isEmptySchema(node)) empty.push(trail);
    if (node && typeof node === 'object' && !Array.isArray(node) && '$ref' in node) {
      const ref = (node as { $ref?: string }).$ref;
      if (typeof ref === 'string') refs.add(ref.replace('#/types/', ''));
    }
  });

  sizes.resolution += spec.exports.length;

  for (const t of spec.types ?? []) {
    if (!t.external) continue;
    const file = t.source?.file;
    if (!file || file.includes(`${path.sep}node_modules${path.sep}`)) continue;
    const resolved = path.isAbsolute(file) ? file : path.resolve(entryDir, file);
    if (resolved.startsWith(entryDir)) {
      push({
        fingerprint: 'resolution/in-package-stub',
        axis: 'resolution',
        export: t.name,
        expected: 'in-package type expanded',
        actual: 'external: true',
        loc: file,
      });
    }
  }

  for (const id of refs) {
    if (typeById.has(id)) continue;
    if (spec.exports.some((e) => e.id === id || e.name === id)) continue;
    push({
      fingerprint: 'resolution/dangling-ref',
      axis: 'resolution',
      expected: `#/types/${id}`,
      actual: 'unresolved',
    });
  }

  if (empty.length > 0) {
    push({
      fingerprint: 'resolution/empty-schema',
      axis: 'resolution',
      expected: 'non-empty schema',
      actual: `${empty.length} empty object(s)`,
    });
  }
}

function isEmptySchema(schema: SpecSchema | undefined): boolean {
  if (schema === undefined || schema === null) return false;
  if (typeof schema !== 'object' || Array.isArray(schema)) return false;
  return Object.keys(schema).length === 0;
}

function walk(node: unknown, visit: (n: unknown, trail: string) => void, trail = '$'): void {
  visit(node, trail);
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, visit, `${trail}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    walk(v, visit, `${trail}.${k}`);
  }
}

export const ISSUE_TITLES: Record<string, string> = {
  'robustness/oom': 'extract hits the memory cap',
  'robustness/timeout': 'extract exceeds the time budget',
  'robustness/crash': 'extract crashes',
  'coverage/star-reexport': 'named re-export through an export * barrel is dropped',
  'coverage/export-as': 'export { x as y } is dropped or keeps the original name',
  'coverage/export-star': 'export * is dropped',
  'coverage/export-equals': 'export = is dropped',
  'coverage/default': 'default export is dropped',
  'coverage/missing': 'exported name is missing from the spec',
  'kind/callable-const': 'const typed as a callable interface loses signatures',
  'kind/namespace': 'namespace export has the wrong kind',
  'signatures/overload-drop': 'call overloads are dropped',
  'signatures/arity-mismatch': 'parameter count does not match the checker',
  'signatures/empty-return': 'return schema is empty',
  'signatures/generic-arity': 'generic instantiation is dropped from a return type',
  'signatures/typeparam-drop': 'type parameters are dropped',
  'resolution/in-package-stub': 'in-package type recorded as external: true',
  'resolution/dangling-ref': 'spec $ref does not resolve',
  'resolution/empty-schema': 'empty schema object',
  'roundtrip/undefined-as-null': 'undefined encoded as null',
  'roundtrip/utility-over-typeparam': 'utility type over a type parameter collapses',
  'roundtrip/generic-arity': 'generic return collapses',
  'roundtrip/empty-return': 'rendered return is empty',
  'defaults/param-initializer': 'parameter initializer is missing from the spec',
  'members/missing-public': 'public class/interface members are missing',
  'jsdoc/deprecated': '@deprecated did not make it into the spec',
  'jsdoc/example': '@example did not make it into the spec',
  'jsdoc/param-tag': '@param did not make it into the spec',
  'jsdoc/description': 'JSDoc description is missing from the spec',
};
