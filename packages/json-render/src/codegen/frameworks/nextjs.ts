import type { GeneratedFile } from '@json-render/codegen';

export function nextjsFiles(
  componentCode: string,
  dataFileCode: string | null,
  hasExportIndexPage: boolean,
  exportIndexCode: string | null,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Main page component
  files.push({
    path: 'app/api-reference/page.tsx',
    content: componentCode,
  });

  // Data file
  if (dataFileCode) {
    files.push({
      path: 'app/api-reference/data.ts',
      content: dataFileCode,
    });
  }

  // Export index page (client component)
  if (hasExportIndexPage && exportIndexCode) {
    files.push({
      path: 'app/api-reference/ExportIndexPage.tsx',
      content: exportIndexCode,
    });
  }

  // Layout
  files.push({
    path: 'app/api-reference/layout.tsx',
    content: `import "@openpkg-ts/registry/styles/docskit.css";

export default function APIReferenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
`,
  });

  // Root layout
  files.push({
    path: 'app/layout.tsx',
    content: `import "./globals.css";

export const metadata = {
  title: "API Reference",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  });

  // Global CSS
  files.push({
    path: 'app/globals.css',
    content: `@import "tailwindcss";
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
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^15',
          react: '^19',
          'react-dom': '^19',
          '@openpkg-ts/registry': 'latest',
        },
        devDependencies: {
          typescript: '^5',
          '@types/react': '^19',
          '@types/react-dom': '^19',
          tailwindcss: '^4',
          '@tailwindcss/postcss': '^4',
          postcss: '^8',
        },
      },
      null,
      2,
    ) + '\n',
  });

  // Tailwind config
  files.push({
    path: 'postcss.config.mjs',
    content: `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`,
  });

  // tsconfig
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2,
    ) + '\n',
  });

  // next.config
  files.push({
    path: 'next.config.ts',
    content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
  });

  return files;
}
