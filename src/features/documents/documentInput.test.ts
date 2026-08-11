import { describe, expect, it } from 'vitest';

import {
  DocumentInputError,
  createStarterDocument,
  parseDocumentFile,
  parseDocumentJson,
} from '@/features/documents/documentInput';

describe('document input', () => {
  it('creates starter values from schema fields and omits wildcard fields', () => {
    expect(
      createStarterDocument([
        { name: 'title', type: 'string' },
        { name: 'published', type: 'bool' },
        { name: 'rating', type: 'float' },
        { name: 'tags', type: 'string[]' },
        { name: 'location', type: 'geopoint' },
        { name: 'metadata', type: 'object' },
        { name: '.*', type: 'auto' },
      ]),
    ).toEqual({
      title: '',
      published: false,
      rating: 0,
      tags: [],
      location: [0, 0],
      metadata: {},
    });
  });

  it('requires an array of document objects in the editor', () => {
    expect(() => parseDocumentJson('{"id":"one"}')).toThrowError(
      new DocumentInputError('The editor must contain a JSON array of documents.'),
    );
    expect(() => parseDocumentJson('[null]')).toThrow('Document 1 must be a JSON object.');
    expect(() => parseDocumentJson('[]')).toThrow('Add at least one document before importing.');
  });

  it('preserves nested arrays and null values for server-side schema validation', () => {
    expect(parseDocumentJson('[{"id":"one","tags":["a"],"note":null}]')).toEqual([
      { id: 'one', tags: ['a'], note: null },
    ]);
  });

  it('loads JSONL with one document per line', () => {
    expect(parseDocumentFile('{"id":"one"}\n{"id":"two"}')).toEqual([{ id: 'one' }, { id: 'two' }]);
  });

  it('reports a malformed JSONL line', () => {
    expect(() => parseDocumentFile('{"id":"one"}\nnot-json')).toThrow('Invalid JSON on line 2.');
  });
});
