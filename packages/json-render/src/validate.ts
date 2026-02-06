import { z } from 'zod';
import {
  APIReferencePageSchema,
  APISectionSchema,
  APISectionSingleSchema,
  ExportIndexPageSchema,
  ExportSectionSchema,
  ParameterListSchema,
  ResponseBlockSchema,
} from './catalog/components';

const propSchemas: Record<string, z.ZodType> = {
  APIReferencePage: APIReferencePageSchema,
  APISection: APISectionSchema,
  APISectionSingle: APISectionSingleSchema,
  ExportSection: ExportSectionSchema,
  ExportIndexPage: ExportIndexPageSchema,
  ParameterList: ParameterListSchema,
  ResponseBlock: ResponseBlockSchema,
};

const ElementSchema = z.object({
  key: z.string(),
  type: z.string(),
  props: z.record(z.unknown()),
  children: z.array(z.string()),
  parentKey: z.string(),
});

const SpecSchema = z.object({
  root: z.string(),
  elements: z.record(ElementSchema),
});

export interface ValidationResult {
  valid: boolean;
  data: z.infer<typeof SpecSchema> | null;
  errors: string[];
}

/** Validate an LLM-generated spec against catalog schemas (no React dependency) */
export function validateSpec(raw: unknown): ValidationResult {
  const errors: string[] = [];

  const parsed = SpecSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      data: null,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }

  const spec = parsed.data;

  // Check root element exists
  if (!spec.elements[spec.root]) {
    errors.push(`Root element "${spec.root}" not found in elements`);
  }

  // Validate each element's props against its component schema
  for (const [key, element] of Object.entries(spec.elements)) {
    const schema = propSchemas[element.type];
    if (!schema) {
      errors.push(`Unknown component type "${element.type}" in element "${key}"`);
      continue;
    }
    const propResult = schema.safeParse(element.props);
    if (!propResult.success) {
      for (const issue of propResult.error.issues) {
        errors.push(`${key}.props.${issue.path.join('.')}: ${issue.message}`);
      }
    }

    // Verify children references exist
    for (const childKey of element.children) {
      if (!spec.elements[childKey]) {
        errors.push(`Element "${key}" references missing child "${childKey}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    data: spec,
    errors,
  };
}
