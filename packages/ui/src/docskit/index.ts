// Stripe-style API reference components
export {
  APICodePanel,
  type APICodePanelProps,
  APIParameterItem,
  type APIParameterItemProps,
  type APIParameterSchema,
  APIReferenceLayout,
  type APIReferenceLayoutProps,
  APIReferencePage,
  type APIReferencePageProps,
  APISection,
  type APISectionProps,
  CodeBlock,
  type CodeBlockProps,
  type CodeExample,
  CollapsiblePanel,
  type CollapsiblePanelProps,
  EndpointBadge,
  type EndpointBadgeProps,
  EndpointHeader,
  type EndpointHeaderProps,
  endpointBadgeVariants,
  EnumValuesSection,
  type EnumValue,
  type EnumValuesSectionProps,
  ExampleChips,
  type ExampleChip,
  type ExampleChipsProps,
  ExampleSection,
  type ExampleSectionProps,
  type ExampleSectionCodeExample,
  ExpandableParameter,
  type ExpandableParameterProps,
  type HttpMethod,
  type Language,
  LanguageSelector,
  type LanguageSelectorProps,
  MethodSection,
  type MethodSectionProps,
  NestedParameterContainer,
  type NestedParameterContainerProps,
  NestedParameterToggle,
  type NestedParameterToggleProps,
  ParameterList,
  type ParameterListProps,
  ResponseBlock,
  type ResponseBlockProps,
} from './api';
export {
  SyncScrollProvider,
  type SyncScrollProviderProps,
  type SyncScrollContextValue,
  useSyncScroll,
  useSyncSection,
} from './hooks/use-sync-scroll';

export { callout } from './callout';
export { DocsKitCode, SingleCode, toCodeGroup } from './code';
export { MultiCode } from './code.client';
export {
  ClientCode,
  ClientDocsKitCode,
  ClientInlineCode,
  ClientTerminal,
} from './code.client-highlight';
export type { CodeInfo } from './code.config';
export { flagsToOptions, theme } from './code.config';
export { CopyButton } from './code.copy';
export { ClientDiffCode, type ClientDiffCodeProps, type DiffStats } from './code.diff';
export { CodeIcon } from './code.icon';
export { DocsKitInlineCode } from './code.inline';
export { PackageInstall } from './code.package-install';
export {
  CodeBlockSkeleton,
  CodeTabsSkeleton,
  InlineCodeSkeleton,
  TerminalSkeleton,
} from './code.skeleton';
export { Code, CodeGroup } from './code.tabs';
export { Terminal } from './code.terminal';
export { collapse } from './collapse';
export { diff } from './diff';
export { addDocsKit } from './docskit';
export { expandable } from './expandable';
export { HoverLink, hover, WithHover } from './hover';
export { lineNumbers } from './line-numbers';
export { link } from './link';
export { mark } from './mark';
export { WithNotes } from './notes';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { TooltipLink, tooltip } from './tooltip';
export { wordWrap } from './word-wrap';
export { ImportSection, type ImportSectionProps } from './import-section';
export {
  TypeBadge,
  type TypeBadgeProps,
  type TypeColor,
  typeBadgeVariants,
} from './type-badge';
