import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import type { APIParameterItemProps } from '../components/styled/APIParameterItem';
import type { EnumValue } from '../components/styled/EnumValuesSection';

export interface NestedParameterData extends Omit<APIParameterItemProps, 'children'> {
  /** Child parameters (for objects) */
  children?: NestedParameterData[];
  /** Enum values (for enums) */
  enumValues?: EnumValue[];
  /** Original schema */
  schema: SpecSchema;
}

/**
 * Convert a SpecSignatureParameter to nested parameter data.
 * Recursively processes object properties and extracts enum values.
 *
 * @example
 * ```tsx
 * const paramData = specParamToNestedParam(param);
 * return <APIParameterItem {...paramData} />;
 * ```
 */
export function specParamToNestedParam(
  param: SpecSignatureParameter,
  parentPath?: string,
): NestedParameterData {
  const schema = param.schema;
  const type = formatSchema(schema);
  const isRequired = param.required !== false;

  // Extract nested properties
  const children = extractNestedProperties(schema, param.name);

  // Extract enum values
  const enumValues = extractEnumValues(schema);

  // Determine if expandable
  const expandable = children.length > 0;

  return {
    name: param.name,
    parentPath,
    type: expandable ? 'object' : type,
    required: isRequired,
    expandable,
    description: param.description,
    anchorId: parentPath ? `${parentPath}${param.name}` : param.name,
    showAnchor: !!parentPath,
    children: children.length > 0 ? children : undefined,
    enumValues: enumValues.length > 0 ? enumValues : undefined,
    schema,
  };
}

/**
 * Convert multiple parameters to nested parameter data.
 */
export function specParamsToNestedParams(params: SpecSignatureParameter[]): NestedParameterData[] {
  return params.map((p) => specParamToNestedParam(p));
}

/**
 * Extract nested object properties as parameter data.
 */
function extractNestedProperties(
  schema: SpecSchema | undefined,
  parentName: string,
): NestedParameterData[] {
  if (!schema || typeof schema !== 'object') return [];

  const s = schema as Record<string, unknown>;

  // Handle object type with properties
  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    const props = s.properties as Record<string, SpecSchema>;
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];

    return Object.entries(props).map(([name, propSchema]) => {
      const propParam: SpecSignatureParameter = {
        name,
        schema: propSchema,
        required: required.includes(name),
        description: (propSchema as Record<string, unknown>)?.description as string | undefined,
      };
      return specParamToNestedParam(propParam, `${parentName}.`);
    });
  }

  return [];
}

/**
 * Extract enum values from schema.
 */
function extractEnumValues(schema: SpecSchema | undefined): EnumValue[] {
  if (!schema || typeof schema !== 'object') return [];

  const s = schema as Record<string, unknown>;

  if (Array.isArray(s.enum)) {
    return (s.enum as unknown[]).map((value) => ({
      value: String(value),
      description: undefined,
    }));
  }

  return [];
}

/**
 * Resolve a $ref in the schema against spec types.
 * Returns the resolved schema or the original if not found.
 */
export function resolveSchemaRef(
  schema: SpecSchema,
  types: Record<string, SpecSchema>,
): SpecSchema {
  if (!schema || typeof schema !== 'object') return schema;

  const s = schema as Record<string, unknown>;

  if (typeof s.$ref === 'string') {
    // Parse ref: "#/$defs/TypeName" or "#/types/TypeName"
    const refPath = s.$ref as string;
    const parts = refPath.split('/');
    const typeName = parts[parts.length - 1];

    if (types[typeName]) {
      return types[typeName];
    }
  }

  return schema;
}
