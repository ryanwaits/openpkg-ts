import type { SpecExport, SpecSchema } from '@openpkg-ts/spec';
import type { StandardSchemaExtractionResult } from '../schema/standard-schema';

export interface SchemaMergeResult {
  merged: number;
  exports: SpecExport[];
}

export function mergeRuntimeSchemas(
  staticExports: SpecExport[],
  runtimeSchemas: Map<string, StandardSchemaExtractionResult>,
): SchemaMergeResult {
  let merged = 0;

  const exports = staticExports.map((exp) => {
    const runtime = runtimeSchemas.get(exp.name);
    if (!runtime) return exp;

    merged++;

    const mergedExport: SpecExport = {
      ...exp,
      schema: runtime.outputSchema as SpecSchema,
      tags: [
        ...(exp.tags || []),
        { name: 'vendor', text: runtime.vendor },
        { name: 'schema-source', text: 'standard-json-schema' },
      ],
    };

    if (
      runtime.inputSchema &&
      JSON.stringify(runtime.inputSchema) !== JSON.stringify(runtime.outputSchema)
    ) {
      mergedExport.flags = {
        ...mergedExport.flags,
        inputSchema: runtime.inputSchema,
      };
    }

    return mergedExport;
  });

  return { merged, exports };
}
