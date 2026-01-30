import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg } from '@openpkg-ts/spec';
import { getValidationErrors } from '@openpkg-ts/spec';

export function handleCommandError(err: unknown): never {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exit(1);
}

export function loadSpec(filePath: string): OpenPkg {
  const resolved = path.resolve(filePath);
  let content: string;
  let spec: unknown;

  try {
    content = fs.readFileSync(resolved, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read spec file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    spec = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Invalid JSON in spec file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const errors = getValidationErrors(spec);
  if (errors.length > 0) {
    const details = errors
      .slice(0, 5)
      .map((e) => `${e.instancePath || '/'}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid OpenPkg spec: ${details}`);
  }

  return spec as OpenPkg;
}
