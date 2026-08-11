import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';

import type { DocumentRecord } from '@/services/typesense/client';

export class DocumentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentInputError';
  }
}

function isDocument(value: unknown): value is DocumentRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateDocuments(value: unknown): DocumentRecord[] {
  if (!Array.isArray(value)) {
    throw new DocumentInputError('The editor must contain a JSON array of documents.');
  }
  if (value.length === 0) {
    throw new DocumentInputError('Add at least one document before importing.');
  }

  value.forEach((document, index) => {
    if (!isDocument(document)) {
      throw new DocumentInputError(`Document ${index + 1} must be a JSON object.`);
    }
  });

  return value;
}

export function parseDocumentJson(source: string): DocumentRecord[] {
  try {
    return validateDocuments(JSON.parse(source) as unknown);
  } catch (error) {
    if (error instanceof DocumentInputError) throw error;
    throw new DocumentInputError(
      error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : 'Invalid document JSON.',
    );
  }
}

export function parseDocumentFile(source: string): DocumentRecord[] {
  const trimmed = source.trim();
  if (!trimmed) throw new DocumentInputError('The selected file is empty.');

  try {
    const value = JSON.parse(trimmed) as unknown;
    return validateDocuments(isDocument(value) ? [value] : value);
  } catch (error) {
    if (error instanceof DocumentInputError) throw error;
  }

  const documents = trimmed.split(/\r?\n/).map((line, index) => {
    try {
      const value = JSON.parse(line) as unknown;
      if (!isDocument(value)) {
        throw new DocumentInputError(`Line ${index + 1} must contain a JSON object.`);
      }
      return value;
    } catch (error) {
      if (error instanceof DocumentInputError) throw error;
      throw new DocumentInputError(`Invalid JSON on line ${index + 1}.`);
    }
  });

  return validateDocuments(documents);
}

function starterValue(type: string): unknown {
  if (type.endsWith('[]')) return [];
  if (type === 'bool') return false;
  if (type === 'object') return {};
  if (type === 'geopoint') return [0, 0];
  if (type.includes('string') || type === 'auto') return '';
  return 0;
}

export function createStarterDocument(
  fields: Pick<CollectionFieldSchema, 'name' | 'type'>[],
): DocumentRecord {
  return Object.fromEntries(
    fields
      .filter((field) => !field.name.includes('*'))
      .map((field) => [field.name, starterValue(field.type)]),
  );
}

export function formatDocuments(documents: DocumentRecord[]): string {
  return JSON.stringify(documents, null, 2);
}
