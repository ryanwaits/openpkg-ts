import type { GeneratedFile } from '@json-render/codegen';

export function standaloneFiles(
  componentCode: string,
  dataFileCode: string | null,
  hasExportIndexPage: boolean,
  exportIndexCode: string | null,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  files.push({
    path: 'APIReference.tsx',
    content: componentCode,
  });

  if (dataFileCode) {
    files.push({ path: 'data.ts', content: dataFileCode });
  }

  if (hasExportIndexPage && exportIndexCode) {
    files.push({ path: 'ExportIndexPage.tsx', content: exportIndexCode });
  }

  return files;
}
