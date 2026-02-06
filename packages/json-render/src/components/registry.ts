import type { ReactNode } from 'react';
import { APIReferencePageWrapper } from './wrappers/api-reference-page';
import { APISectionWrapper } from './wrappers/api-section';
import { APISectionSingleWrapper } from './wrappers/api-section-single';
import { CodeBlockWrapper } from './wrappers/code-block';
import { ExportSectionWrapper } from './wrappers/export-section';
import { ExportIndexPageWrapper } from './wrappers/export-index-page';
import { InstallBlockWrapper } from './wrappers/install-block';
import { ParameterListWrapper } from './wrappers/parameter-list';
import { ResponseBlockWrapper } from './wrappers/response-block';
import { SectionWrapper } from './wrappers/section';

type ComponentFn = (props: { props: Record<string, unknown>; children?: ReactNode }) => ReactNode;

/** Registry mapping catalog component names to React wrapper components */
export const openpkgComponents: Record<string, ComponentFn> = {
  APIReferencePage: APIReferencePageWrapper as ComponentFn,
  APISection: APISectionWrapper as ComponentFn,
  APISectionSingle: APISectionSingleWrapper as ComponentFn,
  CodeBlock: CodeBlockWrapper as ComponentFn,
  ExportSection: ExportSectionWrapper as ComponentFn,
  ExportIndexPage: ExportIndexPageWrapper as ComponentFn,
  InstallBlock: InstallBlockWrapper as ComponentFn,
  ParameterList: ParameterListWrapper as ComponentFn,
  ResponseBlock: ResponseBlockWrapper as ComponentFn,
  Section: SectionWrapper as ComponentFn,
};
