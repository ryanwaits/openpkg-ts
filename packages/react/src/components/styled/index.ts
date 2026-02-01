// Styled components - pre-styled with Tailwind v4

// Adapters for converting spec data to component props
export {
  buildImportStatement,
  getLanguagesFromExamples,
  specExamplesToCodeExamples,
  specParamToAPIParam,
  specSchemaToAPISchema,
} from '../../adapters/spec-to-docskit';
export {
  generateDefaultExample,
  specExampleToCodeExample,
} from '../../adapters/spec-to-examples';
export type { NestedParameterData } from '../../adapters/spec-to-params';
export {
  resolveSchemaRef,
  specParamsToNestedParams,
  specParamToNestedParam,
} from '../../adapters/spec-to-params';
// Hooks for spec data
export type { MethodData } from '../../hooks/useMethodFromSpec';
export {
  extractMethodData,
  useMethodFromSpec,
  useMethodsFromSpec,
} from '../../hooks/useMethodFromSpec';
// Re-export from @openpkg-ts/ui
export {
  type CodeTab,
  CodeTabs,
  type CodeTabsProps,
  ImportSection,
  type ImportSectionProps,
} from '@openpkg-ts/ui/docskit';
// Local components (spec-specific)
export type { APIPageProps } from './APIPage';
export { APIPage } from './APIPage';
// Parameter components (Stripe-style)
export { APIParameterItem, type APIParameterItemProps } from './APIParameterItem';
// Layout components (Supabase/Stripe style)
export { APIReferenceLayout, type APIReferenceLayoutProps } from './APIReferenceLayout';
export type { ClassPageProps } from './ClassPage';
export { ClassPage } from './ClassPage';
export { CodeBlock, type CodeBlockProps } from './CodeBlock';
/** @deprecated Use CodeBlock instead */
export { CodeBlock as CodePanel } from './CodeBlock';
export type { CodeBlockProps as CodePanelProps } from './CodeBlock';
export { CollapsiblePanel, type CollapsiblePanelProps } from './CollapsiblePanel';
export type { EnumPageProps } from './EnumPage';
export { EnumPage } from './EnumPage';
export {
  type EnumValue,
  EnumValuesSection,
  type EnumValuesSectionProps,
} from './EnumValuesSection';
// Code example components (right column)
export { type ExampleChip, ExampleChips, type ExampleChipsProps } from './ExampleChips';
export {
  type CodeExample,
  ExampleSection,
  type ExampleSectionProps,
} from './ExampleSection';
export { ExpandableParameter, type ExpandableParameterProps } from './ExpandableParameter';
export type { ExportCardProps } from './ExportCard';
export { ExportCard } from './ExportCard';
export type { ExportIndexPageProps } from './ExportIndexPage';
export { ExportIndexPage } from './ExportIndexPage';
export type { FullAPIReferencePageProps } from './FullAPIReferencePage';
export { FullAPIReferencePage } from './FullAPIReferencePage';
export type { FunctionPageProps } from './FunctionPage';
export { FunctionPage } from './FunctionPage';
export type { InterfacePageProps } from './InterfacePage';
export { InterfacePage } from './InterfacePage';
export { MethodSection, type MethodSectionProps } from './MethodSection';
// Spec-connected components (auto-generate from OpenPkg)
export {
  MethodSectionFromSpec,
  type MethodSectionFromSpecProps,
} from './MethodSectionFromSpec';
export {
  NestedParameterContainer,
  type NestedParameterContainerProps,
} from './NestedParameterContainer';
export { NestedParameterToggle, type NestedParameterToggleProps } from './NestedParameterToggle';
export {
  StripeAPIReferencePage,
  type StripeAPIReferencePageProps,
} from './StripeAPIReferencePage';
export {
  type SyncScrollContextValue,
  SyncScrollProvider,
  type SyncScrollProviderProps,
  useSyncScroll,
  useSyncSection,
} from './SyncScrollProvider';
// Section components (for composing custom layouts)
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
} from './sections';
export type { VariablePageProps } from './VariablePage';
export { VariablePage } from './VariablePage';
