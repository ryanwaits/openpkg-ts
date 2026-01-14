import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

/**
 * Check if file is a JavaScript file
 */
function isJsFile(file: string): boolean {
  return /\.(js|mjs|cjs|jsx)$/.test(file);
}

/**
 * Get appropriate ScriptKind based on file extension
 */
function getScriptKind(file: string): ts.ScriptKind {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.CommonJS,
  lib: ['lib.es2021.d.ts'],
  declaration: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
};

export interface ProgramOptions {
  entryFile: string;
  baseDir?: string;
  content?: string;
}

export interface ProgramResult {
  program: ts.Program;
  compilerHost: ts.CompilerHost;
  compilerOptions: ts.CompilerOptions;
  sourceFile?: ts.SourceFile;
  configPath?: string;
  /** Resolved project references (workspace packages) */
  projectReferences?: ts.ResolvedProjectReference[];
}

/**
 * Maps workspace package names to their source directories.
 * Used to resolve re-exports from workspace packages.
 */
export interface WorkspaceMap {
  /** Package name -> source directory path */
  packages: Map<string, string>;
  /** Root directory of the workspace */
  rootDir: string;
}

/**
 * Resolve project references from tsconfig.json.
 * Returns entry files from each referenced project.
 */
function resolveProjectReferences(
  configPath: string,
  parsedConfig: ts.ParsedCommandLine,
): string[] {
  const additionalFiles: string[] = [];

  if (!parsedConfig.projectReferences?.length) {
    return additionalFiles;
  }

  const configDir = path.dirname(configPath);

  for (const ref of parsedConfig.projectReferences) {
    const refPath = path.resolve(configDir, ref.path);
    const refConfigPath = fs.existsSync(path.join(refPath, 'tsconfig.json'))
      ? path.join(refPath, 'tsconfig.json')
      : refPath;

    if (!fs.existsSync(refConfigPath)) continue;

    const refConfigFile = ts.readConfigFile(refConfigPath, ts.sys.readFile);
    if (refConfigFile.error) continue;

    const refParsed = ts.parseJsonConfigFileContent(
      refConfigFile.config,
      ts.sys,
      path.dirname(refConfigPath),
    );

    // Add all source files from referenced project
    additionalFiles.push(...refParsed.fileNames);
  }

  return additionalFiles;
}

/**
 * Parse pnpm-workspace.yaml to extract package globs.
 * Simple parser that handles the common "packages:" format.
 */
function parsePnpmWorkspace(yamlContent: string): string[] {
  const globs: string[] = [];
  const lines = yamlContent.split('\n');
  let inPackages = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'packages:') {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      // Stop at next top-level key or empty line with no indent
      if (!line.startsWith(' ') && !line.startsWith('-') && trimmed) {
        break;
      }
      // Parse list items like "  - 'packages/*'"
      const match = trimmed.match(/^-\s*['"]?([^'"]+)['"]?$/);
      if (match) {
        globs.push(match[1]);
      }
    }
  }
  return globs;
}

/**
 * Build a workspace map from package.json workspaces or pnpm-workspace.yaml.
 * Maps package names to their source directories for module resolution.
 */
