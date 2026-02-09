import { z } from 'zod';

export const APIReferencePageSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  theme: z.enum(['default', 'single']).nullable().optional(),
});

export const APISectionSchema = z.object({
  exportId: z.string(),
  codePanelTitle: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  codeLang: z.string().nullable().optional(),
});

export const APISectionSingleSchema = z.object({
  exportId: z.string(),
  codePanelTitle: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  codeLang: z.string().nullable().optional(),
});

export const ExportSectionSchema = z.object({
  exportId: z.string(),
});

export const ExportIndexPageSchema = z.object({
  baseHref: z.string().nullable().optional(),
  showSearch: z.boolean().nullable().optional(),
  showFilters: z.boolean().nullable().optional(),
});

export const ParameterListSchema = z.object({
  title: z.string().nullable().optional(),
  exportId: z.string(),
  collapseAfter: z.number().nullable().optional(),
});

export const ResponseBlockSchema = z.object({
  exportId: z.string(),
});

export const SectionSchema = z.object({
  exportId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  withHover: z.boolean().nullable().optional(),
});

export const InstallBlockSchema = z.object({
  managers: z.array(z.string()).nullable().optional(),
});

export const CodeBlockSchema = z.object({
  exportId: z.string(),
  code: z.string().nullable().optional(),
  lang: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  flags: z.string().nullable().optional(),
});
