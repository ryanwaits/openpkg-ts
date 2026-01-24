// Styled components - pre-styled with Tailwind v4

// Re-export from @openpkg-ts/ui
export {
  type CodeTab,
  CodeTabs,
  type CodeTabsProps,
  ImportSection,
  type ImportSectionProps,
} from '@openpkg-ts/ui/api';

// Layout components (Supabase/Stripe style)
export { APIReferenceLayout, type APIReferenceLayoutProps } from './APIReferenceLayout';
export {
  SyncScrollProvider,
  type SyncScrollProviderProps,
  type SyncScrollContextValue,
  useSyncScroll,
  useSyncSection,
} from './SyncScrollProvider';
export { MethodSection, type MethodSectionProps } from './MethodSection';

// Parameter components (Stripe-style)
export { APIParameterItem, type APIParameterItemProps } from './APIParameterItem';
export { NestedParameterToggle, type NestedParameterToggleProps } from './NestedParameterToggle';
export {
  NestedParameterContainer,
  type NestedParameterContainerProps,
} from './NestedParameterContainer';
export { ExpandableParameter, type ExpandableParameterProps } from './ExpandableParameter';
export {
  EnumValuesSection,
  type EnumValuesSectionProps,
  type EnumValue,
} from './EnumValuesSection';

// Code example components (right column)
export { ExampleChips, type ExampleChipsProps, type ExampleChip } from './ExampleChips';
export { CodePanel, type CodePanelProps } from './CodePanel';
export { CollapsiblePanel, type CollapsiblePanelProps } from './CollapsiblePanel';
export {
  ExampleSection,
  type ExampleSectionProps,
  type CodeExample,
} from './ExampleSection';

// Spec-connected components (auto-generate from OpenPkg)
export {
  MethodSectionFromSpec,
  type MethodSectionFromSpecProps,
} from './MethodSectionFromSpec';
export {
  StripeAPIReferencePage,
  type StripeAPIReferencePageProps,
} from './StripeAPIReferencePage';

// Hooks
export {
  useMethodFromSpec,
  useMethodsFromSpec,
  extractMethodData,
  type MethodData,
} from '../../hooks/useMethodFromSpec';

// Adapters
export {
  specParamToNestedParam,
  specParamsToNestedParams,
  resolveSchemaRef,
  type NestedParameterData,
} from '../../adapters/spec-to-params';
export {
  specExampleToCodeExample,
  specExamplesToCodeExamples,
  generateDefaultExample,
  getLanguagesFromExamples,
} from '../../adapters/spec-to-examples';

// Local components (spec-specific)
export type { APIPageProps } from './APIPage';
export { APIPage } from './APIPage';
export type { ClassPageProps } from './ClassPage';
export { ClassPage } from './ClassPage';
export type { EnumPageProps } from './EnumPage';
export { EnumPage } from './EnumPage';
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
export type { NestedPropertyItemProps, ParameterItemProps } from './ParameterItem';
/** @deprecated Use APIParameterItem from @openpkg-ts/ui with specParamToAPIParam adapter */
export { ParameterItem } from './ParameterItem';
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
