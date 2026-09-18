import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { EntryPointDetectionMethod } from '@openpkg-ts/spec';
import picomatch from 'picomatch';
import { type EvaluateFn, JEV_CONFIDENCE, jevChoice, loadEvaluate } from './decisions';

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

export type CloneFn = (input: string) => Promise<string>;

export type ResolveTargetOptions = {
  input?: string;
  intent?: string;
  cwd?: string;
  decisions?: 'heuristic' | 'jev';
  evaluate?: EvaluateFn;
  clone?: CloneFn;
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

export type ResolveExplicit = {
  kind: 'explicit';
  entryFile: string;
  entryPointSource: 'explicit';
};

export type ResolveUnavailable = {
  kind: 'unavailable';
  reason: string;
};

export type ResolveTargetResult = (
  | ResolveOk
  | ResolveAmbiguous
  | ResolveNeedsBuild
  | ResolveEmpty
  | ResolveExplicit
  | ResolveUnavailable
) & {
  /** Present when this resolution owns a temp clone. Call after extraction. */
  cleanup?: () => void;
};

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

/** Absolute, explicit relative, slash-containing, or entry-file paths — not bare intent words. */
export function isPathLikeInput(input: string): boolean {
  if (!input) return false;
  if (path.isAbsolute(input)) return true;
  if (input.startsWith('./') || input.startsWith('../')) return true;
  if (input.includes('/') || input.includes('\\')) return true;
  return isEntryFilePath(input);
}

export function parseGithubRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/, '');
  const https = trimmed.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (!https) return null;
  return { owner: https[1], repo: https[2] };
}

function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr.trim() || code}`));
    });
  });
}

function whichCmd(cmd: string): boolean {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(checker, [cmd], { stdio: 'ignore' }).status === 0;
}

export async function cloneRemote(input: string): Promise<string> {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-'));
  const github = parseGithubRepo(input);
  try {
    if (github && whichCmd('gh')) {
      await runCmd('gh', [
        'repo',
        'clone',
        `${github.owner}/${github.repo}`,
        dest,
        '--',
        '--depth',
        '1',
      ]);
    } else {
      const url = input.startsWith('github.com/') ? `https://${input}` : input;
      await runCmd('git', ['clone', '--depth', '1', url, dest]);
    }
  } catch (err) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw err;
  }
  return dest;
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

/** True for real directories and directory symlinks (pnpm). Dirent.isDirectory() is false for the latter. */
function isDirentDir(parent: string, entry: fs.Dirent): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return fs.statSync(path.join(parent, entry.name)).isDirectory();
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

