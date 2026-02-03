import {
  DISPLAY_KIND_ORDER,
  type OpenPkg,
  type SpecExport,
  type SpecExportKind,
  type SpecMember,
  type SpecSchema,
  type SpecSignature,
  type SpecType,
  type SpecTypeParameter,
} from '@openpkg-ts/spec';

/**
 * Format function schema to signature string.
 */
function formatFunctionSchema(schema: Record<string, unknown>): string {
  const sigs = schema['x-ts-signatures'] as SpecSignature[] | undefined;
  if (!sigs?.length) return '(...args: unknown[]) => unknown';

  const sig = sigs[0];
  const params = formatParameters(sig);
  const ret = sig.returns ? formatSchema(sig.returns.schema) : 'void';
  return `${params} => ${ret}`;
}

export interface FormatSchemaOptions {
  /** Include package attribution for external types */
  includePackage?: boolean;
  /** Collapse unions with more than N members (default: no collapse) */
  collapseUnionThreshold?: number;
}

/**
 * Format a schema to a human-readable type string.
 *
 * @param schema - The schema to format
 * @param options - Formatting options
 * @returns Formatted type string
 *
 * @example
 * ```ts
 * formatSchema({ type: 'string' }) // 'string'
 * formatSchema({ $ref: '#/types/User' }) // 'User'
 * formatSchema({ anyOf: [{ type: 'string' }, { type: 'number' }] }) // 'string | number'
 * formatSchema({ type: 'integer', 'x-ts-type': 'bigint' }) // 'bigint'
 * formatSchema({ 'x-ts-type': 'Response', 'x-ts-package': 'express' }, { includePackage: true }) // 'Response (from express)'
 * ```
 */
export function formatSchema(
  schema: SpecSchema | undefined,
  options?: FormatSchemaOptions,
): string {
  if (!schema) return 'unknown';
  if (typeof schema === 'string') return schema;

  // Helper to append package info
  const withPackage = (typeStr: string): string => {
    if (options?.includePackage && typeof schema === 'object' && 'x-ts-package' in schema) {
      const pkg = schema['x-ts-package'] as string;
      return `${typeStr} (from ${pkg})`;
    }
    return typeStr;
  };

  if (typeof schema === 'object' && schema !== null) {
    // Handle x-ts-type first (preserves original TS type)
    if ('x-ts-type' in schema && typeof schema['x-ts-type'] === 'string') {
      const tsType = schema['x-ts-type'];
      // Handle function types with signatures
      if (tsType === 'function' || schema['x-ts-function']) {
        return withPackage(formatFunctionSchema(schema as Record<string, unknown>));
      }
      return withPackage(tsType); // bigint, symbol, void, never, etc.
    }

    // Handle x-ts-function (callable types)
    if ('x-ts-function' in schema && schema['x-ts-function']) {
      return withPackage(formatFunctionSchema(schema as Record<string, unknown>));
    }

    // Handle x-ts-type-predicate (type guards)
    if ('x-ts-type-predicate' in schema) {
      const pred = schema['x-ts-type-predicate'] as { parameterName: string; type: SpecSchema };
      return `${pred.parameterName} is ${formatSchema(pred.type, options)}`;
    }

    // Handle $ref with x-ts-type-arguments (generics)
    if ('$ref' in schema && typeof schema.$ref === 'string') {
      const baseName = schema.$ref.replace('#/types/', '');
      if ('x-ts-type-arguments' in schema && Array.isArray(schema['x-ts-type-arguments'])) {
        const args = (schema['x-ts-type-arguments'] as SpecSchema[])
          .map((s) => formatSchema(s, options))
          .join(', ');
        return withPackage(`${baseName}<${args}>`);
      }
      return withPackage(baseName);
    }

    // Handle anyOf (union)
    if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
      const threshold = options?.collapseUnionThreshold;
      const members = schema.anyOf as SpecSchema[];

      // Collapse large unions if threshold is set
      if (threshold && members.length > threshold) {
        const shown = members.slice(0, 3);
        const remaining = members.length - 3;
        const shownStr = shown.map((s) => formatSchema(s, options)).join(' | ');
        return `${shownStr} | ... (${remaining} more)`;
      }

      return members.map((s) => formatSchema(s, options)).join(' | ');
    }

    // Handle allOf (intersection)
    if ('allOf' in schema && Array.isArray(schema.allOf)) {
      return schema.allOf.map((s) => formatSchema(s, options)).join(' & ');
    }

    // Handle array
    if ('type' in schema && schema.type === 'array') {
      const items =
        'items' in schema ? formatSchema(schema.items as SpecSchema, options) : 'unknown';
      return `${items}[]`;
    }

    // Handle tuple
    if ('type' in schema && schema.type === 'tuple' && 'items' in schema) {
      const items = (schema.items as SpecSchema[]).map((s) => formatSchema(s, options)).join(', ');
      return `[${items}]`;
    }

    // Handle object
    if ('type' in schema && schema.type === 'object') {
      if ('properties' in schema && schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([k, v]) => `${k}: ${formatSchema(v as SpecSchema, options)}`)
          .join('; ');
        return `{ ${props} }`;
      }
      return 'object';
    }

    // Handle const (exact literal value)
    if ('const' in schema && schema.const !== undefined) {
      const v = schema.const;
      return withPackage(typeof v === 'string' ? `"${v}"` : String(v));
    }

    // Handle enum (literal union shorthand)
    if ('enum' in schema && Array.isArray(schema.enum)) {
      const vals = (schema.enum as unknown[]).map((v) =>
        typeof v === 'string' ? `"${v}"` : String(v),
      );
      return withPackage(vals.join(' | '));
    }

    // Handle basic type
    if ('type' in schema && typeof schema.type === 'string') {
      return withPackage(schema.type);
    }
  }

  return 'unknown';
}

