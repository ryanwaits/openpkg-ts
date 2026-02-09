import {
  buildImportStatement,
  buildSignatureString,
  formatSchema,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specSchemaToAPISchema,
} from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import type { PreparedExport, PreparedSpecData } from '../types';

function prepareExport(exp: SpecExport, spec: OpenPkg): PreparedExport {
  const sig = exp.signatures?.[0];
  const params = sig?.parameters ?? [];
  const rawExamples = exp.examples || sig?.examples || [];
  const examples = specExamplesToCodeExamples(rawExamples);
  const languages = getLanguagesFromExamples(rawExamples);
  const returnType = sig?.returns?.schema;

  return {
    id: exp.id,
    name: exp.name,
    kind: exp.kind,
    title: exp.kind === 'function' ? `${exp.name}()` : exp.name,
    signature: buildSignatureString(exp),
    description: exp.description || sig?.description,
    parameters: params,
    examples,
    languages,
    returnType,
    returnTypeString: returnType ? formatSchema(returnType) : undefined,
    returnDescription: sig?.returns?.description,
    importStatement: buildImportStatement(exp, spec),
    parameterSchema: params.length > 0 ? specSchemaToAPISchema(params[0]?.schema) : undefined,
    isAsync: !!(exp.flags as Record<string, unknown> | undefined)?.async,
    rawExport: exp,
  };
}

/** Transform an OpenPkg spec into a flat lookup table ready for rendering */
export function prepareSpecData(spec: OpenPkg): PreparedSpecData {
  const exports: Record<string, PreparedExport> = {};
  const exportsByKind: Record<string, PreparedExport[]> = {};
  const allExportIds: string[] = [];

  for (const exp of spec.exports) {
    const prepared = prepareExport(exp, spec);
    exports[exp.id] = prepared;
    allExportIds.push(exp.id);

    if (!exportsByKind[exp.kind]) exportsByKind[exp.kind] = [];
    exportsByKind[exp.kind].push(prepared);
  }

  return {
    packageName: spec.meta?.name || 'package',
    packageDescription: spec.meta?.description,
    exports,
    exportsByKind,
    allExportIds,
    types: spec.types,
  };
}
