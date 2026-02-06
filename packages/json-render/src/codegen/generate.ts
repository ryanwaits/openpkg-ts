import {
  collectUsedComponents,
  traverseSpec,
  type GeneratedFile,
} from '@json-render/codegen';
import type { Spec, UIElement } from '@json-render/core';
import type { PreparedSpecData } from '../types';
import { emitters } from './emitters';
import { nextjsFiles, standaloneFiles, viteFiles } from './frameworks';
import { generateDataFile } from './serialize-data';
import type { CodegenOptions, DataStrategy } from './types';

/**
 * Generate standalone React code from a json-render Spec + PreparedSpecData.
 * Produces files that use `@openpkg-ts/registry/docskit` components directly.
 */
export function generateCode(
  spec: Spec,
  data: PreparedSpecData,
  options: CodegenOptions,
): GeneratedFile[] {
  const dataStrategy: DataStrategy = options.dataStrategy ?? 'file';
  const usedComponents = collectUsedComponents(spec);
  const hasExportIndexPage = usedComponents.has('ExportIndexPage');

  // Collect all referenced exportIds for data trimming
  const usedExportIds = collectExportIds(spec);

  // Generate the main component JSX
  const jsx = emitElement(spec.root, spec, data, dataStrategy, 2);

  // Determine imports
  const imports = buildImports(usedComponents, dataStrategy, hasExportIndexPage);

  // Assemble component file
  const componentCode = assembleComponent(imports, jsx, dataStrategy);

  // Generate data file (if file strategy)
  const dataFileCode = dataStrategy === 'file'
    ? generateDataFile(data, usedExportIds)
    : null;

  // Generate ExportIndexPage client component if needed
  const exportIndexCode = hasExportIndexPage
    ? generateExportIndexComponent(data, dataStrategy)
    : null;

  // Apply framework template
  switch (options.framework) {
    case 'nextjs':
      return nextjsFiles(componentCode, dataFileCode, hasExportIndexPage, exportIndexCode);
    case 'vite':
      return viteFiles(componentCode, dataFileCode, hasExportIndexPage, exportIndexCode);
    case 'standalone':
      return standaloneFiles(componentCode, dataFileCode, hasExportIndexPage, exportIndexCode);
  }
}

/** DFS emit JSX for an element and its children */
function emitElement(
  key: string,
  spec: Spec,
  data: PreparedSpecData,
  dataStrategy: DataStrategy,
  indentLevel: number,
): string {
  const element = spec.elements[key];
  if (!element) return '';

  const indent = '  '.repeat(indentLevel);

  // Recurse children first
  const childrenParts: string[] = [];
  if (element.children?.length) {
    for (const childKey of element.children) {
      const childJsx = emitElement(childKey, spec, data, dataStrategy, indentLevel + 1);
      if (childJsx) childrenParts.push(childJsx);
    }
  }

  const childrenJsx = childrenParts.join('\n');

  const emitter = emitters[element.type];
  if (!emitter) {
    return `${indent}{/* unsupported component: ${element.type} */}`;
  }

  return emitter(element, {
    data,
    dataStrategy,
    indent,
    childrenJsx,
  });
}

/** Collect all exportId props from the spec */
function collectExportIds(spec: Spec): string[] {
  const ids = new Set<string>();
  traverseSpec(spec, (element: UIElement) => {
    const exportId = (element.props as Record<string, unknown>).exportId;
    if (typeof exportId === 'string') {
      ids.add(exportId);
    }
  });
  return Array.from(ids);
}

/** Build import statements for the generated component */
function buildImports(
  usedComponents: Set<string>,
  dataStrategy: DataStrategy,
  hasExportIndexPage: boolean,
): string[] {
  const lines: string[] = [];

  // Determine which docskit components we need
  const docskitImports = new Set<string>();

  // Map catalog types to actual docskit imports
  const needsAPIReferencePage = usedComponents.has('APIReferencePage');
  const needsAPISection = usedComponents.has('APISection') || usedComponents.has('ExportSection');
  const needsAPISectionSingle = usedComponents.has('APISectionSingle') || usedComponents.has('ExportSection');
  const needsParameterList = usedComponents.has('ParameterList') || needsAPISection;
  const needsExpandableParameter = needsAPISection || needsAPISectionSingle || usedComponents.has('ParameterList');
  const needsCodeBlock = usedComponents.has('CodeBlock');
  const needsPackageInstall = usedComponents.has('InstallBlock');
  const needsWithHover = usedComponents.has('Section'); // Section may use WithHover

  if (needsAPIReferencePage) docskitImports.add('APIReferencePage');
  if (needsAPISection) docskitImports.add('APISection');
  if (needsAPISectionSingle) docskitImports.add('APISectionSingle');
  if (needsParameterList) docskitImports.add('ParameterList');
  if (needsExpandableParameter) docskitImports.add('ExpandableParameter');
  if (needsCodeBlock) docskitImports.add('CodeBlock');
  if (needsPackageInstall) docskitImports.add('PackageInstall');
  if (needsWithHover) docskitImports.add('WithHover');

  if (docskitImports.size > 0) {
    const sorted = Array.from(docskitImports).sort();
    lines.push(`import {\n  ${sorted.join(',\n  ')},\n} from "@openpkg-ts/registry/docskit";`);
  }

  // Data import
  if (dataStrategy === 'file') {
    lines.push(`import { specData } from "./data";`);
  }

  // ExportIndexPage import
  if (hasExportIndexPage) {
    lines.push(`import { ExportIndexPage } from "./ExportIndexPage";`);
  }

  return lines;
}