/**
 * Format type parameters to a string like `<T, U extends string>`.
 *
 * @param typeParams - Array of type parameters
 * @returns Formatted type parameters string or empty string
 *
 * @example
 * ```ts
 * formatTypeParameters([{ name: 'T' }]) // '<T>'
 * formatTypeParameters([{ name: 'T', constraint: 'object' }]) // '<T extends object>'
 * formatTypeParameters([{ name: 'T', default: 'unknown' }]) // '<T = unknown>'
 * formatTypeParameters([{ name: 'T', variance: 'in' }]) // '<in T>'
 * ```
 */
export function formatTypeParameters(typeParams?: SpecTypeParameter[]): string {
  if (!typeParams?.length) return '';
  const params = typeParams.map((tp) => {
    let str = '';
    // Handle const modifier (TS 5.0+ feature)
    if ('const' in tp && tp.const) str += 'const ';
    // Handle variance modifiers
    if (tp.variance === 'in') str += 'in ';
    else if (tp.variance === 'out') str += 'out ';
    else if (tp.variance === 'inout') str += 'in out ';
    str += tp.name;
    if (tp.constraint) str += ` extends ${tp.constraint}`;
    if (tp.default) str += ` = ${tp.default}`;
    return str;
  });
  return `<${params.join(', ')}>`;
}

/**
 * Format function parameters to a string like `(a: string, b?: number)`.
 *
 * @param sig - The signature containing parameters
 * @returns Formatted parameters string
 *
 * @example
 * ```ts
 * formatParameters({ parameters: [{ name: 'id', schema: { type: 'string' } }] })
 * // '(id: string)'
 * ```
 */
export function formatParameters(sig?: SpecSignature): string {
  if (!sig?.parameters?.length) return '()';
  const params = sig.parameters.map((p) => {
    const optional = p.required === false ? '?' : '';
    const rest = p.rest ? '...' : '';
    const type = formatSchema(p.schema);
    return `${rest}${p.name}${optional}: ${type}`;
  });
  return `(${params.join(', ')})`;
}

/**
 * Format return type from signature.
 *
 * @param sig - The signature containing return type
 * @returns Formatted return type string
 *
 * @example
 * ```ts
 * formatReturnType({ returns: { schema: { type: 'Promise', items: { type: 'string' } } } })
 * // 'Promise<string>'
 * ```
 */
