import { describe, expect, it } from 'vitest';

import {
  CollectionSchemaError,
  collectionDraftToSchema,
  fieldDraftToSchema,
  parseCollectionSchemaJson,
} from '@/features/collections/collectionSchema';

describe('collection schema validation', () => {
  it('converts the form draft to a Typesense schema', () => {
    expect(
      collectionDraftToSchema({
        name: 'products',
        fields: [
          { name: 'title', type: 'string', optional: false, facet: false, sort: true },
          { name: 'price', type: 'float', optional: true, facet: true, sort: true },
        ],
        defaultSortingField: 'price',
        enableNestedFields: false,
      }),
    ).toEqual({
      name: 'products',
      fields: [
        {
          name: 'title',
          type: 'string',
          optional: false,
          facet: false,
          sort: true,
          index: true,
        },
        {
          name: 'price',
          type: 'float',
          optional: true,
          facet: true,
          sort: true,
          index: true,
        },
      ],
      default_sorting_field: 'price',
      enable_nested_fields: false,
    });
  });

  it('automatically enables nested fields for object schemas', () => {
    const schema = collectionDraftToSchema({
      name: 'products',
      fields: [{ name: 'details', type: 'object', optional: false, facet: false, sort: false }],
      defaultSortingField: '',
      enableNestedFields: false,
    });

    expect(schema.enable_nested_fields).toBe(true);
  });

  it('rejects duplicate fields and invalid JSON', () => {
    expect(() =>
      collectionDraftToSchema({
        name: 'products',
        fields: [
          { name: 'title', type: 'string', optional: false, facet: false, sort: false },
          { name: 'title', type: 'string', optional: true, facet: false, sort: false },
        ],
        defaultSortingField: '',
        enableNestedFields: false,
      }),
    ).toThrow('Field names must be unique. "title" is repeated.');
    expect(() => parseCollectionSchemaJson('{ invalid')).toThrow(CollectionSchemaError);
  });

  it('accepts a valid JSON schema', () => {
    expect(
      parseCollectionSchemaJson(
        JSON.stringify({
          name: 'events',
          fields: [{ name: 'timestamp', type: 'int64', sort: true }],
          default_sorting_field: 'timestamp',
        }),
      ),
    ).toMatchObject({ name: 'events', default_sorting_field: 'timestamp' });
  });

  it('rejects a field that already exists', () => {
    expect(() =>
      fieldDraftToSchema(
        { name: 'title', type: 'string', optional: false, facet: false, sort: false },
        ['title'],
      ),
    ).toThrow('A field named "title" already exists.');
  });
});
