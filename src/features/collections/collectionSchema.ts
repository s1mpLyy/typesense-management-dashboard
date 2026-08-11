import { z } from 'zod';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const FIELD_TYPES = [
  'string',
  'string[]',
  'int32',
  'int32[]',
  'int64',
  'int64[]',
  'float',
  'float[]',
  'bool',
  'bool[]',
  'geopoint',
  'geopoint[]',
  'geopolygon',
  'object',
  'object[]',
  'auto',
] as const;

export interface CollectionFieldDraft {
  name: string;
  type: (typeof FIELD_TYPES)[number];
  optional: boolean;
  facet: boolean;
  sort: boolean;
}

export interface CollectionDraft {
  name: string;
  fields: CollectionFieldDraft[];
  defaultSortingField: string;
  enableNestedFields: boolean;
}

export type CollectionFieldUpdateDraft = CollectionFieldDraft;

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a collection name.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, underscores, or hyphens.');

const fieldSchema = z.object({
  name: z.string().trim().min(1, 'Every field needs a name.'),
  type: z.enum(FIELD_TYPES),
  optional: z.boolean().default(false),
  facet: z.boolean().default(false),
  sort: z.boolean().default(false),
});

const draftSchema = z
  .object({
    name: nameSchema,
    fields: z.array(fieldSchema).min(1, 'Add at least one field.'),
    defaultSortingField: z.string().trim(),
    enableNestedFields: z.boolean(),
  })
  .superRefine((draft, context) => {
    const names = new Set<string>();
    for (const [index, field] of draft.fields.entries()) {
      if (names.has(field.name)) {
        context.addIssue({
          code: 'custom',
          message: `Field names must be unique. "${field.name}" is repeated.`,
          path: ['fields', index, 'name'],
        });
      }
      names.add(field.name);
    }

    if (draft.defaultSortingField && !names.has(draft.defaultSortingField)) {
      context.addIssue({
        code: 'custom',
        message: 'The default sorting field must exist in the schema.',
        path: ['defaultSortingField'],
      });
    }
  });

const collectionJsonSchema = z
  .object({
    name: nameSchema,
    fields: z.array(fieldSchema.passthrough()).min(1, 'Add at least one field.'),
    default_sorting_field: z.string().trim().optional(),
    enable_nested_fields: z.boolean().optional(),
    token_separators: z.array(z.string()).optional(),
    symbols_to_index: z.array(z.string()).optional(),
  })
  .passthrough();

export class CollectionSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionSchemaError';
  }
}

function schemaError(error: z.ZodError): CollectionSchemaError {
  return new CollectionSchemaError(error.issues[0]?.message ?? 'Check the collection schema.');
}

export function emptyCollectionField(): CollectionFieldDraft {
  return { name: '', type: 'string', optional: false, facet: false, sort: false };
}

export function fieldDraftToSchema(
  draft: CollectionFieldUpdateDraft,
  existingNames: string[],
): CollectionFieldSchema {
  const parsed = fieldSchema.safeParse(draft);
  if (!parsed.success) throw schemaError(parsed.error);
  if (existingNames.includes(parsed.data.name)) {
    throw new CollectionSchemaError(`A field named "${parsed.data.name}" already exists.`);
  }

  return {
    name: parsed.data.name,
    type: parsed.data.type,
    optional: parsed.data.optional,
    facet: parsed.data.facet,
    sort: parsed.data.sort,
    index: true,
  };
}

export function collectionDraftToSchema(draft: CollectionDraft): CollectionCreateSchema {
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) throw schemaError(parsed.error);

  const fields: CollectionFieldSchema[] = parsed.data.fields.map((field) => ({
    name: field.name,
    type: field.type,
    optional: field.optional,
    facet: field.facet,
    sort: field.sort,
    index: true,
  }));
  const nestedByField = fields.some(
    (field) => field.type === 'object' || field.type === 'object[]',
  );

  return {
    name: parsed.data.name,
    fields,
    ...(parsed.data.defaultSortingField
      ? { default_sorting_field: parsed.data.defaultSortingField }
      : {}),
    enable_nested_fields: parsed.data.enableNestedFields || nestedByField,
  };
}

export function parseCollectionSchemaJson(json: string): CollectionCreateSchema {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new CollectionSchemaError(
      error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.',
    );
  }

  const parsed = collectionJsonSchema.safeParse(value);
  if (!parsed.success) throw schemaError(parsed.error);

  const fieldNames = parsed.data.fields.map((field) => field.name);
  if (new Set(fieldNames).size !== fieldNames.length) {
    throw new CollectionSchemaError('Field names must be unique.');
  }
  if (
    parsed.data.default_sorting_field &&
    !fieldNames.includes(parsed.data.default_sorting_field)
  ) {
    throw new CollectionSchemaError('The default sorting field must exist in the schema.');
  }

  return parsed.data;
}
