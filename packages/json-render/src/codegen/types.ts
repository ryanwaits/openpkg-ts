export type { GeneratedFile } from '@json-render/codegen';

export type FrameworkTarget = 'nextjs' | 'vite' | 'standalone';
export type DataStrategy = 'inline' | 'file';

export interface CodegenOptions {
  framework: FrameworkTarget;
  dataStrategy?: DataStrategy; // default 'file'
  typescript?: boolean; // default true
}
