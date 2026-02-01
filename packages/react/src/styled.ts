// Styled React components (Tailwind v4)

// Adapters for converting spec data to component props
export {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
  specSchemaToAPISchema,
} from './adapters/spec-to-docskit';
export {
  generateDefaultExample,
  specExampleToCodeExample,
} from './adapters/spec-to-examples';
export type { NestedParameterData } from './adapters/spec-to-params';
export {
  resolveSchemaRef,
  specParamsToNestedParams,
  specParamToNestedParam,
} from './adapters/spec-to-params';
// Hooks for spec data
export type { MethodData } from './hooks/useMethodFromSpec';
export {
  extractMethodData,
  useMethodFromSpec,
  useMethodsFromSpec,
} from './hooks/useMethodFromSpec';
// Re-export from @openpkg-ts/ui
export {
  type CodeTab,
  CodeTabs,
  type CodeTabsProps,
  ImportSection,
  type ImportSectionProps,
} from '@openpkg-ts/ui/docskit';
// Components
export type { APIPageProps } from './components/styled/APIPage';
export { APIPage } from './components/styled/APIPage';
export { APIParameterItem, type APIParameterItemProps } from './components/styled/APIParameterItem';
export { APIReferenceLayout, type APIReferenceLayoutProps } from './components/styled/APIReferenceLayout';
export type { ClassPageProps } from './components/styled/ClassPage';
export { ClassPage } from './components/styled/ClassPage';
export { CodeBlock, type CodeBlockProps } from './components/styled/CodeBlock';
export type { CodeBlockProps as CodePanelProps } from './components/styled/CodeBlock';
export { CollapsiblePanel, type CollapsiblePanelProps } from './components/styled/CollapsiblePanel';
export type { EnumPageProps } from './components/styled/EnumPage';
export { EnumPage } from './components/styled/EnumPage';
export {
  type EnumValue,
  EnumValuesSection,
  type EnumValuesSectionProps,
} from './components/styled/EnumValuesSection';
export { type ExampleChip, ExampleChips, type ExampleChipsProps } from './components/styled/ExampleChips';
export {
  type CodeExample,
  ExampleSection,
  type ExampleSectionProps,
} from './components/styled/ExampleSection';
export { ExpandableParameter, type ExpandableParameterProps } from './components/styled/ExpandableParameter';
export type { ExportCardProps } from './components/styled/ExportCard';
export { ExportCard } from './components/styled/ExportCard';
export type { ExportIndexPageProps } from './components/styled/ExportIndexPage';
export { ExportIndexPage } from './components/styled/ExportIndexPage';
export type { FullAPIReferencePageProps } from './components/styled/FullAPIReferencePage';
export { FullAPIReferencePage } from './components/styled/FullAPIReferencePage';
export type { FunctionPageProps } from './components/styled/FunctionPage';
export { FunctionPage } from './components/styled/FunctionPage';
export type { InterfacePageProps } from './components/styled/InterfacePage';
export { InterfacePage } from './components/styled/InterfacePage';
export { MethodSection, type MethodSectionProps } from './components/styled/MethodSection';
export {
  MethodSectionFromSpec,
  type MethodSectionFromSpecProps,
} from './components/styled/MethodSectionFromSpec';
export {
  NestedParameterContainer,
  type NestedParameterContainerProps,
} from './components/styled/NestedParameterContainer';
export { NestedParameterToggle, type NestedParameterToggleProps } from './components/styled/NestedParameterToggle';
export {
  StripeAPIReferencePage,
  type StripeAPIReferencePageProps,
} from './components/styled/StripeAPIReferencePage';
export {
  type SyncScrollContextValue,
  SyncScrollProvider,
  type SyncScrollProviderProps,
  useSyncScroll,
  useSyncSection,
} from './components/styled/SyncScrollProvider';
export {
  ClassSection,
  type ClassSectionProps,
  EnumSection,
  type EnumSectionProps,
  ExportSection,
  type ExportSectionProps,
  FunctionSection,
  type FunctionSectionProps,
  InterfaceSection,
  type InterfaceSectionProps,
  VariableSection,
  type VariableSectionProps,
} from './components/styled/sections';
export type { VariablePageProps } from './components/styled/VariablePage';
export { VariablePage } from './components/styled/VariablePage';
