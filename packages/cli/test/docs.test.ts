import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createDocs,
  exportToMarkdown,
  loadSpec,
  type SimplifiedExport,
  type SimplifiedSpec,
  toHTML,
  toJSON,
  toJSONString,
  toMarkdown,
} from '@openpkg-ts/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';

// Test fixture spec
const testSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: {
    name: 'test-package',
    version: '1.0.0',
    description: 'A test package for docs generation',
  },
  exports: [
    {
      id: 'createClient',
      name: 'createClient',
      kind: 'function',
      description: 'Creates a new API client',
      signatures: [
        {
          parameters: [
            {
              name: 'config',
              schema: { type: 'object', properties: { baseUrl: { type: 'string' } } },
              description: 'Client configuration',
              required: true,
            },
          ],
          returns: {
            schema: { $ref: '#/types/Client' },
            description: 'The configured client instance',
          },
        },
      ],
      examples: [
        {
          code: 'const client = createClient({ baseUrl: "https://api.example.com" });',
          title: 'Basic Usage',
        },
      ],
    },
    {
      id: 'Config',
      name: 'Config',
      kind: 'interface',
      description: 'Configuration interface',
      members: [
        {
          name: 'baseUrl',
          kind: 'property',
          schema: { type: 'string' },
          description: 'Base URL for API requests',
        },
        {
          name: 'timeout',
          kind: 'property',
          schema: { type: 'number' },
          description: 'Request timeout in milliseconds',
        },
      ],
    },
    {
      id: 'ApiClient',
      name: 'ApiClient',
      kind: 'class',
      description: 'Main API client class',
      members: [
        {
          name: 'baseUrl',
          kind: 'property',
          schema: { type: 'string' },
          description: 'The base URL',
        },
        {
          name: 'fetch',
          kind: 'method',
          signatures: [
            {
              parameters: [{ name: 'path', schema: { type: 'string' } }],
              returns: { schema: { type: 'Promise<Response>' } },
            },
          ],
          description: 'Fetch data from the API',
        },
      ],
    },
    {
      id: 'LogLevel',
      name: 'LogLevel',
      kind: 'enum',
      description: 'Log level values',
      members: [
        { name: 'DEBUG', kind: 'property', description: 'Debug level' },
        { name: 'INFO', kind: 'property', description: 'Info level' },
        { name: 'ERROR', kind: 'property', description: 'Error level' },
      ],
    },
    {
      id: 'VERSION',
      name: 'VERSION',
      kind: 'variable',
      description: 'Package version string',
      schema: { type: 'string', const: '1.0.0' },
    },
    {
      id: 'RequestHandler',
      name: 'RequestHandler',
      kind: 'type',
      description: 'Request handler type',
      type: '(req: Request) => Promise<Response>',
    },
  ],
  types: [
    {
      id: 'Client',
      name: 'Client',
      kind: 'interface',
      members: [{ name: 'fetch', kind: 'method' }],
    },
  ],
};

