// Styled React components (Tailwind v4)

// Adapters for converting spec data to component props
export {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
  specSchemaToAPISchema,
} from './adapters/spec-to-docskit';
// Also re-export headless components for composition
export * from './components/headless';
export type {
  APIPageProps,
  ClassPageProps,
  ClassSectionProps,
  CodeTab,
  CodeTabsProps,
  EnumPageProps,
  EnumSectionProps,
  ExportCardProps,
  ExportIndexPageProps,
  ExportSectionProps,
  FullAPIReferencePageProps,
  FunctionPageProps,
  FunctionSectionProps,
  ImportSectionProps,
  InterfacePageProps,
  InterfaceSectionProps,
  NestedPropertyItemProps,
  ParameterItemProps,
  VariablePageProps,
  VariableSectionProps,
} from './components/styled';
export {
  APIPage,
  ClassPage,
  ClassSection,
  CodeTabs,
  EnumPage,
  EnumSection,
  ExportCard,
  ExportIndexPage,
  ExportSection,
  FullAPIReferencePage,
  FunctionPage,
  FunctionSection,
  ImportSection,
  InterfacePage,
  InterfaceSection,
  ParameterItem,
  VariablePage,
  VariableSection,
} from './components/styled';
