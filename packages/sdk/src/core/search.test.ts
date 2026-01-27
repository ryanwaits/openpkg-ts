import { describe, expect, it } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { toPagefindRecords } from './search';

const makeSpec = (): OpenPkg => ({
  openpkg: '0.4.0',
  meta: { name: 'test-pkg', version: '1.0.0' },
  exports: [
    {
      id: 'fn-greet',
      name: 'greet',
      kind: 'function',
      description: 'Greets a person',
      signatures: [{ parameters: [{ name: 'name', schema: { type: 'string' } }] }],
    },
  ],
});

describe('toPagefindRecords', () => {
  it('uses default weights when none provided', () => {
    const spec = makeSpec();
    const records = toPagefindRecords(spec);

    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record.weighted_sections).toBeDefined();

    const nameSection = record.weighted_sections?.find((s) => s.text === 'greet');
    expect(nameSection?.weight).toBe(10); // default name weight
  });

  it('custom weights affect weighted_sections', () => {
    const spec = makeSpec();
    const records = toPagefindRecords(spec, {
      weights: { name: 100, description: 50, signature: 25 },
    });

    expect(records).toHaveLength(1);
    const [record] = records;

    const nameSection = record.weighted_sections?.find((s) => s.text === 'greet');
    const descSection = record.weighted_sections?.find((s) => s.text === 'Greets a person');

    expect(nameSection?.weight).toBe(100);
    expect(descSection?.weight).toBe(50);
  });

  it('custom weights change ranking order in weighted_sections', () => {
    const spec = makeSpec();

    // With default weights, name has highest weight
    const defaultRecords = toPagefindRecords(spec);
    const defaultSections = defaultRecords[0].weighted_sections ?? [];
    const defaultMaxWeight = Math.max(...defaultSections.map((s) => s.weight));
    const defaultHighest = defaultSections.find((s) => s.weight === defaultMaxWeight);
    expect(defaultHighest?.text).toBe('greet'); // name has default 10, desc 5

    // With inverted weights, description has highest weight
    const customRecords = toPagefindRecords(spec, {
      weights: { name: 1, description: 100, signature: 1 },
    });
    const customSections = customRecords[0].weighted_sections ?? [];
    const customMaxWeight = Math.max(...customSections.map((s) => s.weight));
    const customHighest = customSections.find((s) => s.weight === customMaxWeight);
    expect(customHighest?.text).toBe('Greets a person'); // description now highest
  });
});
