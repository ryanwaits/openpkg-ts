'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useState } from 'react';
import { APIParameterItem } from './APIParameterItem';
import { EnumValuesSection } from './EnumValuesSection';
import { NestedParameterContainer } from './NestedParameterContainer';
import { NestedParameterToggle } from './NestedParameterToggle';

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
}

/**
 * Compound component combining APIParameterItem + NestedParameterToggle + NestedParameterContainer.
 * Automatically extracts nested object properties and enum values from spec schema.
 *
 * @example
 * ```tsx
 * <ExpandableParameter parameter={addressParam} />
 * ```
 */
export function ExpandableParameter({
  parameter,
  parentPath,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  level = 0,
  className,
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

  // Extract nested properties and enum values from schema
  const { nestedParams, enumValues, hasChildren } = extractSchemaInfo(parameter.schema);
  const type = formatSchema(parameter.schema);
  const isRequired = parameter.required !== false;

  return (
    <div className={cn('openpkg-expandable-param', className)}>
      <APIParameterItem
        name={parameter.name}
        parentPath={parentPath}
        type={hasChildren ? 'object' : type}
        required={isRequired}
        expandable={hasChildren}
        description={parameter.description}
        anchorId={parentPath ? `${parentPath}${parameter.name}` : parameter.name}
        showAnchor={level > 0}
      >
        {/* Enum values inline (no toggle needed) */}
        {enumValues.length > 0 && !nestedParams.length && <EnumValuesSection values={enumValues} />}

        {/* Nested params with toggle */}
        {nestedParams.length > 0 && (
          <>
            <NestedParameterToggle
              expanded={expanded}
              onToggle={handleToggle}
              count={nestedParams.length}
            />
            {expanded && (
              <NestedParameterContainer level={level}>
                {nestedParams.map((nested) => (
                  <ExpandableParameter
                    key={nested.name}
                    parameter={nested}
                    parentPath={`${parameter.name}.`}
                    level={level + 1}
                  />
                ))}
              </NestedParameterContainer>
            )}
          </>
        )}
      </APIParameterItem>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

interface SchemaInfo {
  nestedParams: SpecSignatureParameter[];
  enumValues: Array<{ value: string; description?: string }>;
  hasChildren: boolean;
}

function extractSchemaInfo(schema: SpecSchema | undefined): SchemaInfo {
  const result: SchemaInfo = {
    nestedParams: [],
    enumValues: [],
    hasChildren: false,
  };

  if (!schema || typeof schema !== 'object') return result;

  const s = schema as Record<string, unknown>;

  // Extract object properties
  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    const props = s.properties as Record<string, SpecSchema>;
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];

    for (const [name, propSchema] of Object.entries(props)) {
      result.nestedParams.push({
        name,
        schema: propSchema,
        required: required.includes(name),
        description: (propSchema as Record<string, unknown>)?.description as string | undefined,
      });
    }
  }

  // Extract enum values
  if (Array.isArray(s.enum)) {
    result.enumValues = (s.enum as string[]).map((value) => ({
      value: String(value),
      description: undefined,
    }));
  }

  result.hasChildren = result.nestedParams.length > 0 || result.enumValues.length > 0;
  return result;
}