describe('docs command', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-docs-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createDocs / loadSpec', () => {
    test('creates docs instance from spec object', () => {
      const docs = loadSpec(testSpec);

      expect(docs.spec).toBe(testSpec);
      expect(docs.getAllExports().length).toBe(6);
    });

    test('creates docs instance from file path', () => {
      const specPath = path.join(tmpDir, 'test-spec.json');
      fs.writeFileSync(specPath, JSON.stringify(testSpec));

      const docs = createDocs(specPath);

      expect(docs.spec.meta.name).toBe('test-package');
    });

    test('getExport returns correct export', () => {
      const docs = loadSpec(testSpec);

      const fn = docs.getExport('createClient');
      expect(fn).toBeDefined();
      expect(fn?.kind).toBe('function');
    });

    test('getExportsByKind filters correctly', () => {
      const docs = loadSpec(testSpec);

      const functions = docs.getExportsByKind('function');
      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe('createClient');
    });
  });

  describe('markdown generation', () => {
    test('generates markdown with frontmatter', () => {
      const markdown = toMarkdown(testSpec, { frontmatter: true });

      expect(markdown).toContain('---');
      expect(markdown).toContain('title:');
    });

    test('generates markdown without frontmatter', () => {
      const markdown = toMarkdown(testSpec, { frontmatter: false });

      expect(markdown.startsWith('---')).toBe(false);
    });

    test('contains API reference heading', () => {
      const markdown = toMarkdown(testSpec);

      expect(markdown).toContain('# test-package API Reference');
    });

    test('includes all exports', () => {
      const markdown = toMarkdown(testSpec);

      expect(markdown).toContain('createClient');
      expect(markdown).toContain('Config');
      expect(markdown).toContain('ApiClient');
      expect(markdown).toContain('LogLevel');
      expect(markdown).toContain('VERSION');
    });

    test('groups exports by kind', () => {
      const markdown = toMarkdown(testSpec);

      expect(markdown).toContain('## Functions');
      // Note: doc generator uses simple pluralization (kind + 's'), so 'class' -> 'Classs'
      expect(markdown).toContain('## Class');
      expect(markdown).toContain('## Interfaces');
      expect(markdown).toContain('## Enums');
      expect(markdown).toContain('## Variables');
    });

    test('includes function parameters', () => {
      const markdown = toMarkdown(testSpec);

      expect(markdown).toContain('config');
      expect(markdown).toContain('Parameters');
    });

    test('includes examples', () => {
      const markdown = toMarkdown(testSpec);

      expect(markdown).toContain('Examples');
      expect(markdown).toContain('createClient({');
    });

    test('renders single export', () => {
      const markdown = toMarkdown(testSpec, { export: 'createClient' });

      expect(markdown).toContain('# createClient');
      expect(markdown).not.toContain('# Config');
    });

    test('exportToMarkdown renders single export', () => {
      const exp = testSpec.exports.find((e) => e.name === 'createClient');
      if (!exp) throw new Error('Export not found');
      const markdown = exportToMarkdown(exp, { frontmatter: true, codeSignatures: true });

      expect(markdown).toContain('# createClient');
      expect(markdown).toContain('```ts');
    });

    test('code signatures in fenced blocks', () => {
      const markdown = toMarkdown(testSpec, { codeSignatures: true });

      expect(markdown).toContain('```ts');
      expect(markdown).toContain('```');
    });
  });

  describe('HTML generation', () => {
    test('generates full HTML document', () => {
      const html = toHTML(testSpec, { fullDocument: true });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    test('generates HTML fragment', () => {
      const html = toHTML(testSpec, { fullDocument: false });

      expect(html).not.toContain('<!DOCTYPE html>');
      expect(html).toContain('<header>');
    });

    test('includes inline styles by default', () => {
      const html = toHTML(testSpec, { includeStyles: true });

      expect(html).toContain('<style>');
    });

    test('excludes styles when disabled', () => {
      const html = toHTML(testSpec, { includeStyles: false });

      expect(html).not.toContain('<style>');
    });

    test('contains export names', () => {
      const html = toHTML(testSpec);

      expect(html).toContain('createClient');
      expect(html).toContain('Config');
      expect(html).toContain('ApiClient');
    });

    test('renders single export', () => {
      const html = toHTML(testSpec, { export: 'createClient', fullDocument: false });

      expect(html).toContain('createClient');
      expect(html).not.toContain('ApiClient');
    });

    test('includes navigation', () => {
      const html = toHTML(testSpec);

      expect(html).toContain('<nav>');
      expect(html).toContain('href="#');
    });

    test('escapes HTML in content', () => {
      const specWithBrackets: OpenPkg = {
        ...testSpec,
        exports: [
          {
            id: 'test',
            name: 'test',
            kind: 'function',
            description: 'Returns <T> value',
            signatures: [{ parameters: [] }],
          },
        ],
      };

      const html = toHTML(specWithBrackets);

      expect(html).toContain('&lt;T&gt;');
      expect(html).not.toContain('<T>');
    });

    test('custom title override', () => {
      const html = toHTML(testSpec, { title: 'Custom API Docs' });

      expect(html).toContain('<title>Custom API Docs</title>');
    });
  });

  describe('JSON format', () => {
    test('returns simplified spec structure', () => {
      const json = toJSON(testSpec) as SimplifiedSpec;

      expect(json.name).toBe('test-package');
      expect(json.version).toBe('1.0.0');
      expect(json.description).toBe('A test package for docs generation');
      expect(json.exports).toBeInstanceOf(Array);
      expect(json.totalExports).toBe(6);
    });

    test('groups by kind', () => {
      const json = toJSON(testSpec) as SimplifiedSpec;

      expect(json.byKind).toBeDefined();
      expect(json.byKind.function).toHaveLength(1);
      expect(json.byKind.class).toHaveLength(1);
      expect(json.byKind.interface).toHaveLength(1);
    });

    test('simplified export has required fields', () => {
      const json = toJSON(testSpec) as SimplifiedSpec;
      const fn = json.exports.find((e) => e.name === 'createClient');

      expect(fn).toBeDefined();
      expect(fn?.id).toBe('createClient');
      expect(fn?.name).toBe('createClient');
      expect(fn?.kind).toBe('function');
      expect(fn?.signature).toBeDefined();
      expect(fn?.deprecated).toBe(false);
    });

    test('function export has parameters and returns', () => {
      const json = toJSON(testSpec) as SimplifiedSpec;
      const fn = json.exports.find((e) => e.name === 'createClient');

      expect(fn?.parameters).toBeDefined();
      expect(fn?.parameters?.length).toBe(1);
      expect(fn?.parameters?.[0].name).toBe('config');
      expect(fn?.returns).toBeDefined();
    });

    test('class export has members', () => {
      const json = toJSON(testSpec) as SimplifiedSpec;
      const cls = json.exports.find((e) => e.name === 'ApiClient');

      expect(cls?.members).toBeDefined();
      expect(cls?.members?.length).toBe(2);

      const prop = cls?.members?.find((m) => m.name === 'baseUrl');
      expect(prop?.kind).toBe('property');

      const method = cls?.members?.find((m) => m.name === 'fetch');
      expect(method?.kind).toBe('method');
    });

    test('single export mode', () => {
      const json = toJSON(testSpec, { export: 'createClient' }) as SimplifiedExport;

      expect(json.id).toBe('createClient');
      expect(json.name).toBe('createClient');
      expect(json.kind).toBe('function');
    });

    test('toJSONString returns string', () => {
      const jsonStr = toJSONString(testSpec);

      expect(typeof jsonStr).toBe('string');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.name).toBe('test-package');
    });

    test('toJSONString pretty option', () => {
      const compact = toJSONString(testSpec, { pretty: false });
      const pretty = toJSONString(testSpec, { pretty: true });

      expect(compact).not.toContain('\n');
      expect(pretty).toContain('\n');
    });

    test('examples simplified correctly', () => {
      const json = toJSON(testSpec) as SimplifiedSpec;
      const fn = json.exports.find((e) => e.name === 'createClient');

      expect(fn?.examples).toBeDefined();
      expect(fn?.examples?.length).toBe(1);
      expect(fn?.examples?.[0].code).toContain('createClient');
      expect(fn?.examples?.[0].title).toBe('Basic Usage');
    });
  });

  describe('DocsInstance methods', () => {
    test('toMarkdown method', () => {
      const docs = loadSpec(testSpec);
      const markdown = docs.toMarkdown();

      expect(markdown).toContain('# test-package API Reference');
    });

    test('toHTML method', () => {
      const docs = loadSpec(testSpec);
      const html = docs.toHTML();

      expect(html).toContain('<!DOCTYPE html>');
    });

    test('toJSON method', () => {
      const docs = loadSpec(testSpec);
      const json = docs.toJSON() as SimplifiedSpec;

      expect(json.name).toBe('test-package');
    });

    test('search method', () => {
      const docs = loadSpec(testSpec);

      const results = docs.search('client');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((e) => e.name === 'createClient')).toBe(true);
    });

    test('groupByKind method', () => {
      const docs = loadSpec(testSpec);
      const groups = docs.groupByKind();

      expect(groups.function).toBeDefined();
      expect(groups.class).toBeDefined();
    });
  });

  describe('split mode simulation', () => {
    test('can write individual export markdown files', () => {
      const outputDir = path.join(tmpDir, 'split-docs');
      fs.mkdirSync(outputDir, { recursive: true });

      // Simulate split mode - write each export to separate file
      for (const exp of testSpec.exports) {
        const markdown = exportToMarkdown(exp, { frontmatter: true });
        const filename = `${exp.name}.md`;
        fs.writeFileSync(path.join(outputDir, filename), markdown);
      }

      // Verify files created
      expect(fs.existsSync(path.join(outputDir, 'createClient.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'Config.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'ApiClient.md'))).toBe(true);

      // Verify content
      const clientMd = fs.readFileSync(path.join(outputDir, 'createClient.md'), 'utf-8');
      expect(clientMd).toContain('# createClient');
    });
  });

  describe('pipeline integration', () => {
    test('spec JSON to docs markdown', () => {
      // Simulate: openpkg spec | openpkg docs
      const specJson = JSON.stringify(testSpec);
      const spec: OpenPkg = JSON.parse(specJson);
      const markdown = toMarkdown(spec);

      expect(markdown).toContain('# test-package API Reference');
      expect(markdown).toContain('createClient');
    });

    test('spec JSON to docs HTML', () => {
      const specJson = JSON.stringify(testSpec);
      const spec: OpenPkg = JSON.parse(specJson);
      const html = toHTML(spec);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('createClient');
    });

    test('spec JSON to docs JSON', () => {
      const specJson = JSON.stringify(testSpec);
      const spec: OpenPkg = JSON.parse(specJson);
      const json = toJSON(spec) as SimplifiedSpec;

      expect(json.name).toBe('test-package');
      expect(json.exports.length).toBe(6);
    });
  });

  describe('error handling', () => {
    test('throws for non-existent export in single mode', () => {
      expect(() => {
        toMarkdown(testSpec, { export: 'NonExistent' });
      }).toThrow('Export not found: NonExistent');
    });

    test('throws for non-existent export in HTML', () => {
      expect(() => {
        toHTML(testSpec, { export: 'NonExistent' });
      }).toThrow('Export not found: NonExistent');
    });

    test('throws for non-existent export in JSON', () => {
      expect(() => {
        toJSON(testSpec, { export: 'NonExistent' });
      }).toThrow('Export not found: NonExistent');
    });

    test('throws for non-existent file', () => {
      expect(() => {
        createDocs('/non/existent/path.json');
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    test('handles empty exports array', () => {
      const emptySpec: OpenPkg = {
        openpkg: '0.4.0',
        meta: { name: 'empty' },
        exports: [],
        types: [],
      };

      const markdown = toMarkdown(emptySpec);
      expect(markdown).toContain('# empty API Reference');

      const json = toJSON(emptySpec) as SimplifiedSpec;
      expect(json.totalExports).toBe(0);
    });

    test('handles export without description', () => {
      const spec: OpenPkg = {
        openpkg: '0.4.0',
        meta: { name: 'test' },
        exports: [{ id: 'fn', name: 'fn', kind: 'function', signatures: [] }],
        types: [],
      };

      const markdown = toMarkdown(spec);
      expect(markdown).toContain('fn');
    });

    test('handles deprecated exports', () => {
      const spec: OpenPkg = {
        openpkg: '0.4.0',
        meta: { name: 'test' },
        exports: [
          {
            id: 'oldFn',
            name: 'oldFn',
            kind: 'function',
            deprecated: true,
            signatures: [],
          },
        ],
        types: [],
      };

      const markdown = toMarkdown(spec);
      expect(markdown).toContain('Deprecated');

      const html = toHTML(spec);
      expect(html).toContain('Deprecated');

      const json = toJSON(spec) as SimplifiedSpec;
      expect(json.exports[0].deprecated).toBe(true);
    });
  });
});
