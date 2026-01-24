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

// Original styled components
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

// Supabase/Stripe style layout components
export type {
  APIReferenceLayoutProps,
  SyncScrollProviderProps,
  SyncScrollContextValue,
  MethodSectionProps,
} from './components/styled';
export {
  APIReferenceLayout,
  SyncScrollProvider,
  useSyncScroll,
  useSyncSection,
  MethodSection,
} from './components/styled';

// Stripe-style parameter components
export type {
  APIParameterItemProps,
  NestedParameterToggleProps,
  NestedParameterContainerProps,
  ExpandableParameterProps,
  EnumValuesSectionProps,
  EnumValue,
} from './components/styled';
export {
  APIParameterItem,
  NestedParameterToggle,
  NestedParameterContainer,
  ExpandableParameter,
  EnumValuesSection,
} from './components/styled';

// Code example components (right column)
export type {
  ExampleChipsProps,
  ExampleChip,
  CodePanelProps,
  CollapsiblePanelProps,
  ExampleSectionProps,
  CodeExample,
} from './components/styled';
export {
  ExampleChips,
  CodePanel,
  CollapsiblePanel,
  ExampleSection,
} from './components/styled';

// Spec-connected components
export type {
  MethodSectionFromSpecProps,
  StripeAPIReferencePageProps,
} from './components/styled';
export {
  MethodSectionFromSpec,
  StripeAPIReferencePage,
} from './components/styled';

// Hooks for spec data
export type { MethodData } from './hooks/useMethodFromSpec';
export {
  useMethodFromSpec,
  useMethodsFromSpec,
  extractMethodData,
} from './hooks/useMethodFromSpec';

// Adapters for spec conversion
export type { NestedParameterData } from './adapters/spec-to-params';
export {
  specParamToNestedParam,
  specParamsToNestedParams,
  resolveSchemaRef,
} from './adapters/spec-to-params';
export {
  specExampleToCodeExample,
  generateDefaultExample,
} from './adapters/spec-to-examples';
