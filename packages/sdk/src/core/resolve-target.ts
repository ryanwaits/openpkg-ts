import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EntryPointDetectionMethod } from '@openpkg-ts/spec';

export type PackageRecord = {
  name: string;
  dir: string;
  private: boolean;
  description?: string;
  types?: string;
  typings?: string;
  main?: string;
  module?: string;
  hasSrc: boolean;
  hasDist: boolean;
  scripts: string[];
};

export type ResolveTargetOptions = {
  input?: string;
  intent?: string;
  cwd?: string;
};

export type ResolveOk = {
  kind: 'ok';
  package: PackageRecord;
  entryFile: string;
  entryPointSource: EntryPointDetectionMethod;
};

export type ResolveAmbiguous = {
  kind: 'ambiguous';
  candidates: PackageRecord[];
};

export type ResolveNeedsBuild = {
  kind: 'needs-build';
  package: PackageRecord;
  reason: string;
  command?: string;
};

export type ResolveEmpty = {
  kind: 'empty';
  reason: string;
};

export type ResolveRemote = {
  kind: 'remote';
  input: string;
};

export type ResolveExplicit = {
  kind: 'explicit';
  entryFile: string;
  entryPointSource: 'explicit';
};

export type ResolveTargetResult =
  | ResolveOk
  | ResolveAmbiguous
  | ResolveNeedsBuild
  | ResolveEmpty
  | ResolveRemote
  | ResolveExplicit;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'target', 'coverage', '.next', 'out']);
const CONV = ['src/index.ts', 'src/index.tsx', 'src/index.mts', 'index.ts', 'index.tsx'];
const ENTRY_EXT = /\.(c|m)?[tj]sx?$/;
const MAX_PACKAGES = 200;

export function isRemoteInput(input: string): boolean {
  return /^(https?:\/\/|git@|github\.com\/)/i.test(input);
}

export function isEntryFilePath(input: string): boolean {
  return ENTRY_EXT.test(input) || /\.d\.(ts|mts|cts)$/.test(input);
}

type Candidate = {
  rel: string;
  abs: string;
  source: string;
};

function existsFile(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function existsDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parsePnpmWorkspace(yaml: string): string[] {
  const globs: string[] = [];
  const lines = yaml.split('\n');
  let inPackages = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'packages:') {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (!line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('-') && trimmed) {
        break;
      }
      const match = trimmed.match(/^-\s*['"]?([^'"]+)['"]?$/);
      if (match) globs.push(match[1]);
    }
  }
  return globs;
}

function expandGlob(root: string, pattern: string): string[] {
  const parts = pattern.split('/').filter(Boolean);
  const out: string[] = [];
  const walk = (dir: string, i: number) => {
    if (out.length >= MAX_PACKAGES) return;
    if (i === parts.length) {
      if (existsFile(path.join(dir, 'package.json'))) out.push(dir);
      return;
    }
    const part = parts[i];
    if (!existsDir(dir)) return;
    if (part === '**') {
      walk(dir, i + 1);
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        if (!ent.isDirectory() || SKIP_DIRS.has(ent.name)) continue;
        walk(path.join(dir, ent.name), i);
      }
      return;
    }
    if (part === '*') {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        if (!ent.isDirectory() || SKIP_DIRS.has(ent.name)) continue;
        walk(path.join(dir, ent.name), i + 1);
      }
      return;
    }
    walk(path.join(dir, part), i + 1);
  };
  walk(root, 0);
  return out;
}

function workspaceGlobs(dir: string): string[] | null {
  const pnpm = path.join(dir, 'pnpm-workspace.yaml');
  if (existsFile(pnpm)) {
    const globs = parsePnpmWorkspace(fs.readFileSync(pnpm, 'utf-8'));
    if (globs.length) return globs;
  }
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg) return null;
  const ws = pkg.workspaces;
  if (Array.isArray(ws) && ws.every((x) => typeof x === 'string')) return ws as string[];
  if (ws && typeof ws === 'object' && Array.isArray((ws as { packages?: unknown }).packages)) {
    return ((ws as { packages: string[] }).packages ?? []).filter((x) => typeof x === 'string');
  }
  return null;
}

