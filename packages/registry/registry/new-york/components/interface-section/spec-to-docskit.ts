import { formatSchema } from '@openpkg-ts/sdk/browser';
import type {
  OpenPkg,
  SpecExample,
  SpecExport,
  SpecSchema,
  SpecSignatureParameter,
} from '@openpkg-ts/spec';
import type { APIParameterSchema, CodeExample, Language } from '@openpkg-ts/ui/docskit';

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
      const nestedSchema = specSchemaToAPISchema(value as SpecSchema);
      if (nestedSchema) {
        result.properties[key] = nestedSchema;
      }
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
  const hasNestedProperties = children?.properties && Object.keys(children.properties).length > 0;

  return {
    name: param.name ?? 'unknown',
    type,
    required: param.required !== false,
    description: param.description,
    children: hasNestedProperties ? children : undefined,
  };
}

export function specExamplesToCodeExamples(
  examples: SpecExample[] | undefined,
  defaultLang = 'typescript',
): CodeExample[] {
  if (!examples?.length) return [];

  return examples.map((example) => {
    if (typeof example === 'string') {
      return {
        languageId: defaultLang,
        code: example,
        highlightLang: getLangForHighlight(defaultLang),
      };
    }
    return {
      languageId: example.language || defaultLang,
      code: example.code,
      highlightLang: getLangForHighlight(example.language || defaultLang),
    };
  });
}

function getLangForHighlight(lang: string): string {
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

export function getLanguagesFromExamples(examples: SpecExample[] | undefined): Language[] {
  if (!examples?.length) return [];

  const langSet = new Set<string>();
  const languages: Language[] = [];

  for (const example of examples) {
    const lang = typeof example === 'string' ? 'typescript' : example.language || 'typescript';
    if (!langSet.has(lang)) {
      langSet.add(lang);
      languages.push({
        id: lang,
        label: getLanguageLabel(lang),
      });
    }
  }

  return languages;
}

function getLanguageLabel(lang: string): string {
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