function buildWorkspaceMap(baseDir: string): WorkspaceMap | undefined {
  // Walk up to find workspace root
  let currentDir = baseDir;
  let rootDir: string | undefined;
  let workspaceGlobs: string[] = [];

  for (let i = 0; i < 10; i++) {
    // Check for pnpm-workspace.yaml first (more common in monorepos)
    const pnpmPath = path.join(currentDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(pnpmPath)) {
      try {
        const yamlContent = fs.readFileSync(pnpmPath, 'utf-8');
        workspaceGlobs = parsePnpmWorkspace(yamlContent);
        if (workspaceGlobs.length > 0) {
          rootDir = currentDir;
          break;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for package.json with workspaces
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.workspaces) {
          rootDir = currentDir;
          workspaceGlobs = Array.isArray(pkg.workspaces)
            ? pkg.workspaces
            : pkg.workspaces?.packages || [];
          break;
        }
      } catch {
        // Ignore parse errors
      }
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  if (!rootDir || workspaceGlobs.length === 0) return undefined;

  const packages = new Map<string, string>();

  // Resolve workspace globs (simple patterns like "packages/*")
  for (const glob of workspaceGlobs) {
    // Handle patterns like "packages/*" -> check "packages/" directory
    const globDir = path.join(rootDir, glob.replace(/\/\*$/, ''));
    if (!fs.existsSync(globDir) || !fs.statSync(globDir).isDirectory()) continue;

    const entries = fs.readdirSync(globDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgDir = path.join(globDir, entry.name);
      const pkgJsonPath = path.join(pkgDir, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkg.name) {
          // Find source directory
          const srcDir = fs.existsSync(path.join(pkgDir, 'src'))
            ? path.join(pkgDir, 'src')
            : pkgDir;
          packages.set(pkg.name, srcDir);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return packages.size > 0 ? { packages, rootDir } : undefined;
}

export function createProgram({
  entryFile,
  baseDir = path.dirname(entryFile),
  content,
}: ProgramOptions): ProgramResult {
  // Look for tsconfig.json first, fallback to jsconfig.json
  let configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    configPath = ts.findConfigFile(baseDir, ts.sys.fileExists, 'jsconfig.json');
  }
  let compilerOptions: ts.CompilerOptions = { ...DEFAULT_COMPILER_OPTIONS };
  let additionalRootFiles: string[] = [];

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );
    compilerOptions = { ...compilerOptions, ...parsedConfig.options };

    // Resolve project references (workspace packages)
    additionalRootFiles = resolveProjectReferences(configPath, parsedConfig);
  }

  // Handle JS/TS compiler options conflict
  if (isJsFile(entryFile)) {
    // For JS files: enable allowJs/checkJs, disable isolatedDeclarations (conflicts)
    compilerOptions = {
      ...compilerOptions,
      allowJs: true,
      checkJs: true,
      isolatedDeclarations: false,
    };
  } else {
    // For TS files: avoid TS5053 (allowJs cannot be specified with isolatedDeclarations)
    const allowJsVal = (compilerOptions as Record<string, unknown>).allowJs;
    if (typeof allowJsVal === 'boolean' && allowJsVal) {
      compilerOptions = { ...compilerOptions, allowJs: false, checkJs: false };
    }
  }

  // Build workspace map for module resolution
  const workspaceMap = buildWorkspaceMap(baseDir);

  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  let inMemorySource: ts.SourceFile | undefined;

  // Wrap module resolution to handle workspace packages
  if (workspaceMap) {
    const originalResolveModuleNames = compilerHost.resolveModuleNames?.bind(compilerHost);
    compilerHost.resolveModuleNames = (
      moduleNames: string[],
      containingFile: string,
      _reusedNames: string[] | undefined,
      redirectedReference: ts.ResolvedProjectReference | undefined,
      options: ts.CompilerOptions,
    ): (ts.ResolvedModule | undefined)[] => {
      return moduleNames.map((moduleName) => {
        // Check if this is a workspace package
        const srcDir = workspaceMap.packages.get(moduleName);
        if (srcDir) {
          // Try to resolve to the package's index file
          const indexFile = path.join(srcDir, 'index.ts');
          if (fs.existsSync(indexFile)) {
            return { resolvedFileName: indexFile, isExternalLibraryImport: false };
          }
        }

        // Fall back to standard resolution
        if (originalResolveModuleNames) {
          const result = originalResolveModuleNames(
            [moduleName],
            containingFile,
            _reusedNames,
            redirectedReference,
            options,
          );
          return result[0];
        }

        // Use TypeScript's built-in resolution
        const resolved = ts.resolveModuleName(moduleName, containingFile, options, compilerHost);
        return resolved.resolvedModule;
      });
    };
  }

  if (content !== undefined) {
    inMemorySource = ts.createSourceFile(
      entryFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(entryFile),
    );

    const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);

    compilerHost.getSourceFile = (
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) => {
      if (fileName === entryFile) {
        return inMemorySource;
      }
      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };
  }

  // Include entry file plus all files from referenced projects
  const rootFiles = [entryFile, ...additionalRootFiles];
  const program = ts.createProgram(rootFiles, compilerOptions, compilerHost);
  const sourceFile = inMemorySource ?? program.getSourceFile(entryFile);

  return {
    program,
    compilerHost,
    compilerOptions,
    sourceFile,
    configPath,
  };
}
