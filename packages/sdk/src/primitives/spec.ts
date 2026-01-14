/**
 * Extract full spec from a TypeScript entry point
 * Re-exports the main extract function as extractSpec
 */
import { extract } from '../builder/spec-builder';
import type { ExtractOptions, ExtractResult } from '../types';

export type { ExtractOptions, ExtractResult };

/**
 * Extract full OpenPkg spec from a TypeScript entry point
 *
 * @example
 * ```typescript
 * import { extractSpec } from '@openpkg-ts/sdk';
 *
 * const result = await extractSpec({
 *   entryFile: './src/index.ts'
 * });
 *
 * console.log(result.spec.exports.length);
 * ```
 */
export const extractSpec: (options: ExtractOptions) => Promise<ExtractResult> = extract;