/** Assemble the full component file content */
function assembleComponent(
  imports: string[],
  jsx: string,
  _dataStrategy: DataStrategy,
): string {
  const lines: string[] = [];

  lines.push(...imports);
  lines.push('');
  lines.push('export default function APIReference() {');
  lines.push('  return (');
  lines.push(jsx);
  lines.push('  );');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/** Generate the ExportIndexPage as a standalone client component */
function generateExportIndexComponent(
  data: PreparedSpecData,
  dataStrategy: DataStrategy,
): string {
  const lines: string[] = [];

  lines.push(`"use client";`);
  lines.push('');
  lines.push(`import { useMemo, useState } from "react";`);
  if (dataStrategy === 'file') {
    lines.push(`import { specData } from "./data";`);
  }
  lines.push('');

  if (dataStrategy === 'inline') {
    // Inline the full data needed
    lines.push(`const data = ${JSON.stringify({
      packageName: data.packageName,
      packageDescription: data.packageDescription,
      allExportIds: data.allExportIds,
      exports: Object.fromEntries(
        data.allExportIds.map((id) => {
          const exp = data.exports[id];
          return [id, { id: exp.id, name: exp.name, kind: exp.kind, title: exp.title, description: exp.description }];
        }),
      ),
      exportsByKind: Object.fromEntries(
        Object.entries(data.exportsByKind).map(([kind, exps]) => [
          kind,
          exps.map((e) => ({ id: e.id })),
        ]),
      ),
    }, null, 2)};`);
    lines.push('');
  }

  const dataVar = dataStrategy === 'file' ? 'specData' : 'data';

  lines.push(`export function ExportIndexPage() {`);
  lines.push(`  const [search, setSearch] = useState("");`);
  lines.push(`  const [kindFilter, setKindFilter] = useState<string | null>(null);`);
  lines.push('');
  lines.push(`  const kinds = useMemo(() => Object.keys(${dataVar}.exportsByKind).sort(), []);`);
  lines.push('');
  lines.push(`  const filtered = useMemo(() => {`);
  lines.push(`    let exports = ${dataVar}.allExportIds.map((id) => ${dataVar}.exports[id]);`);
  lines.push(`    if (kindFilter) exports = exports.filter((e) => e.kind === kindFilter);`);
  lines.push(`    if (search) {`);
  lines.push(`      const q = search.toLowerCase();`);
  lines.push(`      exports = exports.filter(`);
  lines.push(`        (e) => e.name.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)`);
  lines.push(`      );`);
  lines.push(`    }`);
  lines.push(`    return exports;`);
  lines.push(`  }, [search, kindFilter]);`);
  lines.push('');
  lines.push(`  return (`);
  lines.push(`    <div className="max-w-5xl mx-auto py-8 px-6">`);
  lines.push(`      <h1 className="text-3xl font-semibold mb-2">{${dataVar}.packageName}</h1>`);
  lines.push(`      {${dataVar}.packageDescription && (`);
  lines.push(`        <p className="text-muted-foreground mb-6">{${dataVar}.packageDescription}</p>`);
  lines.push(`      )}`);
  lines.push(`      <input`);
  lines.push(`        type="text"`);
  lines.push(`        placeholder="Search exports..."`);
  lines.push(`        value={search}`);
  lines.push(`        onChange={(e) => setSearch(e.target.value)}`);
  lines.push(`        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground mb-4"`);
  lines.push(`      />`);
  lines.push(`      {kinds.length > 1 && (`);
  lines.push(`        <div className="flex gap-2 mb-6 flex-wrap">`);
  lines.push(`          <button`);
  lines.push(`            type="button"`);
  lines.push(`            onClick={() => setKindFilter(null)}`);
  lines.push("            className={`px-3 py-1 text-sm rounded-full border cursor-pointer ${");
  lines.push("              !kindFilter ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground'");
  lines.push("            }`}");
  lines.push(`          >`);
  lines.push(`            All ({${dataVar}.allExportIds.length})`);
  lines.push(`          </button>`);
  lines.push(`          {kinds.map((kind) => (`);
  lines.push(`            <button`);
  lines.push(`              key={kind}`);
  lines.push(`              type="button"`);
  lines.push(`              onClick={() => setKindFilter(kind === kindFilter ? null : kind)}`);
  lines.push("              className={`px-3 py-1 text-sm rounded-full border cursor-pointer ${");
  lines.push("                kindFilter === kind ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground'");
  lines.push("              }`}");
  lines.push(`            >`);
  lines.push(`              {kind} ({${dataVar}.exportsByKind[kind].length})`);
  lines.push(`            </button>`);
  lines.push(`          ))}`);
  lines.push(`        </div>`);
  lines.push(`      )}`);
  lines.push(`      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">`);
  lines.push(`        {filtered.map((exp) => (`);
  lines.push(`          <a`);
  lines.push(`            key={exp.id}`);
  lines.push("            href={`#${exp.id}`}");
  lines.push(`            className="block p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"`);
  lines.push(`          >`);
  lines.push(`            <div className="flex items-center gap-2 mb-1">`);
  lines.push(`              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">`);
  lines.push(`                {exp.kind}`);
  lines.push(`              </span>`);
  lines.push(`            </div>`);
  lines.push(`            <h3 className="font-mono text-sm font-medium">{exp.title}</h3>`);
  lines.push(`            {exp.description && (`);
  lines.push(`              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{exp.description}</p>`);
  lines.push(`            )}`);
  lines.push(`          </a>`);
  lines.push(`        ))}`);
  lines.push(`      </div>`);
  lines.push(`    </div>`);
  lines.push(`  );`);
  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}