export function formatReturnType(sig?: SpecSignature): string {
  if (!sig?.returns) return 'void';
  return formatSchema(sig.returns.schema);
}

/**
 * Build a full signature string for an export.
 *
 * @param exp - The export to build a signature for
 * @param sigIndex - Index of signature to use for overloaded functions
 * @returns Complete signature string
 *
 * @example
 * ```ts
 * buildSignatureString({ kind: 'function', name: 'greet', signatures: [...] })
 * // 'function greet(name: string): string'
 *
 * buildSignatureString({ kind: 'class', name: 'Logger', extends: 'EventEmitter' })
 * // 'class Logger extends EventEmitter'
 * ```
 */
export function buildSignatureString(exp: SpecExport, sigIndex = 0): string {
  const sig = exp.signatures?.[sigIndex];
  const typeParams = formatTypeParameters(exp.typeParameters || sig?.typeParameters);

  switch (exp.kind) {
    case 'function': {
      const params = formatParameters(sig);
      const returnType = formatReturnType(sig);
      return `function ${exp.name}${typeParams}${params}: ${returnType}`;
    }
    case 'class': {
      const ext = exp.extends ? ` extends ${exp.extends}` : '';
      const impl = exp.implements?.length ? ` implements ${exp.implements.join(', ')}` : '';
      return `class ${exp.name}${typeParams}${ext}${impl}`;
    }
    case 'interface': {
      const ext = exp.extends ? ` extends ${exp.extends}` : '';
      return `interface ${exp.name}${typeParams}${ext}`;
    }
    case 'type': {
      const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
      return `type ${exp.name}${typeParams} = ${typeValue}`;
    }
    case 'enum': {
      return `enum ${exp.name}`;
    }
    case 'variable': {
      const typeValue = typeof exp.type === 'string' ? exp.type : formatSchema(exp.schema);
      return `const ${exp.name}: ${typeValue}`;
    }
    default:
      return exp.name;
  }
}

/**
 * Resolve a type reference to its definition.
 *
 * @param ref - Type reference string (e.g., '#/types/User')
 * @param spec - The OpenPkg spec containing type definitions
 * @returns The resolved type definition or undefined
 *
 * @example
 * ```ts
 * resolveTypeRef('#/types/User', spec)
 * // { id: 'User', name: 'User', kind: 'interface', ... }
 * ```
 */
export function resolveTypeRef(ref: string, spec: OpenPkg): SpecType | undefined {
  const id = ref.replace('#/types/', '');
  return spec.types?.find((t) => t.id === id);
}

/**
 * Check if a member is a method (has signatures).
 *
 * @param member - The member to check
 * @returns True if the member is a method
 *
 * @example
 * ```ts
 * isMethod({ name: 'foo', signatures: [{ parameters: [] }] }) // true
 * isMethod({ name: 'bar', schema: { type: 'string' } }) // false
 * ```
 */
export function isMethod(member: SpecMember): boolean {
  return !!member.signatures?.length;
}

/**
 * Check if a member is a property (no signatures).
 *
 * @param member - The member to check
 * @returns True if the member is a property
 */
export function isProperty(member: SpecMember): boolean {
  return !member.signatures?.length;
}

/**
 * Get methods from members list.
 *
 * @param members - Array of members to filter
 * @returns Array of method members
 */
export function getMethods(members?: SpecMember[]): SpecMember[] {
  return members?.filter(isMethod) ?? [];
}

/**
 * Get properties from members list.
 *
 * @param members - Array of members to filter
 * @returns Array of property members
 */
export function getProperties(members?: SpecMember[]): SpecMember[] {
  return members?.filter(isProperty) ?? [];
}

/**
 * Group members by visibility (public, protected, private).
 *
 * @param members - Array of members to group
 * @returns Object with public, protected, and private arrays
 *
 * @example
 * ```ts
 * const groups = groupByVisibility(classExport.members)
 * groups.public  // [{ name: 'foo', visibility: 'public' }]
 * groups.private // [{ name: 'bar', visibility: 'private' }]
 * ```
 */
