import type { Client } from 'typesense';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activateClient,
  clearActiveClient,
  deleteDocument,
  exportDocuments,
  getDocument,
  importDocuments,
  searchDocuments,
  updateCollection,
} from '@/services/typesense/client';
import type { ConnectionProfile } from '@/services/typesense/types';

const profile: ConnectionProfile = {
  protocol: 'http',
  host: 'localhost',
  port: 8130,
  apiKey: 'test-key',
  connectionTimeoutSeconds: 10,
};

describe('Typesense collection service', () => {
  afterEach(() => clearActiveClient());

  it('retrieves the complete collection after an update delta response', async () => {
    const updatedCollection = {
      name: 'products',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'category', type: 'string', optional: true },
      ],
      num_documents: 0,
    };
    const update = vi.fn().mockResolvedValue({ fields: [{ name: 'category', type: 'string' }] });
    const retrieve = vi.fn().mockResolvedValue(updatedCollection);
    const client = {
      collections: vi.fn(() => ({ update, retrieve })),
    } as unknown as Client;
    activateClient(profile, client);

    await expect(
      updateCollection('products', {
        fields: [{ name: 'category', type: 'string', optional: true }],
      }),
    ).resolves.toBe(updatedCollection);
    expect(update).toHaveBeenCalledOnce();
    expect(retrieve).toHaveBeenCalledOnce();
  });

  it('imports document arrays with the selected action', async () => {
    const results = [
      { success: true as const, id: 'one' },
      { success: false as const, id: 'two', code: 400, error: 'Invalid field.' },
    ];
    const importBatch = vi.fn().mockResolvedValue(results);
    const client = {
      collections: vi.fn(() => ({
        documents: vi.fn(() => ({ import: importBatch })),
      })),
    } as unknown as Client;
    activateClient(profile, client);

    const documents = [{ id: 'one', title: 'First' }, { id: 'two' }];
    await expect(importDocuments('products', documents, 'create')).resolves.toBe(results);
    expect(importBatch).toHaveBeenCalledWith(documents, {
      action: 'create',
      throwOnFail: false,
    });
  });

  it('searches, retrieves, exports, and deletes through document resources', async () => {
    const searchResult = {
      found: 1,
      out_of: 1,
      page: 1,
      request_params: { q: '*' },
      search_time_ms: 1,
      hits: [],
    };
    const search = vi.fn().mockResolvedValue(searchResult);
    const exportBatch = vi.fn().mockResolvedValue('{"id":"one"}');
    const retrieve = vi.fn().mockResolvedValue({ id: 'one', title: 'First' });
    const remove = vi.fn().mockResolvedValue({ id: 'one', title: 'First' });
    const documents = vi.fn((id?: string) =>
      id ? { retrieve, delete: remove } : { search, export: exportBatch },
    );
    const client = {
      collections: vi.fn(() => ({ documents })),
    } as unknown as Client;
    activateClient(profile, client);

    await expect(
      searchDocuments('products', {
        q: '*',
        query_by: 'title',
        page: 1,
        per_page: 12,
      }),
    ).resolves.toBe(searchResult);
    await expect(getDocument('products', 'one')).resolves.toEqual({ id: 'one', title: 'First' });
    await expect(exportDocuments('products')).resolves.toBe('{"id":"one"}');
    await expect(deleteDocument('products', 'one')).resolves.toEqual({
      id: 'one',
      title: 'First',
    });

    expect(search).toHaveBeenCalledWith({
      q: '*',
      query_by: 'title',
      page: 1,
      per_page: 12,
    });
    expect(documents).toHaveBeenCalledWith('one');
    expect(exportBatch).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });
});
