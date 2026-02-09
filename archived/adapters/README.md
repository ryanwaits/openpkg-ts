# @openpkg-ts/adapters

Framework adapters for OpenPkg API documentation.

## Adapter Registry

Self-registering adapter pattern for extensibility.

```typescript
import { registerAdapter, getAdapter, listAdapters } from '@openpkg-ts/adapters';

// List available adapters
const adapters = listAdapters();

// Get adapter by id
const fumadocs = getAdapter('fumadocs');
await fumadocs.generate(spec, './docs/api');
```

### Creating Custom Adapters

```typescript
import { registerAdapter, type DocAdapter } from '@openpkg-ts/adapters';

const myAdapter: DocAdapter = {
  id: 'my-adapter',
  name: 'My Adapter',
  generate: async (spec, outDir) => {
    // Generate docs to outDir
  },
};

registerAdapter(myAdapter);
```

### CLI Integration

```bash
# Use adapter via CLI
openpkg docs openpkg.json --adapter fumadocs -o docs/api/
```

## Fumadocs

```bash
npm install @openpkg-ts/adapters fumadocs-core
```

```ts
import { loader } from 'fumadocs-core/source';
import { openpkgSource, openpkgPlugin } from '@openpkg-ts/adapters/fumadocs';
import spec from './openpkg.json';

export const apiSource = loader({
  baseUrl: '/docs/api',
  source: openpkgSource({ spec }),
  plugins: [openpkgPlugin()],
});
```

Self-registers on import - no manual registration needed.

### CSS

```css
@import '@openpkg-ts/adapters/fumadocs/css';
```

### Components

```ts
import { SidebarKindBadge } from '@openpkg-ts/adapters/fumadocs/components';
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `spec` | `OpenPkg` | required | The OpenPkg spec |
| `baseDir` | `string` | `'api'` | Base directory |
| `mode` | `'pages' \| 'single'` | `'pages'` | Navigation mode |
| `indexPage` | `boolean` | `true` | Generate index page |

## Types

```typescript
import type { DocAdapter } from '@openpkg-ts/adapters';
```

## Future Adapters

- `@openpkg-ts/adapters/docusaurus` (planned)
- `@openpkg-ts/adapters/mintlify` (planned)

## License

MIT
