import type { GeneratedFile } from '@json-render/codegen';

export function viteFiles(
  componentCode: string,
  dataFileCode: string | null,
  hasExportIndexPage: boolean,
  exportIndexCode: string | null,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Main component
  files.push({
    path: 'src/APIReference.tsx',
    content: componentCode,
  });

  // Data file
  if (dataFileCode) {
    files.push({ path: 'src/data.ts', content: dataFileCode });
  }

  // Export index page
  if (hasExportIndexPage && exportIndexCode) {
    files.push({ path: 'src/ExportIndexPage.tsx', content: exportIndexCode });
  }

  // App entry
  files.push({
    path: 'src/App.tsx',
    content: `import "@openpkg-ts/registry/styles/docskit.css";
import APIReference from "./APIReference";

export default function App() {
  return <APIReference />;
}
`,
  });

  // Main entry
  files.push({
    path: 'src/main.tsx',
    content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  });

  // CSS
  files.push({
    path: 'src/index.css',
    content: `@import "tailwindcss";
`,
  });

  // HTML
  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API Reference</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  });

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'openpkg-api-reference',
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^19',
          'react-dom': '^19',
          '@openpkg-ts/registry': 'latest',
        },
        devDependencies: {
          typescript: '^5',
          '@types/react': '^19',
          '@types/react-dom': '^19',
          '@vitejs/plugin-react': '^4',
          vite: '^6',
          tailwindcss: '^4',
          '@tailwindcss/vite': '^4',
        },
      },
      null,
      2,
    ) + '\n',
  });

  // Vite config
  files.push({
    path: 'vite.config.ts',
    content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
  });

  // tsconfig
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2,
    ) + '\n',
  });

  return files;
}
