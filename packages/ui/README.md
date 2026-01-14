# @openpkg-ts/ui

React components for API documentation. Built with Radix UI, Tailwind CSS, and CodeHike.

## Install

```bash
bun add @openpkg-ts/ui
```

Peer deps: `react@^19`, `react-dom@^19`

## Entry Points

### `@openpkg-ts/ui/api`

Components for displaying API exports and parameters.

```tsx
import { ExportCard, ParameterItem, CodeTabs, TypeBadge, ImportSection } from '@openpkg-ts/ui/api';
```

| Component | Description |
|-----------|-------------|
| `ExportCard` | Card displaying function/class/type export with signature |
| `ParameterItem` | Single parameter with name, type, description |
| `CodeTabs` | Tabbed code examples |
| `TypeBadge` | Inline type annotation badge |
| `ImportSection` | Import statement display |

### `@openpkg-ts/ui/badge`

Status and kind indicator badges.

```tsx
import { KindBadge, StatusBadge } from '@openpkg-ts/ui/badge';
```

| Component | Description |
|-----------|-------------|
| `KindBadge` | Export kind (function, class, interface, type, etc.) |
| `StatusBadge` | Status indicator (stable, beta, deprecated, etc.) |

### `@openpkg-ts/ui/docskit`

Stripe-style API reference components and CodeHike integrations.

```tsx
import {
  APIReferencePage,
  APISection,
  ParameterList,
  DocsKitCode,
  Terminal,
  addDocsKit
} from '@openpkg-ts/ui/docskit';
```

**API Reference Components:**
- `APIReferencePage` - Full page layout
- `APISection` - Collapsible section
- `ParameterList` - Parameter table
- `EndpointHeader` - HTTP method + path display
- `ResponseBlock` - Response example

**Code Components:**
- `DocsKitCode` / `SingleCode` - Syntax highlighted code blocks
- `Terminal` - Terminal-style output
- `PackageInstall` - Package manager install commands
- `CodeIcon` - File type icons (seti-icons)

**CodeHike Handlers:**
- `addDocsKit` - Register all handlers
- `mark`, `hover`, `tooltip`, `callout`, `collapse`, `diff`, `lineNumbers`, `wordWrap`, `expandable`, `link`

### `@openpkg-ts/ui/lib/utils`

```tsx
import { cn } from '@openpkg-ts/ui/lib/utils';
```

Tailwind class merge utility (`clsx` + `tailwind-merge`).

## License

MIT
