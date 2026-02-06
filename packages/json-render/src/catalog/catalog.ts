import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import {
  APIReferencePageSchema,
  APISectionSchema,
  APISectionSingleSchema,
  CodeBlockSchema,
  ExportIndexPageSchema,
  ExportSectionSchema,
  InstallBlockSchema,
  ParameterListSchema,
  ResponseBlockSchema,
  SectionSchema,
} from './components';

export function createOpenpkgCatalog() {
  return defineCatalog(schema, {
    components: {
      APIReferencePage: {
        props: APIReferencePageSchema,
        slots: ['default'],
        description:
          'Top-level page wrapper. Sets page title, description, and theme (default=two-column, single=single-column). All API sections go inside as children.',
      },
      APISection: {
        props: APISectionSchema,
        slots: ['default'],
        description:
          'Two-column API section for a single export. Left side shows parameters and description, right side shows code examples. Use for Stripe-style docs. Requires exportId.',
      },
      APISectionSingle: {
        props: APISectionSingleSchema,
        description:
          'Single-column API section for a single export. Shows parameters, examples, and return type inline. Use when theme is "single". Requires exportId.',
      },
      ExportSection: {
        props: ExportSectionSchema,
        description:
          'Auto-routing section that renders the appropriate layout based on export kind (function, class, interface, enum, variable). Prefer this over manually choosing section types. Requires exportId.',
      },
      ExportIndexPage: {
        props: ExportIndexPageSchema,
        slots: ['default'],
        description:
          'Overview page showing a searchable grid of all exports. Use as a landing/index page before individual export sections.',
      },
      ParameterList: {
        props: ParameterListSchema,
        slots: ['default'],
        description:
          'Displays the parameter list for an export. Use inside an APISection or standalone. collapseAfter controls how many items show before "Show more".',
      },
      ResponseBlock: {
        props: ResponseBlockSchema,
        description:
          'Displays the return type and description for an export. Shows formatted type info with optional description.',
      },
      Section: {
        props: SectionSchema,
        slots: ['default'],
        description:
          'Flexible section container. Reads title/description from export data, overridable via props. withHover=true enables hover interactions between prose and code (wraps children in WithHover provider). Use with CodeBlock/ParameterList/ResponseBlock children in any order.',
      },
      InstallBlock: {
        props: InstallBlockSchema,
        description:
          'Package install widget with npm/bun/pnpm/yarn tabs. Uses package name from spec data. managers array filters which tabs to show.',
      },
      CodeBlock: {
        props: CodeBlockSchema,
        description:
          'Code example block. Reads code from export examples. title: displayed as filename in code header. flags: c=copy button, n=line numbers, w=word wrap (e.g. flags="cn" for copy+line numbers).',
      },
    },
    actions: {},
  });
}

export type OpenpkgCatalog = ReturnType<typeof createOpenpkgCatalog>;
