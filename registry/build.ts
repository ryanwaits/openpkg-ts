#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';

// =============================================================================
// Types (shadcn-compatible)
// =============================================================================

interface RegistryFile {
  path: string;
  type: string;
  content: string;
  target?: string;
}

interface RegistryItem {
  $schema?: string;
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
  files: RegistryFile[];
}

interface Registry {
  $schema: string;
  name: string;
  homepage: string;
  items: Omit<RegistryItem, '$schema' | 'files'>[];
}

// =============================================================================
// Config
// =============================================================================

const REGISTRY_DIR = path.join(import.meta.dir, 'components');
const OUTPUT_DIR = path.join(import.meta.dir, 'r');
const INDEX_FILE = path.join(import.meta.dir, 'registry.json');

const REGISTRY_NAME = 'openpkg';
const REGISTRY_HOMEPAGE = 'https://openpkg.dev';
const SCHEMA_URL = 'https://ui.shadcn.com/schema/registry-item.json';

// Component metadata
const COMPONENT_META: Record<string, { title: string; description: string; type: string }> = {
  // Layout components (like fumadocs customise)
  'full-layout': {
    title: 'Full Layout',
    description: 'Single-page API reference layout with all exports',
    type: 'registry:block',
  },
  'index-layout': {
    title: 'Index Layout',
    description: 'API reference index with cards linking to exports',
    type: 'registry:block',
  },
  // Supabase/Stripe style layout components
  'api-reference-layout': {
    title: 'API Reference Layout',
    description: 'Two-column layout with sticky code examples panel',
    type: 'registry:block',
  },
  'sync-scroll-provider': {
    title: 'Sync Scroll Provider',
    description: 'Context provider for synchronized scrolling between columns',
    type: 'registry:component',
  },
  'method-section': {
    title: 'Method Section',
    description: 'Container for a single API method with title, signature, and parameters',
    type: 'registry:block',
  },
  // Stripe-style parameter components
  'api-parameter-item': {
    title: 'API Parameter Item',
    description: 'Single parameter row with name, type, badges, and description',
    type: 'registry:component',
  },
  'nested-parameter-toggle': {
    title: 'Nested Parameter Toggle',
    description: 'Show/Hide child parameters button with Stripe-style animation',
    type: 'registry:component',
  },
  'nested-parameter-container': {
    title: 'Nested Parameter Container',
    description: 'Bordered container for nested child parameters',
    type: 'registry:component',
  },
  'enum-values-section': {
    title: 'Enum Values Section',
    description: 'Display enum values with optional descriptions',
    type: 'registry:component',
  },
  // Code example components (right column)
  'example-chips': {
    title: 'Example Chips',
    description: 'Tab-like chips for switching between code examples',
    type: 'registry:component',
  },
  'code-panel': {
    title: 'Code Panel',
    description: 'Syntax-highlighted code block with Rose Pine theme',
    type: 'registry:component',
  },
  'collapsible-panel': {
    title: 'Collapsible Panel',
    description: 'Accordion-style panel for Response, Data source, Notes',
    type: 'registry:component',
  },
  'example-section': {
    title: 'Example Section',
    description: 'Complete right-column section with chips, code, and panels',
    type: 'registry:block',
  },
  // Section components
  'param-table': {
    title: 'Parameter Table',
    description: 'Function parameters table with types and descriptions',
    type: 'registry:component',
  },
  signature: {
    title: 'Signature',
    description: 'Type signature display',
    type: 'registry:component',
  },
  'function-section': {
    title: 'Function Section',
    description: 'Complete function documentation section',
    type: 'registry:block',
  },
  'class-section': {
    title: 'Class Section',
    description: 'Complete class documentation section',
    type: 'registry:block',
  },
  'interface-section': {
    title: 'Interface Section',
    description: 'Interface documentation with members table',
    type: 'registry:block',
  },
  'variable-section': {
    title: 'Variable Section',
    description: 'Variable/constant documentation section',
    type: 'registry:block',
  },
  'enum-section': {
    title: 'Enum Section',
    description: 'Enum documentation with members',
    type: 'registry:block',
  },
  'export-card': {
    title: 'Export Card',
    description: 'Summary card for an export',
    type: 'registry:component',
  },
  'export-index-page': {
    title: 'Export Index Page',
    description: 'Searchable index page for all exports',
    type: 'registry:block',
  },
  'members-table': {
    title: 'Members Table',
    description: 'Table for class/interface members',
    type: 'registry:component',
  },
  'type-table': {
    title: 'Type Table',
    description: 'Type properties table',
    type: 'registry:component',
  },
  'example-block': {
    title: 'Example Block',
    description: 'Code example display',
    type: 'registry:component',
  },
  'collapsible-method': {
    title: 'Collapsible Method',
    description: 'Expandable method documentation',
    type: 'registry:component',
  },
  'expandable-property': {
    title: 'Expandable Property',
    description: 'Expandable property with nested types',
    type: 'registry:component',
  },
  // Spec-connected components (Sprint 4)
  'method-section-from-spec': {
    title: 'Method Section From Spec',
    description: 'Auto-generate method documentation from OpenPkg spec',
    type: 'registry:block',
  },
  'stripe-api-reference-page': {
    title: 'Stripe API Reference Page',
    description: 'Full Stripe/Supabase-style API reference page with sync scroll',
    type: 'registry:block',
  },
};

