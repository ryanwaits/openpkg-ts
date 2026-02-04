# RunnableSnippet Component

Interactive code block with run button and output display.

## Installation

```bash
shadcn add @openpkg-ts/runnable-snippet
```

## Usage

### Basic Example

```tsx
import { RunnableSnippet } from '@openpkg-ts/ui/docskit';

<RunnableSnippet
  code="console.log('Hello, world!');"
  language="javascript"
/>
```

### With Mock States (Phase 1)

```tsx
<RunnableSnippet
  code={exampleCode}
  language="typescript"
  title="fetchUser.ts"
  mockState="idle"
  mockOutput='{"id":"usr_123","name":"Alice"}'
/>
```

### From Spec Examples

```tsx
import { RunnableSnippet } from '@openpkg-ts/ui/docskit';
import spec from './spec.json';

const fetchUserExport = spec.exports.find(e => e.name === 'fetchUser');
const example = fetchUserExport.examples?.[0];

<RunnableSnippet
  code={typeof example === 'string' ? example : example.code}
  language={example.language || 'typescript'}
  title="fetchUser Example"
  mockState="idle"
/>
```

## Props

```typescript
interface RunnableSnippetProps {
  /** Code to display */
  code: string;
  /** Language for syntax highlighting */
  language?: string;
  /** Optional title */
  title?: string;
  /** For demo: mock execution state */
  mockState?: 'idle' | 'running' | 'success' | 'error';
  /** For demo: mock output data */
  mockOutput?: string;
  /** Custom className */
  className?: string;
}
```

## Features

- **Code Display**: Uses `ClientDocsKitCode` for consistent syntax highlighting
- **Run Button**: Floating button (appears on hover) positioned like CopyButton
- **Output Panel**: `CollapsiblePanel` showing execution results
- **Loading State**: Spinning loader icon during execution
- **Success/Error States**: Visual indicators with execution duration

## Visual States

### Idle
Code block with floating run button (visible on hover)

### Running
Code block with disabled spinning button

### Success
Code block + expanded output panel with ✓ and timing

### Error
Code block + expanded output panel with ✕ and error message

## Phase 2: Real Execution (Future)

Replace `mockState` with real `onRun` handler:

```tsx
<RunnableSnippet
  code="const x = 1 + 1;\nconsole.log(x);"
  onRun={sandboxExecute}  // Real sandbox execution
/>
```

Will require:
- iframe sandbox infrastructure
- postMessage protocol
- TypeScript transpilation
- Console capture
- Timeout handling
