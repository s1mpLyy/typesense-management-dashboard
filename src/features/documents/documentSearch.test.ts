import { describe, expect, it } from 'vitest';

import {
  DocumentSearchError,
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  buildFilterBy,
  collectHighlightSnippets,
  facetFields,
  parseRawSearchParameters,
  parseSearchHistory,
  parseHighlightSegments,
  prependSearchHistory,
  searchableFieldNames,
  sortOptions,
} from '@/features/documents/documentSearch';
import type { SearchField, SearchHistoryEntry } from '@/features/documents/documentSearch';

const fields: SearchField[] = [
  { name: 'title', type: 'string', index: true, facet: false, sort: false },
  { name: 'category', type: 'string', index: true, facet: true, sort: false },
  { name: 'published', type: 'bool', index: true, facet: true, sort: false },
  { name: 'rating', type: 'float', index: true, facet: true, sort: true },
  { name: '.*', type: 'auto', index: true, facet: true, sort: true },
];

describe('document search helpers', () => {
  it('derives searchable, faceted, and sortable fields from the schema', () => {
    expect(searchableFieldNames(fields)).toEqual(['title', 'category']);
    expect(facetFields(fields, ['string', 'string[]']).map((field) => field.name)).toEqual([
      'category',
    ]);
    expect(facetFields(fields, ['bool', 'bool[]']).map((field) => field.name)).toEqual([
      'published',
    ]);
    expect(sortOptions(fields)).toEqual([
      { label: 'Relevance', value: '' },
      { label: 'rating ascending', value: 'rating:asc' },
      { label: 'rating descending', value: 'rating:desc' },
    ]);
  });

  it('builds combined exact facets and numeric ranges', () => {
    expect(
      buildFilterBy(
        { category: 'Science Fiction', published: 'true' },
        { rating: { min: 3.5, max: 5 } },
        ['published'],
      ),
    ).toBe('category:=`Science Fiction` && published:=true && rating:[3.5..5]');
    expect(buildFilterBy({}, { rating: { min: 4, max: null } })).toBe('rating:>=4');
    expect(buildFilterBy({}, { rating: { min: null, max: 2 } })).toBe('rating:<=2');
  });

  it('rejects an inverted numeric range', () => {
    expect(() => buildFilterBy({}, { rating: { min: 5, max: 2 } })).toThrowError(
      new DocumentSearchError('rating minimum cannot exceed its maximum.'),
    );
  });

  it('validates raw search request JSON', () => {
    expect(parseRawSearchParameters('{"q":"dune","query_by":"title"}')).toEqual({
      q: 'dune',
      query_by: 'title',
    });
    expect(() => parseRawSearchParameters('[]')).toThrowError(
      new DocumentSearchError('The raw search request must be a JSON object.'),
    );
    expect(() => parseRawSearchParameters('{"query_by":"title"}')).toThrowError(
      new DocumentSearchError('The raw search request requires a non-empty string q value.'),
    );
    expect(() => parseRawSearchParameters('{')).toThrowError(
      new DocumentSearchError('Enter a valid JSON search request.'),
    );
  });

  it('loads valid history entries and prepends unique requests', () => {
    const previous: SearchHistoryEntry = {
      id: 'previous',
      mode: 'builder',
      createdAt: '2026-08-11T10:00:00.000Z',
      parameters: { q: '*', page: 1 },
    };
    expect(parseSearchHistory(JSON.stringify([previous, { invalid: true }]))).toEqual([previous]);
    expect(parseSearchHistory('invalid')).toEqual([]);

    const latest: SearchHistoryEntry = {
      id: 'latest',
      mode: 'builder',
      createdAt: '2026-08-11T11:00:00.000Z',
      parameters: { q: '*', page: 1 },
    };
    expect(prependSearchHistory([previous], latest)).toEqual([latest]);
  });

  it('parses and collects safe highlighted text segments', () => {
    const snippet = `The ${HIGHLIGHT_START}Dune${HIGHLIGHT_END} saga`;
    expect(parseHighlightSegments(snippet)).toEqual([
      { text: 'The ', matched: false },
      { text: 'Dune', matched: true },
      { text: ' saga', matched: false },
    ]);
    expect(
      collectHighlightSnippets({
        title: { snippet, matched_tokens: ['Dune'] },
        author: { value: 'Frank Herbert', matched_tokens: [] },
      }),
    ).toEqual([{ field: 'title', segments: parseHighlightSegments(snippet) }]);
  });
});
