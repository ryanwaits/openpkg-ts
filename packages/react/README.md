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

### Styled Components

Pre-styled with Tailwind v4.

```tsx
import {
  // Full pages
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

### Full API Page

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
  specParamToAPIParam,
  specSchemaToAPISchema,
  specExamplesToCodeExamples,
  buildImportStatement,
  getLanguagesFromExamples,
} from '@openpkg-ts/react/styled';
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

## License

MIT
