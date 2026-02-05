import { cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type TypeColor =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'object'
  | 'array'
  | 'function'
  | 'union'
  | 'generic'
  | 'default';

/**
 * Type coloring for syntax display.
 * Follows Stripe-style: consistent colors for primitives vs complex types.
 */
const typeBadgeVariants: (props?: {
  typeColor?: TypeColor | null;
  class?: string;
  className?: string;
}) => string = cva('font-mono text-sm', {
  variants: {
    typeColor: {
      // Primitives
      string: 'text-[var(--openpkg-accent-green)]',
      number: 'text-[var(--openpkg-accent-blue)]',
      boolean: 'text-[var(--openpkg-accent-amber)]',
      null: 'text-[var(--openpkg-text-muted)]',
      undefined: 'text-[var(--openpkg-text-muted)]',
      // Complex types
      object: 'text-[var(--openpkg-accent-purple)]',
      array: 'text-[var(--openpkg-accent-cyan)]',
      function: 'text-[var(--openpkg-accent-fuchsia)]',
      // Special
      union: 'text-[var(--openpkg-accent-orange)]',
      generic: 'text-[var(--openpkg-accent-rose)]',
      // Default
      default: 'text-[var(--openpkg-text-muted)]',
    },
  },
  defaultVariants: {
    typeColor: 'default',
  },
});

export interface TypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Type string to display */
  type: string;
  /** Override color detection */
  typeColor?: TypeColor | null;
}

/**
 * Detect the type color from a type string.
 */
function detectTypeColor(type: string): TypeColor {
  const normalized = type.toLowerCase().trim();

  if (normalized === 'string' || normalized.startsWith('"') || normalized.startsWith("'")) {
    return 'string';
  }
  if (normalized === 'number' || /^\d+$/.test(normalized)) {
    return 'number';
  }
  if (normalized === 'boolean' || normalized === 'true' || normalized === 'false') {
    return 'boolean';
  }
  if (normalized === 'null') {
    return 'null';
  }
  if (normalized === 'undefined' || normalized === 'void') {
    return 'undefined';
  }
  if (normalized === 'object' || normalized.startsWith('{')) {
    return 'object';
  }
  if (normalized.endsWith('[]') || normalized.startsWith('array')) {
    return 'array';
  }
  if (
    normalized.startsWith('(') ||
    normalized.includes('=>') ||
    normalized.startsWith('function')
  ) {
    return 'function';
  }
  if (normalized.includes('|')) {
    return 'union';
  }
  if (normalized.includes('<') && normalized.includes('>')) {
    return 'generic';
  }

  return 'default';
}

/**
 * Inline type display with syntax coloring.
 * Automatically detects type category and applies appropriate color.
 */
export const TypeBadge: React.ForwardRefExoticComponent<
  TypeBadgeProps & React.RefAttributes<HTMLSpanElement>
> = React.forwardRef<HTMLSpanElement, TypeBadgeProps>(
  ({ className, type, typeColor, ...props }, ref) => {
    const color = typeColor ?? detectTypeColor(type);

    return (
      <span ref={ref} className={cn(typeBadgeVariants({ typeColor: color }), className)} {...props}>
        {type}
      </span>
    );
  },
);
TypeBadge.displayName = 'TypeBadge';

export { typeBadgeVariants };
