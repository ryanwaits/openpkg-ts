'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { EnumValuesSection } from './enum-values-section';
import { NestedParameterContainer } from './nested-parameter-container';
import { NestedParameterToggle } from './nested-parameter-toggle';
import { APIParameterItem } from './parameter-item';

export interface ExpandableParameterProps {
  /** Parameter from spec */
  parameter: SpecSignatureParameter;
  /** Parent path prefix */
  parentPath?: string;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Controlled onChange */
  onExpandedChange?: (expanded: boolean) => void;
  /** Nesting depth */
  level?: number;
  /** Custom className */
  className?: string;
  /** Callback to resolve $ref schemas */
  resolveRef?: (ref: string) => SpecSchema | undefined;
}

/**
 * Compound component combining APIParameterItem + NestedParameterToggle + NestedParameterContainer.
 * Automatically extracts nested object properties and enum values from spec schema.
 */
export function ExpandableParameter({
  parameter,
  parentPath,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  level = 0,
  className,
  resolveRef,
}: ExpandableParameterProps): ReactNode {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newValue = !expanded;
    if (isControlled) {
      onExpandedChange?.(newValue);
    } else {
      setInternalExpanded(newValue);
    }
  };

  // Detect and flatten valueOf-only wrapper types
  let effectiveSchema = parameter.schema;
  if (parameter.schema && typeof parameter.schema === 'object' && '$ref' in parameter.schema && resolveRef) {
    const resolved = resolveRef(parameter.schema.$ref as string);
    if (resolved && typeof resolved === 'object') {
      const flattened = flattenValueOfWrapper(resolved as Record<string, unknown>, resolveRef);
      if (flattened) {
        effectiveSchema = flattened;
      }
    }
  }

  const { nestedParams, enumValues, hasChildren, isComposite } = extractSchemaInfo(effectiveSchema, resolveRef);
  const type = formatSchema(effectiveSchema);
  const isRequired = parameter.required !== false;

  // For composite schemas (anyOf/allOf) that resolved to expandable properties,
  // keep the formatted type name (e.g. "Foo | Bar") instead of generic "object"
  const displayType = hasChildren && !isComposite ? 'object' : type;

  return (
    <div className={cn('openpkg-expandable-param', className)}>
      <APIParameterItem
        name={parameter.name}
        parentPath={parentPath}
        type={displayType}
        required={isRequired}
        description={parameter.description}
        anchorId={parentPath ? `${parentPath}${parameter.name}` : parameter.name}
      >
        {enumValues.length > 0 && !nestedParams.length && <EnumValuesSection values={enumValues} />}

        {nestedParams.length > 0 && (
          <div className="mt-3 mb-1">
            <NestedParameterToggle expanded={expanded} onToggle={handleToggle} />
            {expanded && (
              <NestedParameterContainer level={level}>
                {nestedParams.map((nested) => (
                  <ExpandableParameter
                    key={nested.name}
                    parameter={nested}
                    parentPath={`${parameter.name}.`}
                    level={level + 1}
                    resolveRef={resolveRef}
                  />
                ))}
              </NestedParameterContainer>
            )}
          </div>
        )}
      </APIParameterItem>
    </div>
  );
}

interface SchemaInfo {
  nestedParams: SpecSignatureParameter[];
  enumValues: Array<{ value: string; description?: string }>;
  hasChildren: boolean;
  /** True when properties were extracted from anyOf/allOf composite */
  isComposite: boolean;
}

/** Extract properties from a single resolved schema object */
function extractObjectProperties(
  s: Record<string, unknown>,
  into: SpecSignatureParameter[],
  seen: Set<string>,
): void {
  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    const props = s.properties as Record<string, SpecSchema>;
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];
    for (const [name, propSchema] of Object.entries(props)) {
      if (seen.has(name)) continue;
      seen.add(name);
      into.push({
        name,
        schema: propSchema,
        required: required.includes(name),
        description: (propSchema as Record<string, unknown>)?.description as string | undefined,
      });
    }
  }
}

/**
 * Detect valueOf-only wrapper types (like IntegerType) and extract return types.
 * Returns flattened union schema if it's a wrapper, undefined otherwise.
 */