export function groupByVisibility(members?: SpecMember[]): {
  public: SpecMember[];
  protected: SpecMember[];
  private: SpecMember[];
} {
  const groups = {
    public: [] as SpecMember[],
    protected: [] as SpecMember[],
    private: [] as SpecMember[],
  };

  for (const member of members ?? []) {
    const visibility = member.visibility ?? 'public';
    groups[visibility].push(member);
  }

  return groups;
}

/**
 * Sort exports alphabetically by name.
 *
 * @param items - Array of items with a name property
 * @returns New sorted array
 */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/** Canonical kind ordering for rendering grouped exports. */
export const KIND_ORDER: SpecExportKind[] = [
  ...DISPLAY_KIND_ORDER,
  'namespace',
  'module',
  'reference',
  'external',
];

/**
 * Group items by their `kind` field.
 */
export function groupByKind<T extends { kind: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    if (!groups[item.kind]) groups[item.kind] = [];
    groups[item.kind].push(item);
  }
  return groups;
}

/**
 * Conditional type structure from the spec.
 */
export interface SpecConditionalType {
  checkType: SpecSchema;
  extendsType: SpecSchema;
  trueType: SpecSchema;
  falseType: SpecSchema;
}

/**
 * Mapped type structure from the spec.
 */
export interface SpecMappedType {
  keyType: SpecSchema;
  valueType: SpecSchema;
  readonly?: boolean | 'add' | 'remove';
  optional?: boolean | 'add' | 'remove';
}

/**
 * Format a conditional type to a human-readable string.
 *
 * @param condType - The conditional type structure
 * @returns Formatted conditional type string
 *
 * @example
 * ```ts
 * formatConditionalType({
 *   checkType: { 'x-ts-type': 'T' },
 *   extendsType: { type: 'string' },
 *   trueType: { type: 'boolean', const: true },
 *   falseType: { type: 'boolean', const: false }
 * })
 * // 'T extends string ? true : false'
 * ```
 */
export function formatConditionalType(condType: SpecConditionalType): string {
  const check = formatSchema(condType.checkType);
  const ext = formatSchema(condType.extendsType);
  const trueT = formatSchema(condType.trueType);
  const falseT = formatSchema(condType.falseType);
  return `${check} extends ${ext} ? ${trueT} : ${falseT}`;
}

/**
 * Format a mapped type to a human-readable string.
 *
 * @param mappedType - The mapped type structure
 * @returns Formatted mapped type string
 *
 * @example
 * ```ts
 * formatMappedType({
 *   keyType: { 'x-ts-type': 'K in keyof T' },
 *   valueType: { 'x-ts-type': 'T[K]' },
 *   readonly: true
 * })
 * // '{ readonly [K in keyof T]: T[K] }'
 * ```
 */
export function formatMappedType(mappedType: SpecMappedType): string {
  const keyStr = formatSchema(mappedType.keyType);
  const valueStr = formatSchema(mappedType.valueType);

  // Build modifiers
  let readonlyMod = '';
  if (mappedType.readonly === true || mappedType.readonly === 'add') {
    readonlyMod = 'readonly ';
  } else if (mappedType.readonly === 'remove') {
    readonlyMod = '-readonly ';
  }

  let optionalMod = '';
  if (mappedType.optional === true || mappedType.optional === 'add') {
    optionalMod = '?';
  } else if (mappedType.optional === 'remove') {
    optionalMod = '-?';
  }

  return `{ ${readonlyMod}[${keyStr}]${optionalMod}: ${valueStr} }`;
}

/** Find a single export by name or id, throws if not found */
export function findExport(spec: OpenPkg, name: string): SpecExport {
  const exp = spec.exports.find((e) => e.name === name || e.id === name);
  if (!exp) throw new Error(`Export not found: ${name}`);
  return exp;
}

/** Filter exports by a list of names/ids */
export function filterExports(spec: OpenPkg, names: string[]): SpecExport[] {
  const ids = new Set(names);
  return spec.exports.filter((e) => ids.has(e.name) || ids.has(e.id));
}