// =============================================================================
// Helpers
// =============================================================================

function extractDependencies(source: string): {
  npm: string[];
  registry: string[];
} {
  const npmDeps = new Set<string>();
  const registryDeps = new Set<string>();

  const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];

    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Registry dependency - convert to component name
      const componentName = importPath.split('/').pop()?.replace(/\.tsx?$/, '');
      if (componentName) {
        const kebabName = componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        if (COMPONENT_META[kebabName]) {
          registryDeps.add(kebabName);
        }
      }
    } else if (!importPath.startsWith('.')) {
      // NPM package
      const pkgName = importPath.startsWith('@')
        ? importPath.split('/').slice(0, 2).join('/')
        : importPath.split('/')[0];
      if (pkgName !== 'react') {
        npmDeps.add(pkgName);
      }
    }
  }

  return {
    npm: Array.from(npmDeps),
    registry: Array.from(registryDeps),
  };
}

function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// =============================================================================
// Build
// =============================================================================

function buildRegistry(): { index: Registry; items: RegistryItem[] } {
  const items: RegistryItem[] = [];
  const indexItems: Registry['items'] = [];

  const componentDirs = fs.readdirSync(REGISTRY_DIR);

  for (const dir of componentDirs) {
    const componentPath = path.join(REGISTRY_DIR, dir);
    if (!fs.statSync(componentPath).isDirectory()) continue;

    const meta = COMPONENT_META[dir];
    if (!meta) {
      console.warn(`No metadata for component: ${dir}, skipping`);
      continue;
    }

    const files: RegistryFile[] = [];
    const componentFiles = fs.readdirSync(componentPath);
    let allContent = '';

    for (const file of componentFiles) {
      if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;

      const filePath = path.join(componentPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      allContent += content;

      // Target path for installation
      const targetFile = file.replace('.tsx', '.tsx').replace('.ts', '.ts');

      files.push({
        path: `components/api/${dir}/${targetFile}`,
        type: 'registry:component',
        content,
      });
    }

    if (files.length === 0) continue;

    const deps = extractDependencies(allContent);

    const item: RegistryItem = {
      $schema: SCHEMA_URL,
      name: dir,
      type: meta.type,
      title: meta.title,
      description: meta.description,
      dependencies: deps.npm,
      devDependencies: [],
      registryDependencies: deps.registry,
      files,
    };

    items.push(item);

    // Index entry (without files and $schema)
    indexItems.push({
      name: dir,
      type: meta.type,
      title: meta.title,
      description: meta.description,
      dependencies: deps.npm,
      devDependencies: [],
      registryDependencies: deps.registry,
    });
  }

  // Sort by name
  items.sort((a, b) => a.name.localeCompare(b.name));
  indexItems.sort((a, b) => a.name.localeCompare(b.name));

  const index: Registry = {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: REGISTRY_NAME,
    homepage: REGISTRY_HOMEPAGE,
    items: indexItems,
  };

  return { index, items };
}

// =============================================================================
// Main
// =============================================================================

// Build registry
const { index, items } = buildRegistry();

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write main registry.json index
fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

// Write individual item files
for (const item of items) {
  const itemPath = path.join(OUTPUT_DIR, `${item.name}.json`);
  fs.writeFileSync(itemPath, JSON.stringify(item, null, 2));
}

console.log(`Built shadcn-compatible registry:`);
console.log(`  Index: registry.json (${index.items.length} items)`);
console.log(`  Items: r/*.json`);
console.log(`\nComponents: ${items.map((i) => i.name).join(', ')}`);
console.log(`\nUsage: npx shadcn@latest add @openpkg/<component>`);
