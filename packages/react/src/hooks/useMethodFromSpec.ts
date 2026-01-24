import { buildSignatureString, formatSchema } from '@openpkg-ts/sdk/browser';
import type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecSchema,
  SpecSignatureParameter,
} from '@openpkg-ts/spec';
import { useMemo } from 'react';

export interface MethodData {
  /** Export data */
  export: SpecExport;
  /** Method title (function name with parens) */
  title: string;
  /** Full signature string */
  signature: string;
  /** Description text */
  description?: string;
  /** Parameters from first signature */
  parameters: SpecSignatureParameter[];
  /** Examples from export or signature */
  examples: SpecExample[];
  /** Return type schema */
  returnType?: SpecSchema;
  /** Return type formatted */
  returnTypeString?: string;
  /** Return description */
  returnDescription?: string;
  /** Is async function */
  isAsync?: boolean;
}

/**
 * Extract method data from a spec export.
 * Provides all data needed to render a MethodSection.
 *
 * @example
 * ```tsx
 * const method = useMethodFromSpec(spec, 'createClient');
 * return (
 *   <MethodSection
 *     id={method.export.id}
 *     title={method.title}
 *     signature={method.signature}
 *     description={method.description}
 *   >
 *     {method.parameters.map(p => <ExpandableParameter parameter={p} />)}
 *   </MethodSection>
 * );
 * ```
 */
export function useMethodFromSpec(spec: OpenPkg, exportName: string): MethodData | null {
  return useMemo(() => {
    const exp = spec.exports.find((e) => e.name === exportName);
    if (!exp) return null;

    return extractMethodData(exp, spec);
  }, [spec, exportName]);
}

/**
 * Extract method data from all function exports.
 */
export function useMethodsFromSpec(spec: OpenPkg): MethodData[] {
  return useMemo(() => {
    return spec.exports
      .filter((exp) => exp.kind === 'function')
      .map((exp) => extractMethodData(exp, spec));
  }, [spec]);
}

/**
 * Pure function to extract method data from an export.
 */
export function extractMethodData(exp: SpecExport, _spec: OpenPkg): MethodData {
  const sig = exp.signatures?.[0];
  const params = sig?.parameters ?? [];

  // Build title
  const title = exp.kind === 'function' ? `${exp.name}()` : exp.name;

  // Build signature string
  const signature = buildSignatureString(exp);

  // Get description from export or signature
  const description = exp.description || sig?.description;

  // Get examples - normalize to SpecExample[]
  const rawExamples = exp.examples || sig?.examples || [];
  const examples: SpecExample[] = rawExamples.map((ex) =>
    typeof ex === 'string' ? { code: ex } : ex,
  );

  // Return type
  const returnType = sig?.returns?.schema;
  const returnTypeString = returnType ? formatSchema(returnType) : undefined;
  const returnDescription = sig?.returns?.description;

  // Check if async
  const isAsync = !!(exp.flags as Record<string, unknown> | undefined)?.async;

  return {
    export: exp,
    title,
    signature,
    description,
    parameters: params,
    examples,
    returnType,
    returnTypeString,
    returnDescription,
    isAsync,
  };
}
