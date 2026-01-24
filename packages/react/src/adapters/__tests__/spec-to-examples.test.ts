import { describe, expect, test } from 'bun:test';
import type { SpecExample } from '@openpkg-ts/spec';
import {
  specExampleToCodeExample,
  specExamplesToCodeExamples,
  generateDefaultExample,
  getLanguagesFromExamples,
} from '../spec-to-examples';

// =============================================================================
// Tests
// =============================================================================

describe('specExampleToCodeExample', () => {
  describe('string shorthand', () => {
    test('converts string to CodeExample', () => {
      const result = specExampleToCodeExample('const x = 1;', 0);
      expect(result.code).toBe('const x = 1;');
      expect(result.language).toBe('typescript');
    });

    test('generates id from index', () => {
      const result = specExampleToCodeExample('code', 2);
      expect(result.id).toBe('example-2');
    });

    test('generates label from index', () => {
      const result = specExampleToCodeExample('code', 0);
      expect(result.label).toBe('Example 1');
    });
  });

  describe('full SpecExample', () => {
    test('extracts code', () => {
      const example: SpecExample = { code: 'foo()' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.code).toBe('foo()');
    });

    test('uses title for label', () => {
      const example: SpecExample = { code: 'x', title: 'Basic usage' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.label).toBe('Basic usage');
    });

    test('generates id from title', () => {
      const example: SpecExample = { code: 'x', title: 'With Options' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.id).toBe('with-options');
    });

    test('handles multi-word titles', () => {
      const example: SpecExample = { code: 'x', title: 'Using   multiple   spaces' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.id).toBe('using-multiple-spaces');
    });

    test('falls back to index when no title', () => {
      const example: SpecExample = { code: 'x' };
      const result = specExampleToCodeExample(example, 5);
      expect(result.id).toBe('example-5');
      expect(result.label).toBe('Example 6');
    });
  });

  describe('language mapping', () => {
    test('maps ts to typescript', () => {
      const example: SpecExample = { code: 'x', language: 'ts' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('typescript');
    });

    test('maps tsx to typescript', () => {
      const example: SpecExample = { code: 'x', language: 'tsx' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('typescript');
    });

    test('maps js to javascript', () => {
      const example: SpecExample = { code: 'x', language: 'js' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('javascript');
    });

    test('maps jsx to javascript', () => {
      const example: SpecExample = { code: 'x', language: 'jsx' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('javascript');
    });

    test('maps shell to bash', () => {
      const example: SpecExample = { code: 'x', language: 'shell' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('bash');
    });

    test('preserves json', () => {
      const example: SpecExample = { code: 'x', language: 'json' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('json');
    });

    test('defaults to typescript', () => {
      const example: SpecExample = { code: 'x' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('typescript');
    });

    test('defaults unknown languages to typescript', () => {
      const example: SpecExample = { code: 'x', language: 'unknown' };
      const result = specExampleToCodeExample(example, 0);
      expect(result.language).toBe('typescript');
    });
  });
});

describe('specExamplesToCodeExamples', () => {
  test('converts array of examples', () => {
    const examples: SpecExample[] = [
      { code: 'a', title: 'First' },
      { code: 'b', title: 'Second' },
    ];
    const result = specExamplesToCodeExamples(examples);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('First');
    expect(result[1].label).toBe('Second');
  });

  test('handles mixed string and object examples', () => {
    const examples: (SpecExample | string)[] = [
      'string example',
      { code: 'object example', title: 'Object' },
    ];
    const result = specExamplesToCodeExamples(examples);
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('string example');
    expect(result[1].code).toBe('object example');
  });

  test('returns empty array for undefined', () => {
    const result = specExamplesToCodeExamples(undefined);
    expect(result).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    const result = specExamplesToCodeExamples([]);
    expect(result).toEqual([]);
  });
});

describe('generateDefaultExample', () => {
  test('generates import statement', () => {
    const result = generateDefaultExample('@acme/sdk', 'createUser', []);
    expect(result.code).toContain("import { createUser } from '@acme/sdk'");
  });

  test('generates function call with params', () => {
    const result = generateDefaultExample('@acme/sdk', 'createUser', ['name', 'email']);
    expect(result.code).toContain('createUser(name, email)');
  });

  test('generates function call without params', () => {
    const result = generateDefaultExample('@acme/sdk', 'getAll', []);
    expect(result.code).toContain('getAll()');
  });

  test('uses async/await', () => {
    const result = generateDefaultExample('@pkg', 'fn', []);
    expect(result.code).toContain('await');
  });

  test('sets id to default', () => {
    const result = generateDefaultExample('@pkg', 'fn', []);
    expect(result.id).toBe('default');
  });

  test('sets label to Basic', () => {
    const result = generateDefaultExample('@pkg', 'fn', []);
    expect(result.label).toBe('Basic');
  });

  test('sets language to typescript', () => {
    const result = generateDefaultExample('@pkg', 'fn', []);
    expect(result.language).toBe('typescript');
  });
});

describe('getLanguagesFromExamples', () => {
  test('extracts unique languages', () => {
    const examples = [
      { id: '1', label: 'A', code: 'a', language: 'typescript' },
      { id: '2', label: 'B', code: 'b', language: 'json' },
      { id: '3', label: 'C', code: 'c', language: 'typescript' },
    ];
    const result = getLanguagesFromExamples(examples);
    expect(result).toContain('typescript');
    expect(result).toContain('json');
    expect(result).toHaveLength(2);
  });

  test('defaults undefined language to typescript', () => {
    const examples = [
      { id: '1', label: 'A', code: 'a' },
    ];
    const result = getLanguagesFromExamples(examples);
    expect(result).toEqual(['typescript']);
  });

  test('returns empty array for empty input', () => {
    const result = getLanguagesFromExamples([]);
    expect(result).toEqual([]);
  });
});