export function findWorkspaceRoot(start: string): string | undefined {
  let dir = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    const globs = workspaceGlobs(dir);
    if (globs?.length) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function toRecord(dir: string): PackageRecord | null {
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg) return null;
  const name = typeof pkg.name === 'string' ? pkg.name : path.basename(dir);
  const scripts =
    pkg.scripts && typeof pkg.scripts === 'object'
      ? Object.keys(pkg.scripts as Record<string, unknown>)
      : [];
  return {
    name,
    dir,
    private: pkg.private === true,
    ...(typeof pkg.description === 'string' ? { description: pkg.description } : {}),
    ...(typeof pkg.types === 'string' ? { types: pkg.types } : {}),
    ...(typeof pkg.typings === 'string' ? { typings: pkg.typings } : {}),
    ...(typeof pkg.main === 'string' ? { main: pkg.main } : {}),
    ...(typeof pkg.module === 'string' ? { module: pkg.module } : {}),
    hasSrc: CONV.some((c) => existsFile(path.join(dir, c))),
    hasDist: existsDir(path.join(dir, 'dist')),
    scripts,
  };
}

export function catalogPackages(start: string): PackageRecord[] {
  const abs = path.resolve(start);
  const root = findWorkspaceRoot(abs) ?? abs;
  const seen = new Set<string>();
  const out: PackageRecord[] = [];
  const add = (dir: string) => {
    const resolved = path.resolve(dir);
    if (seen.has(resolved) || out.length >= MAX_PACKAGES) return;
    const rec = toRecord(resolved);
    if (!rec) return;
    seen.add(resolved);
    out.push(rec);
  };

  const globs = workspaceGlobs(root);
  if (globs?.length) {
    for (const glob of globs) {
      for (const dir of expandGlob(root, glob)) add(dir);
    }
  }

  let dir = abs;
  for (let i = 0; i < 8; i++) {
    if (existsFile(path.join(dir, 'package.json'))) {
      add(dir);
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return out;
}

function collectFromExports(value: unknown, out: string[], depth = 0) {
  if (depth > 4 || value == null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectFromExports(v, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['types', 'import', 'default', 'require', 'node', 'browser', 'module']) {
      if (key in obj) collectFromExports(obj[key], out, depth + 1);
    }
  }
}

function collectCandidates(pkgDir: string, pkg: Record<string, unknown>): Candidate[] {
  const seen = new Map<string, Candidate>();
  const add = (rel: string, source: string) => {
    const abs = path.resolve(pkgDir, rel);
    if (!existsFile(abs)) return;
    const norm = path.relative(pkgDir, abs).split(path.sep).join('/');
    const prev = seen.get(norm);
    if (!prev) seen.set(norm, { rel: norm, abs, source });
    else if (!prev.source.includes(source)) prev.source += `, ${source}`;
  };
  if (typeof pkg.types === 'string') add(pkg.types, 'types');
  if (typeof pkg.typings === 'string') add(pkg.typings, 'typings');
  if (pkg.exports && typeof pkg.exports === 'object') {
    const exp = pkg.exports as Record<string, unknown>;
    const root = '.' in exp ? exp['.'] : exp;
    const paths: string[] = [];
    collectFromExports(root, paths);
    for (const p of paths) add(p, 'exports');
  }
  if (typeof pkg.module === 'string') add(pkg.module, 'module');
  if (typeof pkg.main === 'string') add(pkg.main, 'main');
  for (const c of CONV) add(c, 'convention');
  return [...seen.values()];
}

function scoreCandidate(c: Candidate): number {
  const ts = /\.(ts|tsx|mts)$/.test(c.rel) && !/\.d\.(ts|mts|cts)$/.test(c.rel);
  const dts = /\.d\.(ts|mts|cts)$/.test(c.rel);
  const src = c.rel.startsWith('src/');
  let n = 0;
  if (ts) n += 40;
  if (src && ts) n += 20;
  if (c.source.includes('types') || c.source.includes('typings')) n += dts ? 5 : 10;
  if (c.source.includes('exports')) n += 8;
  if (c.source.includes('convention')) n += ts ? 15 : 2;
  if (c.source.includes('module')) n += 4;
  if (c.source.includes('main')) n += 2;
  if (dts) n -= 15;
  if (/\.(js|mjs|cjs)$/.test(c.rel)) n -= 20;
  return n;
}

function methodFor(c: Candidate): EntryPointDetectionMethod {
  if (c.source.includes('convention') && /\.(ts|tsx|mts)$/.test(c.rel) && !c.rel.includes('.d.')) {
    return 'fallback';
  }
  if (c.source.includes('types') || c.source.includes('typings')) return 'types';
  if (c.source.includes('exports')) return 'exports';
  if (c.source.includes('module')) return 'module';
  if (c.source.includes('main')) return 'main';
  return 'fallback';
}

export function pickEntry(
  pkgDir: string,
): { entryFile: string; entryPointSource: EntryPointDetectionMethod } | null {
  const pkg = readJson(path.join(pkgDir, 'package.json')) ?? {};
  const cands = collectCandidates(pkgDir, pkg);
  if (!cands.length) return null;
  const best = [...cands].sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  return { entryFile: best.abs, entryPointSource: methodFor(best) };
}

function isIgnoredPath(dir: string): boolean {
  const norm = dir.split(path.sep).join('/');
  return /\/(examples|fixtures|__tests__|test-fixtures)(\/|$)/.test(norm);
}

function isExtractable(pkg: PackageRecord): boolean {
  if (pkg.private) return false;
  if (isIgnoredPath(pkg.dir)) return false;
  return pkg.hasSrc || Boolean(pkg.types || pkg.typings);
}

function intentScore(pkg: PackageRecord, intent: string): number {
  const q = intent.toLowerCase().trim();
  if (!q) return 0;
  const words = q.split(/\s+/).filter(Boolean);
  const name = pkg.name.toLowerCase();
  const desc = (pkg.description ?? '').toLowerCase();
  const dir = pkg.dir.split(path.sep).join('/').toLowerCase();
  let n = 0;
  if (name === q || name.endsWith(`/${q}`) || name.split('/').pop() === q) n += 20;
  for (const w of words) {
    if (name.includes(w)) n += 8;
    if (desc.includes(w)) n += 3;
    if (dir.includes(w)) n += 2;
  }
  return n;
}

function enclosingPackage(inputDir: string, catalog: PackageRecord[]): PackageRecord | undefined {
  const abs = path.resolve(inputDir);
  let best: PackageRecord | undefined;
  for (const pkg of catalog) {
    if (abs === pkg.dir || abs.startsWith(pkg.dir + path.sep)) {
      if (!best || pkg.dir.length > best.dir.length) best = pkg;
    }
  }
  return best;
}

function buildCommand(pkg: PackageRecord): string | undefined {
  if (pkg.scripts.includes('build:sdk-wasm')) return 'pnpm run build:sdk-wasm';
  if (pkg.scripts.includes('build')) return 'bun run build';
  return undefined;
}

function finishPackage(pkg: PackageRecord): ResolveTargetResult {
  const picked = pickEntry(pkg.dir);
  if (!picked) {
    return {
      kind: 'needs-build',
      package: pkg,
      reason: `no TypeScript entry found in ${pkg.name}`,
      ...(buildCommand(pkg) ? { command: buildCommand(pkg) } : {}),
    };
  }
  return {
    kind: 'ok',
    package: pkg,
    entryFile: picked.entryFile,
    entryPointSource: picked.entryPointSource,
  };
}

export function resolveTarget(options: ResolveTargetOptions = {}): ResolveTargetResult {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const raw = options.input?.trim() || cwd;

  if (isRemoteInput(raw)) return { kind: 'remote', input: raw };

  const abs = path.resolve(cwd, raw);

  if (existsFile(abs) && isEntryFilePath(abs)) {
    return { kind: 'explicit', entryFile: abs, entryPointSource: 'explicit' };
  }

  const startDir = existsDir(abs) ? abs : cwd;
  const catalog = catalogPackages(startDir);
  if (!catalog.length) {
    return { kind: 'empty', reason: 'no JS/TS packages found' };
  }

  const root = findWorkspaceRoot(startDir);
  const pointed = catalog.find((p) => p.dir === abs);
  if (pointed && (isExtractable(pointed) || pointed.dir !== root)) {
    return finishPackage(pointed);
  }

  const intent = options.intent?.trim();
  if (intent) {
    const scored = catalog
      .map((p) => ({ p, n: intentScore(p, intent) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    if (!scored.length) {
      return { kind: 'empty', reason: `no package matched intent "${intent}"` };
    }
    const top = scored.filter((x) => x.n === scored[0].n).map((x) => x.p);
    if (top.length === 1) return finishPackage(top[0]);
    return { kind: 'ambiguous', candidates: top };
  }

  const enclosed = enclosingPackage(startDir, catalog);
  if (enclosed && enclosed.dir !== root) return finishPackage(enclosed);

  const extractable = catalog.filter(isExtractable);
  if (extractable.length === 1) return finishPackage(extractable[0]);
  if (extractable.length > 1) return { kind: 'ambiguous', candidates: extractable };
  if (catalog.length === 1) return finishPackage(catalog[0]);
  return { kind: 'empty', reason: 'no extractable JS/TS packages found' };
}
