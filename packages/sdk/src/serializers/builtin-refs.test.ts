import { describe, expect, test } from 'bun:test';
import { extract } from '../builder/spec-builder';

const FIXTURE = `
export interface User {
  id: string;
  createdAt: Date;
  tags: Map<string, number>;
}

export function load(id: string): Promise<User> {
  return Promise.resolve({ id, createdAt: new Date(), tags: new Map() });
}

export function pick<T>(items: T[], index: number): T {
  return items[index] as T;
}
`;

/** Collect every $ref string reachable in a value. */
const collectRefs = (value: unknown, refs: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === '$ref' && typeof nested === 'string') refs.push(nested);
      else collectRefs(nested, refs);
    }
  }
  return refs;
};

describe('builtin and type-parameter references', () => {
  test('no dangling $refs — every ref resolves to a types[] entry', async () => {
    const { spec } = await extract({ entryFile: "test.ts", content: FIXTURE });
    const registered = new Set((spec.types ?? []).map((t) => t.name));
    const refs = collectRefs(spec);
    const dangling = refs
      .map((r) => r.replace('#/types/', ''))
      .filter((name) => !registered.has(name));
    expect(dangling).toEqual([]);
  });

  test('Date property gets structural schema with x-ts-type', async () => {
    const { spec } = await extract({ entryFile: "test.ts", content: FIXTURE });
    const user = spec.types?.find((t) => t.name === 'User');
    const props = (user?.schema as Record<string, unknown>)?.properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(props.createdAt).toMatchObject({
      type: 'string',
      format: 'date-time',
      'x-ts-type': 'Date',
    });
  });

  test('Map<string, number> gets structural schema with type arguments', async () => {
    const { spec } = await extract({ entryFile: "test.ts", content: FIXTURE });
    const user = spec.types?.find((t) => t.name === 'User');
    const props = (user?.schema as Record<string, unknown>)?.properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(props.tags).toMatchObject({ type: 'object', 'x-ts-type': 'Map' });
    expect(props.tags['x-ts-type-arguments']).toEqual([{ type: 'string' }, { type: 'number' }]);
  });

  test('Promise<User> return gets structural schema, keeps User ref in type arguments', async () => {
    const { spec } = await extract({ entryFile: "test.ts", content: FIXTURE });
    const load = spec.exports.find((e) => e.name === 'load');
    const returns = load?.signatures?.[0]?.returns?.schema as Record<string, unknown>;
    expect(returns).toMatchObject({ type: 'object', 'x-ts-type': 'Promise' });
    expect(returns['x-ts-type-arguments']).toEqual([{ $ref: '#/types/User' }]);
  });

  test('generic type parameter emits x-ts-type text, not a $ref', async () => {
    const { spec } = await extract({ entryFile: "test.ts", content: FIXTURE });
    const pick = spec.exports.find((e) => e.name === 'pick');
    const returns = pick?.signatures?.[0]?.returns?.schema as Record<string, unknown>;
    expect(returns).toEqual({ 'x-ts-type': 'T' });
    const itemsParam = pick?.signatures?.[0]?.parameters?.[0]?.schema as Record<string, unknown>;
    expect(itemsParam).toMatchObject({ type: 'array' });
    expect((itemsParam.items as Record<string, unknown>) ?? {}).toMatchObject({
      'x-ts-type': 'T',
    });
  });
});
