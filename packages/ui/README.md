# @openpkg-ts/ui

Low-level UI primitives for API documentation. Built with Radix UI, Tailwind CSS, and CodeHike.

Use `@openpkg-ts/react` for higher-level page components.

## Install

```bash
bun add @openpkg-ts/ui
```

Peer deps: `react@^18 || ^19`, `react-dom@^18 || ^19`

## Entry Points

### `@openpkg-ts/ui/api`

Components for displaying API exports and parameters.

```tsx
import { ExportCard, ParameterItem, CodeTabs, TypeBadge, ImportSection } from '@openpkg-ts/ui/api';
```

### `@openpkg-ts/ui/badge`

Status and kind indicator badges.

```tsx
import { KindBadge, StatusBadge } from '@openpkg-ts/ui/badge';
```

### `@openpkg-ts/ui/docskit`

Stripe-style API reference components and CodeHike integrations.

```tsx
import {
  // Page layout
  APIReferencePage,
  APISection,
  ParameterList,
  EndpointHeader,
  ResponseBlock,

  // Code blocks
  DocsKitCode,
  SingleCode,
  Terminal,
  PackageInstall,
  CodeIcon,

  // CodeHike handlers
  addDocsKit,
} from '@openpkg-ts/ui/docskit';
```

### `@openpkg-ts/ui/lib/utils`

```tsx
import { cn } from '@openpkg-ts/ui/lib/utils';
```

## License

MIT
