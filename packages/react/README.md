# @openpkg-ts/react

React components for rendering OpenPkg API documentation. Built on `@openpkg-ts/ui`.

## Install

```bash
npm install @openpkg-ts/react
```

Peer deps: `react@^18 || ^19`, `tailwindcss@^4` (optional, for styled)

## Entry Points

### Headless Components

Unstyled, logic-only components for custom styling.

```tsx
import {
  CollapsibleMethod,
  ExampleBlock,
  ExpandableProperty,
  MembersTable,
  MemberRow,
  NestedProperty,
  ParamTable,
  ParamRow,
  Signature,
  TypeTable,
  // Section components
  FunctionSection,
  ClassSection,
  InterfaceSection,
  EnumSection,
  VariableSection,
  ExportCard,
  ExportIndexPage,
} from '@openpkg-ts/react';
```

| Component | Description |
|-----------|-------------|
| `CollapsibleMethod` | Expandable method with signature |
| `ExampleBlock` | Code example display |
| `ExpandableProperty` | Property with nested children |
| `MembersTable` | Class/interface members table |
| `MemberRow` | Single member row |
| `NestedProperty` | Nested property display |
| `ParamTable` | Function parameters table |
| `ParamRow` | Single parameter row |
| `Signature` | Type signature renderer |
| `TypeTable` | Type properties table |
| `FunctionSection` | Function export section |
| `ClassSection` | Class export section |
| `InterfaceSection` | Interface export section |
| `EnumSection` | Enum export section |
| `VariableSection` | Variable/constant section |
| `ExportCard` | Single export card |
| `ExportIndexPage` | Index page for all exports |

### Styled Components

Pre-styled with Tailwind v4.

```tsx
import {
  // Stripe/Supabase-style layout (NEW)
  StripeAPIReferencePage,
  APIReferenceLayout,
  SyncScrollProvider,
  MethodSection,
  MethodSectionFromSpec,

  // Parameter components (Stripe-style)
  APIParameterItem,
  NestedParameterToggle,
  NestedParameterContainer,
  ExpandableParameter,
  EnumValuesSection,

  // Code example components
  ExampleChips,
  CodePanel,
  CollapsiblePanel,
  ExampleSection,

  // Full pages (original)
  APIPage,
  FunctionPage,
  ClassPage,
  InterfacePage,
  EnumPage,
  VariablePage,
  ExportIndexPage,
  FullAPIReferencePage,

  // Sections (for composition)
  FunctionSection,
  ClassSection,
  InterfaceSection,
  EnumSection,
  VariableSection,
  ExportSection,

  // Utilities
  ExportCard,
  ParameterItem,
  CodeTabs,
  ImportSection,
} from '@openpkg-ts/react/styled';
```

## Usage

### Stripe/Supabase-Style API Reference (NEW)

Two-column layout with synchronized scrolling:

```tsx
import { StripeAPIReferencePage } from '@openpkg-ts/react/styled';
import spec from './openpkg.json';

export default function APIReference() {
  return <StripeAPIReferencePage spec={spec} />;
}
```

Features:
- Two-column layout (docs left, code examples right)
- Sticky right panel with synchronized scrolling
- Stripe-style nested parameters with expandable containers
- Rose Pine syntax highlighting
- Collapsible accordion panels

### Custom Stripe-Style Layout

```tsx
import {
  APIReferenceLayout,
  SyncScrollProvider,
  MethodSectionFromSpec,
  ExampleSection,
} from '@openpkg-ts/react/styled';

export default function CustomAPIPage({ spec }) {
  return (
    <SyncScrollProvider>
      <APIReferenceLayout
        examples={<ExamplesColumn spec={spec} />}
        leftWidth="55%"
        rightWidth="45%"
      >
        {spec.exports.map(exp => (
          <MethodSectionFromSpec key={exp.name} spec={spec} export={exp} />
        ))}
      </APIReferenceLayout>
    </SyncScrollProvider>
  );
}
```

### Full API Page (Original)

```tsx
import { FullAPIReferencePage } from '@openpkg-ts/react/styled';
import spec from './openpkg.json';

export default function APIReference() {
  return <FullAPIReferencePage spec={spec} />;
}
```

### Single Export Page

```tsx
import { FunctionPage } from '@openpkg-ts/react/styled';

export default function CreateClientPage() {
  const fn = spec.exports.find(e => e.name === 'createClient');
  return <FunctionPage export={fn} packageName={spec.meta.name} />;
}
```

### Custom Composition

```tsx
import { ExportCard, ParameterItem } from '@openpkg-ts/react/styled';
import { buildSignatureString } from '@openpkg-ts/sdk';

export default function CustomExport({ exp }) {
  return (
    <ExportCard
      name={exp.name}
      kind={exp.kind}
      signature={buildSignatureString(exp)}
      description={exp.description}
    >
      {exp.signatures?.[0]?.parameters?.map(param => (
        <ParameterItem key={param.name} {...param} />
      ))}
    </ExportCard>
  );
}
```

## Adapters

Convert spec data to component props:

```tsx
import {
  // Original adapters
  specParamToAPIParam,
  specSchemaToAPISchema,
  specExamplesToCodeExamples,
  buildImportStatement,
  getLanguagesFromExamples,

  // New Stripe-style adapters
  specParamToNestedParam,
  specParamsToNestedParams,
  resolveSchemaRef,
  specExampleToCodeExample,
  generateDefaultExample,
} from '@openpkg-ts/react/styled';
```

## Hooks

Extract method data from spec:

```tsx
import {
  useMethodFromSpec,
  useMethodsFromSpec,
  extractMethodData,
} from '@openpkg-ts/react/styled';

// In component
const method = useMethodFromSpec(spec, 'createClient');
// Returns: { title, signature, description, parameters, examples, returnType, isAsync }
```

## Headless Utilities

```tsx
import {
  cleanCode,
  getExampleCode,
  getExampleLanguage,
  getExampleTitle,
  groupMembersByKind,
} from '@openpkg-ts/react';
```

## Component Registry

Install components via CLI (shadcn-compatible):

```bash
# List available components
openpkg docs list

# Add Stripe-style components
openpkg docs add stripe-api-reference-page
openpkg docs add method-section-from-spec
openpkg docs add api-reference-layout sync-scroll-provider
openpkg docs add api-parameter-item expandable-property
openpkg docs add example-chips code-panel collapsible-panel

# Add original section components
openpkg docs add function-section class-section interface-section
```

29 components available:
- **Stripe-style Layouts**: `api-reference-layout`, `sync-scroll-provider`, `method-section`, `stripe-api-reference-page`, `method-section-from-spec`
- **Parameter Components**: `api-parameter-item`, `nested-parameter-toggle`, `nested-parameter-container`, `expandable-property`, `enum-values-section`
- **Code Examples**: `example-chips`, `code-panel`, `collapsible-panel`, `example-section`
- **Original Sections**: `function-section`, `class-section`, `interface-section`, `enum-section`, `variable-section`
- **Primitives**: `export-card`, `param-table`, `signature`, `members-table`, `type-table`

## React Layout Generation

Generate a single layout file that uses registry components:

```bash
openpkg docs generate spec.json -f react -o ./app/api
```

Creates:
- `layout.tsx` - Main layout with navigation
- `spec.json` - Bundled spec data

Then add components:

```bash
openpkg docs add function-section class-section
```

## License

MIT