function flattenValueOfWrapper(
  s: Record<string, unknown>,
  resolveRef?: (ref: string) => SpecSchema | undefined,
): SpecSchema | undefined {
  // Must be object with properties
  if (s.type !== 'object' || !s.properties || typeof s.properties !== 'object') {
    return undefined;
  }

  const props = s.properties as Record<string, unknown>;
  const propKeys = Object.keys(props);

  // Must have only valueOf property (or valueOf + toString/toLocaleString which we ignore)
  const hasOnlyValueOf = propKeys.length === 1 && propKeys[0] === 'valueOf';
  const hasValueOfPlusHelpers =
    propKeys.length <= 3 &&
    props.valueOf &&
    propKeys.every((k) => k === 'valueOf' || k === 'toString' || k === 'toLocaleString');

  if (!hasOnlyValueOf && !hasValueOfPlusHelpers) {
    return undefined;
  }

  const valueOf = props.valueOf as Record<string, unknown>;

  // Extract return types from anyOf function signatures
  if (valueOf.anyOf && Array.isArray(valueOf.anyOf)) {
    const returnSchemas: SpecSchema[] = [];

    for (const variant of valueOf.anyOf) {
      if (typeof variant !== 'object' || !variant) continue;
      const v = variant as Record<string, unknown>;

      // Check for x-ts-function marker and x-ts-signatures
      if (v['x-ts-function'] && Array.isArray(v['x-ts-signatures'])) {
        for (const sig of v['x-ts-signatures'] as Array<Record<string, unknown>>) {
          if (sig.returns && typeof sig.returns === 'object') {
            const returns = sig.returns as Record<string, unknown>;
            if (returns.schema) {
              returnSchemas.push(returns.schema as SpecSchema);
            }
          }
        }
      }
    }

    // If we found return types, create a union
    if (returnSchemas.length > 0) {
      // Resolve any $refs in return types
      const resolvedSchemas = returnSchemas.map((schema) => {
        if (
          typeof schema === 'object' &&
          schema !== null &&
          '$ref' in schema &&
          typeof schema.$ref === 'string' &&
          resolveRef
        ) {
          return resolveRef(schema.$ref) || schema;
        }
        return schema;
      });

      return resolvedSchemas.length === 1 ? resolvedSchemas[0] : { anyOf: resolvedSchemas };
    }
  }

  return undefined;
}

/** Resolve a schema to an object, following $ref and allOf */
function resolveToObject(
  s: Record<string, unknown>,
  resolveRef?: (ref: string) => SpecSchema | undefined,
): Record<string, unknown> | undefined {
  // Direct $ref
  if (s.$ref && typeof s.$ref === 'string' && resolveRef) {
    const resolved = resolveRef(s.$ref);
    if (resolved && typeof resolved === 'object') {
      return resolved as Record<string, unknown>;
    }
  }
  // Already an object type
  if (s.type === 'object' && s.properties) return s;
  return undefined;
}

function extractSchemaInfo(
  schema: SpecSchema | undefined,
  resolveRef?: (ref: string) => SpecSchema | undefined,
): SchemaInfo {
  const result: SchemaInfo = {
    nestedParams: [],
    enumValues: [],
    hasChildren: false,
    isComposite: false,
  };

  if (!schema || typeof schema !== 'object') return result;

  let s = schema as Record<string, unknown>;

  // Resolve $ref if present
  if (s.$ref && typeof s.$ref === 'string' && resolveRef) {
    const resolved = resolveRef(s.$ref);
    if (resolved && typeof resolved === 'object') {
      s = resolved as Record<string, unknown>;
    }
  }

  // anyOf: only expand if ALL members are objects (no primitives in union)
  const anyOfMembers = s.anyOf as SpecSchema[] | undefined;
  if (Array.isArray(anyOfMembers) && resolveRef) {
    const resolvedMembers = anyOfMembers
      .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
      .map((m) => resolveToObject(m, resolveRef))
      .filter((r): r is Record<string, unknown> => r != null);

    // Only expand if ALL members resolved to objects (not mixed with primitives)
    if (resolvedMembers.length === anyOfMembers.length && resolvedMembers.length > 0) {
      const seen = new Set<string>();
      for (const resolved of resolvedMembers) {
        extractObjectProperties(resolved, result.nestedParams, seen);
        if (Array.isArray(resolved.allOf)) {
          for (const sub of resolved.allOf as SpecSchema[]) {
            if (!sub || typeof sub !== 'object') continue;
            const subResolved = resolveToObject(sub as Record<string, unknown>, resolveRef);
            if (subResolved) extractObjectProperties(subResolved, result.nestedParams, seen);
          }
        }
      }
      if (result.nestedParams.length > 0) {
        result.hasChildren = true;
        result.isComposite = true;
        return result;
      }
    }
  }

  // allOf: always merge properties (intersections)
  const allOfMembers = s.allOf as SpecSchema[] | undefined;
  if (Array.isArray(allOfMembers) && resolveRef) {
    const seen = new Set<string>();
    for (const member of allOfMembers) {
      if (!member || typeof member !== 'object') continue;
      const resolved = resolveToObject(member as Record<string, unknown>, resolveRef);
      if (resolved) {
        extractObjectProperties(resolved, result.nestedParams, seen);
        if (Array.isArray((resolved as Record<string, unknown>).allOf)) {
          for (const sub of (resolved as Record<string, unknown>).allOf as SpecSchema[]) {
            if (!sub || typeof sub !== 'object') continue;
            const subResolved = resolveToObject(sub as Record<string, unknown>, resolveRef);
            if (subResolved) extractObjectProperties(subResolved, result.nestedParams, seen);
          }
        }
      }
    }
    if (result.nestedParams.length > 0) {
      result.hasChildren = true;
      result.isComposite = true;
      return result;
    }
  }

  const seen = new Set<string>();
  extractObjectProperties(s, result.nestedParams, seen);

  if (Array.isArray(s.enum)) {
    result.enumValues = (s.enum as string[]).map((value) => ({
      value: String(value),
      description: undefined,
    }));
  }

  result.hasChildren = result.nestedParams.length > 0 || result.enumValues.length > 0;
  return result;
}