function expandWorkspaceGlobs(root: string, globs: string[]): string[] {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const g of globs) {
    if (g.startsWith('!')) exclude.push(g.slice(1));
    else include.push(g);
  }
  if (!include.length) return [];

  const dirs: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (dirs.length >= MAX_PACKAGES || depth > 12) return;
    if (existsFile(path.join(dir, 'package.json'))) dirs.push(dir);
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      if (!isDirentDir(dir, ent)) continue;
      walk(path.join(dir, ent.name), depth + 1);
    }
  };
  walk(root, 0);

  const isMatch = picomatch(include, { ignore: exclude, dot: false, nocase: false });
  return dirs.filter((dir) => {
    const rel = path.relative(root, dir).split(path.sep).join('/');
    if (!rel || rel === '.') return include.includes('.');
    return isMatch(rel);
  });
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
    for (const dir of expandWorkspaceGlobs(root, globs)) add(dir);
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
  if (pkg.exports != null) {
    const exp = pkg.exports;
    const root =
      typeof exp === 'object' && exp !== null && !Array.isArray(exp) && '.' in exp
        ? (exp as Record<string, unknown>)['.']
        : exp;
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

function listEntryCandidates(pkgDir: string): Candidate[] {
  const pkg = readJson(path.join(pkgDir, 'package.json')) ?? {};
  return collectCandidates(pkgDir, pkg);
}

function isIgnoredPath(dir: string): boolean {
  const norm = dir.split(path.sep).join('/');
  return /\/(examples|fixtures|__tests__|test-fixtures)(\/|$)/.test(norm);
}

function isExtractable(pkg: PackageRecord): boolean {
  if (pkg.private) return false;
  if (isIgnoredPath(pkg.dir)) return false;
  return pickEntry(pkg.dir) !== null;
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

type ResolveCtx = {
  decisions: 'heuristic' | 'jev';
  evaluate?: EvaluateFn;
  intent?: string;
};

function head(abs: string, maxChars = 1200): string {
  try {
    return fs.readFileSync(abs, 'utf8').slice(0, maxChars);
  } catch {
    return '';
  }
}

/** Abstain key: a peer-library monorepo has no single product to pick. */
const PACKAGE_NONE = 'none';

async function jevPickPackage(
  candidates: PackageRecord[],
  ctx: ResolveCtx,
): Promise<PackageRecord | null> {
  if (!ctx.evaluate || candidates.length < 2) return null;
  const criteria: Record<string, string> = {};
  const byId = new Map<string, PackageRecord>();
  for (const [i, pkg] of candidates.entries()) {
    const id = `p${i}`;
    byId.set(id, pkg);
    criteria[id] = `${pkg.name} — ${pkg.description ?? pkg.dir}${pkg.hasSrc ? ' (src)' : ''}`;
  }
  criteria[PACKAGE_NONE] = 'No single package is the product — these are peer libraries';
  const picked = await jevChoice({
    evaluate: ctx.evaluate,
    instructions:
      'Which package is the public TypeScript SDK to extract? Prefer the named product, not examples, wasm glue, or private packages.',
    criteria,
    state: {
      intent: ctx.intent ?? null,
      catalog: candidates.map((p, i) => ({
        id: `p${i}`,
        name: p.name,
        description: p.description ?? null,
        hasSrc: p.hasSrc,
        hasDist: p.hasDist,
        types: p.types ?? p.typings ?? null,
        private: p.private,
      })),
    },
    id: 'package',
  });
  if (!picked || picked.choice === PACKAGE_NONE) return null;
  if (picked.confidence < JEV_CONFIDENCE) return null;
  return byId.get(picked.choice) ?? null;
}

async function jevPickEntry(cands: Candidate[], ctx: ResolveCtx): Promise<Candidate | null> {
  if (!ctx.evaluate || cands.length < 2) return null;
  const criteria: Record<string, string> = {};
  const byId = new Map<string, Candidate>();
  for (const [i, c] of cands.entries()) {
    const id = `c${i}`;
    byId.set(id, c);
    criteria[id] = `${c.rel} (${c.source})`;
  }
  const picked = await jevChoice({
    evaluate: ctx.evaluate,
    instructions:
      'Which file is the best OpenPkg entry point? Prefer TypeScript source over .d.ts/.js. Prefer the package root public API.',
    criteria,
    state: {
      candidates: cands.map((c, i) => ({
        id: `c${i}`,
        path: c.rel,
        source: c.source,
        head: head(c.abs),
      })),
    },
    id: 'entry',
  });
  if (!picked || picked.confidence < JEV_CONFIDENCE) return null;
  return byId.get(picked.choice) ?? null;
}

async function finishPackage(pkg: PackageRecord, ctx: ResolveCtx): Promise<ResolveTargetResult> {
  const cands = listEntryCandidates(pkg.dir);
  if (!cands.length) {
    return {
      kind: 'needs-build',
      package: pkg,
      reason: `no TypeScript entry found in ${pkg.name}`,
      ...(buildCommand(pkg) ? { command: buildCommand(pkg) } : {}),
    };
  }
  const heuristic = [...cands].sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  let chosen = heuristic;
  let source = methodFor(heuristic);
  if (ctx.decisions === 'jev' && cands.length >= 2) {
    const jev = await jevPickEntry(cands, ctx);
    if (jev) {
      chosen = jev;
      source = 'llm';
    }
  }
  return {
    kind: 'ok',
    package: pkg,
    entryFile: chosen.abs,
    entryPointSource: source,
  };
}

async function resolveLocal(
  abs: string,
  startDir: string,
  ctx: ResolveCtx,
): Promise<ResolveTargetResult> {
  const catalog = catalogPackages(startDir);
  if (!catalog.length) {
    return { kind: 'empty', reason: 'no JS/TS packages found' };
  }

  const root = findWorkspaceRoot(startDir);
  const pointed = catalog.find((p) => p.dir === abs);
  if (pointed && (isExtractable(pointed) || pointed.dir !== root)) {
    return finishPackage(pointed, ctx);
  }

  const intent = ctx.intent;
  if (intent) {
    const scored = catalog
      .map((p) => ({ p, n: intentScore(p, intent) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    if (!scored.length) {
      return { kind: 'empty', reason: `no package matched intent "${intent}"` };
    }
    const top = scored.filter((x) => x.n === scored[0].n).map((x) => x.p);
    if (top.length === 1) return finishPackage(top[0], ctx);
    if (ctx.decisions === 'jev') {
      const jev = await jevPickPackage(top, ctx);
      if (jev) return finishPackage(jev, ctx);
    }
    return { kind: 'ambiguous', candidates: top };
  }

  const enclosed = enclosingPackage(startDir, catalog);
  if (enclosed && enclosed.dir !== root) return finishPackage(enclosed, ctx);

  const extractable = catalog.filter(isExtractable);
  if (extractable.length === 1) return finishPackage(extractable[0], ctx);
  if (extractable.length > 1) {
    if (ctx.decisions === 'jev') {
      const jev = await jevPickPackage(extractable, ctx);
      if (jev) return finishPackage(jev, ctx);
    }
    return { kind: 'ambiguous', candidates: extractable };
  }
  if (catalog.length === 1) return finishPackage(catalog[0], ctx);
  return { kind: 'empty', reason: 'no extractable JS/TS packages found' };
}

export async function resolveTarget(
  options: ResolveTargetOptions = {},
): Promise<ResolveTargetResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const raw = options.input?.trim() || cwd;
  const decisions = options.decisions ?? 'heuristic';
  const ctx: ResolveCtx = {
    decisions,
    evaluate: options.evaluate,
    intent: options.intent?.trim() || undefined,
  };

  if (decisions === 'jev' && !ctx.evaluate) {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return {
        kind: 'unavailable',
        reason:
          '--jev requires AI_GATEWAY_API_KEY\n  https://vercel.com/docs/ai-gateway\n  omit --jev to stay local',
      };
    }
    try {
      ctx.evaluate = await loadEvaluate();
    } catch (err) {
      return { kind: 'unavailable', reason: err instanceof Error ? err.message : String(err) };
    }
  }

  if (isRemoteInput(raw)) {
    const owned = !options.clone;
    try {
      const cloned = await (options.clone ?? cloneRemote)(raw);
      const result = await resolveLocal(cloned, cloned, ctx);
      if (!owned) return result;
      return {
        ...result,
        cleanup: () => fs.rmSync(cloned, { recursive: true, force: true }),
      };
    } catch (err) {
      return {
        kind: 'empty',
        reason: `failed to clone ${raw}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const abs = path.resolve(cwd, raw);

  if (existsFile(abs) && isEntryFilePath(abs)) {
    return { kind: 'explicit', entryFile: abs, entryPointSource: 'explicit' };
  }

  if (!existsFile(abs) && !existsDir(abs) && isPathLikeInput(options.input?.trim() || raw)) {
    return { kind: 'empty', reason: `input does not exist: ${options.input?.trim() || raw}` };
  }

  const startDir = existsDir(abs) ? abs : cwd;
  return resolveLocal(abs, startDir, ctx);
}
