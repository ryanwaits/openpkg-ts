import type ts from 'typescript';
import type { SerializerContext } from './context';

export interface ExpansionBudget {
  /** Export name, or `type <id>` for a registered type. */
  owner: string;
  ops: number;
  exceeded: boolean;
}

/**
 * Steps one export or registered type may take. Measured with no limit, the
 * costliest real one is valibot's `pipeAsync` (20 overloads) at 6.5k; p99 is
 * under 800 across zod, valibot, swr, hono and this sdk.
 */
export const MAX_BUDGET_OPS = 10_000;
/**
 * Steps a whole extract may take: the ceiling against runaway, not a working
 * budget (zod, the largest measured, takes 72k). Hitting it degrades whatever
 * comes after, in export order.
 */
export const MAX_SCHEMA_OPS = 200_000;

/**
 * Build one export or registered type under a budget of its own. The build
 * starts from a clean slate (depth, recursion guard) so its output does not
 * depend on where it was first reached from, and what it spends is not charged
 * to whoever reached it.
 */
export function withExpansionBudget<T>(ctx: SerializerContext, owner: string, fn: () => T): T {
  const outer = {
    budget: ctx.budget,
    currentDepth: ctx.currentDepth,
    visitedTypes: ctx.visitedTypes,
    inTupleElement: ctx.inTupleElement,
    aliasBody: ctx.aliasBody,
  };
  const budget: ExpansionBudget = { owner, ops: 0, exceeded: false };
  Object.assign(ctx, {
    budget,
    currentDepth: 0,
    visitedTypes: new Set<ts.Type>(),
    inTupleElement: undefined,
    aliasBody: undefined,
  });
  try {
    return fn();
  } finally {
    if (budget.exceeded) ctx.exhaustedBudgets.push(owner);
    Object.assign(ctx, outer);
  }
}
