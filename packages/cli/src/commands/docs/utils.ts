import * as fs from 'node:fs';
import * as path from 'node:path';

type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn';

interface ExecCommand {
  cmd: string;
  args: string[];
}

/**
 * Detect package manager from lockfiles or package.json packageManager field
 */
export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  // Check package.json packageManager field first
  const pkgJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.packageManager) {
        if (pkg.packageManager.startsWith('bun')) return 'bun';
        if (pkg.packageManager.startsWith('pnpm')) return 'pnpm';
        if (pkg.packageManager.startsWith('yarn')) return 'yarn';
        if (pkg.packageManager.startsWith('npm')) return 'npm';
      }
    } catch {
      // ignore parse errors
    }
  }

  // Check lockfiles
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }

  return 'npm';
}

/**
 * Get the dlx/exec command for running a package
 */
export function getDlxCommand(pkg: string, pm?: PackageManager): ExecCommand {
  const packageManager = pm || detectPackageManager();

  switch (packageManager) {
    case 'bun':
      return { cmd: 'bunx', args: [pkg] };
    case 'pnpm':
      return { cmd: 'pnpm', args: ['dlx', pkg] };
    case 'yarn':
      return { cmd: 'yarn', args: ['dlx', pkg] };
    default:
      return { cmd: 'npx', args: [pkg] };
  }
}

/**
 * Get full command array for shadcn CLI
 */
export function getShadcnCommand(subcommand: string, args: string[] = []): { cmd: string; args: string[] } {
  const dlx = getDlxCommand('shadcn@latest');
  return {
    cmd: dlx.cmd,
    args: [...dlx.args, subcommand, ...args],
  };
}
