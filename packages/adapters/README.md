# @openpkg-ts/adapters

Framework adapters for OpenPkg API documentation.

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

## Future Adapters

- `@openpkg-ts/adapters/docusaurus` (planned)
- `@openpkg-ts/adapters/mintlify` (planned)

## License

MIT
