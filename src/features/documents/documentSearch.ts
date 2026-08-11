import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import type { SearchParams } from 'typesense/lib/Typesense/Types';

export const HIGHLIGHT_START = '[[[typesense-highlight]]]';
export const HIGHLIGHT_END = '[[[/typesense-highlight]]]';

export type SearchField = Pick<CollectionFieldSchema, 'name' | 'type' | 'index' | 'facet' | 'sort'>;

export interface NumericRange {
  min: number | null;
  max: number | null;
}

export interface SortOption {
  label: string;
  value: string;
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export interface HighlightSnippet {
  field: string;
  segments: HighlightSegment[];
}

export type SearchMode = 'builder' | 'raw';

export interface SearchHistoryEntry {
  id: string;
  mode: SearchMode;
  createdAt: string;
  parameters: SearchParams<object>;
}

export const SEARCH_HISTORY_LIMIT = 12;

export class DocumentSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentSearchError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseRawSearchParameters(input: string): SearchParams<object> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new DocumentSearchError('Enter a valid JSON search request.');
  }

  if (!isRecord(parsed)) {
    throw new DocumentSearchError('The raw search request must be a JSON object.');
  }
  if (typeof parsed.q !== 'string' || !parsed.q.trim()) {
    throw new DocumentSearchError('The raw search request requires a non-empty string q value.');
  }

  return parsed;
}

function isSearchHistoryEntry(value: unknown): value is SearchHistoryEntry {
  if (!isRecord(value) || !isRecord(value.parameters)) return false;
  return (
    typeof value.id === 'string' &&
    (value.mode === 'builder' || value.mode === 'raw') &&
    typeof value.createdAt === 'string' &&
    typeof value.parameters.q === 'string' &&
    Boolean(value.parameters.q.trim())
  );
}

export function parseSearchHistory(serialized: string | null): SearchHistoryEntry[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSearchHistoryEntry).slice(0, SEARCH_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function prependSearchHistory(
  entries: SearchHistoryEntry[],
  entry: SearchHistoryEntry,
): SearchHistoryEntry[] {
  const signature = JSON.stringify(entry.parameters);
  return [
    entry,
    ...entries.filter(
      (candidate) =>
        candidate.mode !== entry.mode || JSON.stringify(candidate.parameters) !== signature,
    ),
  ].slice(0, SEARCH_HISTORY_LIMIT);
}

export function searchableFieldNames(fields: SearchField[]): string[] {
  return fields
    .filter(
      (field) =>
        field.index !== false &&
        ['string', 'string[]'].includes(field.type) &&
        !field.name.includes('*'),
    )
    .map((field) => field.name);
}

export function facetFields(fields: SearchField[], types: string[]): SearchField[] {
  return fields.filter(
    (field) => field.facet && types.includes(field.type) && !field.name.includes('*'),
  );
}

export function sortOptions(fields: SearchField[]): SortOption[] {
  return [
    { label: 'Relevance', value: '' },
    ...fields
      .filter((field) => field.sort && !field.name.includes('*'))
      .flatMap((field) => [
        { label: `${field.name} ascending`, value: `${field.name}:asc` },
        { label: `${field.name} descending`, value: `${field.name}:desc` },
      ]),
  ];
}

function filterString(value: string): string {
  return `\`${value.replaceAll('`', '\\`')}\``;
}

export function buildFilterBy(
  facetSelections: Record<string, string | undefined>,
  numericRanges: Record<string, NumericRange | undefined>,
  booleanFields: string[] = [],
): string {
  const filters = Object.entries(facetSelections)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([field, value]) =>
      booleanFields.includes(field) ? `${field}:=${value}` : `${field}:=${filterString(value)}`,
    );

  for (const [field, range] of Object.entries(numericRanges)) {
    if (!range) continue;
    const min = Number.isFinite(range.min) ? range.min : null;
    const max = Number.isFinite(range.max) ? range.max : null;
    if (min !== null && max !== null && min > max) {
      throw new DocumentSearchError(`${field} minimum cannot exceed its maximum.`);
    }
    if (min !== null && max !== null) filters.push(`${field}:[${min}..${max}]`);
    else if (min !== null) filters.push(`${field}:>=${min}`);
    else if (max !== null) filters.push(`${field}:<=${max}`);
  }

  return filters.join(' && ');
}

export function parseHighlightSegments(snippet: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let remaining = snippet;

  while (remaining) {
    const start = remaining.indexOf(HIGHLIGHT_START);
    if (start === -1) {
      segments.push({ text: remaining, matched: false });
      break;
    }
    if (start > 0) segments.push({ text: remaining.slice(0, start), matched: false });
    const highlightedStart = start + HIGHLIGHT_START.length;
    const end = remaining.indexOf(HIGHLIGHT_END, highlightedStart);
    if (end === -1) {
      segments.push({ text: remaining.slice(start), matched: false });
      break;
    }
    segments.push({ text: remaining.slice(highlightedStart, end), matched: true });
    remaining = remaining.slice(end + HIGHLIGHT_END.length);
  }

  return segments;
}

export function collectHighlightSnippets(value: unknown, path = ''): HighlightSnippet[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectHighlightSnippets(item, `${path}[${index}]`));
  }

  const record = value as Record<string, unknown>;
  const snippet =
    typeof record.snippet === 'string'
      ? record.snippet
      : typeof record.value === 'string'
        ? record.value
        : null;
  const matchedTokens = Array.isArray(record.matched_tokens) ? record.matched_tokens : [];
  if (snippet && matchedTokens.length) {
    return [{ field: path, segments: parseHighlightSegments(snippet) }];
  }

  return Object.entries(record).flatMap(([key, child]) =>
    collectHighlightSnippets(child, path ? `${path}.${key}` : key),
  );
}
