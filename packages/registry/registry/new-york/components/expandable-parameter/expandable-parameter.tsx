'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useState } from 'react';
import { APIParameterItem } from '@/registry/new-york/ui/api-parameter-item/api-parameter-item';
import { EnumValuesSection } from '@/registry/new-york/ui/enum-values-section/enum-values-section';
import { NestedParameterContainer } from '@/registry/new-york/ui/nested-parameter-container/nested-parameter-container';
import { NestedParameterToggle } from '@/registry/new-york/ui/nested-parameter-toggle/nested-parameter-toggle';

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
        description={parameter.description}
        anchorId={parentPath ? `${parentPath}${parameter.name}` : parameter.name}
        showAnchor={level > 0}
      >
        {enumValues.length > 0 && !nestedParams.length && <EnumValuesSection values={enumValues} />}

        {nestedParams.length > 0 && (
          <>
            <NestedParameterToggle
              expanded={expanded}
              onToggle={handleToggle}
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

  if (Array.isArray(s.enum)) {
    result.enumValues = (s.enum as string[]).map((value) => ({
      value: String(value),
      description: undefined,
    }));
  }

  result.hasChildren = result.nestedParams.length > 0 || result.enumValues.length > 0;
  return result;
}
