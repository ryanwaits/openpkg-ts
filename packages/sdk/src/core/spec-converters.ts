import type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecSchema,
  SpecSignatureParameter,
} from '@openpkg-ts/spec';
import { formatSchema } from './query';

// ── Shared types ─────────────────────────────────────────────

export interface CodeExample {
  /** Unique identifier */
  id: string;
  /** Display label for chip */
  label: string;
  /** Code content */
  code: string;
  /** Language for highlighting (e.g. 'ts', 'bash') */
  language?: string;
}

export interface Language {
  /** Language identifier (e.g. "typescript", "python") */
  id: string;
  /** Display label (e.g. "TypeScript", "Python") */
  label: string;
}

export interface APIParameterSchema {
  /** Type name */
  type?: string;
  /** Formatted type string */
  typeString?: string;
  /** Description */
  description?: string;
  /** Nested properties for object types */
  properties?: Record<string, APIParameterSchema>;
  /** Required property names */
  required?: string[];
}

// ── Utility functions ────────────────────────────────────────

export function getLangForHighlight(lang: string): string {
  const langMap: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    ts: 'ts',
    js: 'js',
    tsx: 'tsx',
    jsx: 'jsx',
    bash: 'bash',
    shell: 'bash',
    json: 'json',
    python: 'python',
    go: 'go',
    rust: 'rust',
  };
  return langMap[lang.toLowerCase()] || lang;
}

export function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    js: 'JavaScript',
    bash: 'Bash',
    json: 'JSON',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
  };
  return labels[lang.toLowerCase()] || lang;
}

export function specSchemaToAPISchema(
  schema: SpecSchema | undefined,
): APIParameterSchema | undefined {
  if (!schema || typeof schema !== 'object') return undefined;

  const s = schema as Record<string, unknown>;
  const result: APIParameterSchema = {};

  result.type = formatSchema(schema);
  result.typeString = result.type;

  if (typeof s.description === 'string') {
    result.description = s.description;
  }

  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    result.properties = {};
    for (const [key, value] of Object.entries(s.properties)) {
      const nested = specSchemaToAPISchema(value as SpecSchema);
      if (nested) result.properties[key] = nested;
    }
    if (Array.isArray(s.required)) {
      result.required = s.required as string[];
    }
  }

  return result;
}

export function specParamToAPIParam(param: SpecSignatureParameter): {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  children?: APIParameterSchema;
} {
  const type = formatSchema(param.schema);
  const children = specSchemaToAPISchema(param.schema);
  const hasNestedProperties =
    children?.properties && Object.keys(children.properties).length > 0;

  return {
    name: param.name ?? 'unknown',
    type,
    required: param.required !== false,
    description: param.description,
    children: hasNestedProperties ? children : undefined,
  };
}

/** Convert spec examples to CodeExample[] (Shape B: id/label/code/language) */
export function specExamplesToCodeExamples(
  examples: (string | SpecExample)[] | undefined,
  defaultLang = 'typescript',
): CodeExample[] {
  if (!examples?.length) return [];

  return examples.map((ex, i) => {
    const lang = typeof ex === 'string' ? defaultLang : ex.language || defaultLang;
    const code = typeof ex === 'string' ? ex : ex.code;
    const label =
      typeof ex === 'string'
        ? getLanguageLabel(lang)
        : ex.title || getLanguageLabel(lang);

    return {
      id: `example-${i}`,
      label,
      code,
      language: getLangForHighlight(lang),
    };
  });
}

export function getLanguagesFromExamples(
  examples: (string | SpecExample)[] | undefined,
): Language[] {
  if (!examples?.length) return [];

  const seen = new Set<string>();
  const result: Language[] = [];

  for (const ex of examples) {
    const lang = typeof ex === 'string' ? 'typescript' : ex.language || 'typescript';
    if (!seen.has(lang)) {
      seen.add(lang);
      result.push({ id: lang, label: getLanguageLabel(lang) });
    }
  }

  return result;
}

export function buildImportStatement(exp: SpecExport, spec: OpenPkg): string {
  const packageName = spec.meta?.name || 'package';
  const presentation = spec.extensions?.presentation?.[exp.id];
  const importPath = presentation?.importPath || packageName;
  const alias = presentation?.alias || exp.name;

  if (exp.kind === 'type' || exp.kind === 'interface') {
    return `import type { ${alias} } from '${importPath}'`;
  }
  return `import { ${alias} } from '${importPath}'`;
}
