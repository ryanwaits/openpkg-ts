import type { SpecExample } from '@openpkg-ts/spec';
import type { CodeExample } from '../components/styled/ExampleSection';

/**
 * Convert a SpecExample to CodeExample props for ExampleSection.
 *
 * @example
 * ```tsx
 * const examples = spec.examples?.map(specExampleToCodeExample) ?? [];
 * return <ExampleSection examples={examples} />;
 * ```
 */
export function specExampleToCodeExample(
  example: SpecExample | string,
  index: number,
): CodeExample {
  // Handle string shorthand
  if (typeof example === 'string') {
    return {
      id: `example-${index}`,
      label: `Example ${index + 1}`,
      code: example,
      language: 'typescript',
    };
  }

  // Full SpecExample
  return {
    id: example.title?.toLowerCase().replace(/\s+/g, '-') ?? `example-${index}`,
    label: example.title ?? `Example ${index + 1}`,
    code: example.code,
    language: mapLanguage(example.language),
  };
}

/**
 * Convert multiple examples.
 */
export function specExamplesToCodeExamples(
  examples: (SpecExample | string)[] | undefined,
): CodeExample[] {
  if (!examples || examples.length === 0) return [];
  return examples.map(specExampleToCodeExample);
}

/**
 * Generate a default code example from function signature.
 */
export function generateDefaultExample(
  packageName: string,
  exportName: string,
  paramNames: string[],
): CodeExample {
  const importLine = `import { ${exportName} } from '${packageName}';`;
  const callArgs = paramNames.length > 0 ? paramNames.join(', ') : '';
  const callLine = `const result = await ${exportName}(${callArgs});`;

  return {
    id: 'default',
    label: 'Basic',
    code: `${importLine}\n\n${callLine}`,
    language: 'typescript',
  };
}

/**
 * Map SpecExampleLanguage to CodePanel language.
 */
function mapLanguage(lang: string | undefined): string {
  switch (lang) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'shell':
      return 'bash';
    case 'json':
      return 'json';
    default:
      return 'typescript';
  }
}

/**
 * Get available languages from examples for filtering.
 */
export function getLanguagesFromExamples(examples: CodeExample[]): string[] {
  const langs = new Set<string>();
  for (const ex of examples) {
    langs.add(ex.language ?? 'typescript');
  }
  return Array.from(langs);
}
