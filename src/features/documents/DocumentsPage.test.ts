import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';

import { getCollection, getDocument, importDocuments } from '@/services/typesense/client';
import type { ConnectionProfile } from '@/services/typesense/types';
import { useConnectionStore } from '@/stores/connection';

import DocumentsPage from './DocumentsPage.vue';

vi.mock('@/services/typesense/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/typesense/client')>();
  return {
    ...original,
    getCollection: vi.fn(),
    getDocument: vi.fn(),
    importDocuments: vi.fn(),
  };
});

const profile: ConnectionProfile = {
  protocol: 'http',
  host: 'localhost',
  port: 8130,
  apiKey: 'test-key',
  connectionTimeoutSeconds: 10,
};

const collection: CollectionSchema = {
  name: 'products',
  fields: [
    { name: 'title', type: 'string', index: true, optional: false },
    { name: 'tags', type: 'string[]', index: true, optional: true },
  ],
  num_documents: 0,
  created_at: 1_700_000_000,
  default_sorting_field: '',
  enable_nested_fields: false,
  num_memory_shards: 4,
  metadata: {},
  voice_query_model: {},
  symbols_to_index: [],
  token_separators: [],
  synonym_sets: [],
  curation_sets: [],
};

async function mountPage(path = '/collection/products/document') {
  const pinia = createPinia();
  setActivePinia(pinia);
  useConnectionStore().$patch({ profile });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/collections', component: { template: '<div />' } },
      {
        path: '/collection/:name/document',
        name: 'collection-documents',
        component: DocumentsPage,
      },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(DocumentsPage, {
    global: {
      plugins: [pinia, router, [VueQueryPlugin, { queryClient }], PrimeVue],
    },
  });
  await flushPromises();
  return { wrapper, queryClient };
}

describe('DocumentsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(getCollection).mockResolvedValue(collection);
    vi.mocked(getDocument).mockReset();
    vi.mocked(importDocuments).mockReset();
  });

  it('starts with a schema-derived document and validates the array root', async () => {
    const { wrapper, queryClient } = await mountPage();
    const editor = wrapper.get('textarea[aria-label="Document JSON"]');

    const textarea = editor.element as HTMLTextAreaElement;
    expect(textarea.value).toContain('"title": ""');
    expect(textarea.value).toContain('"tags": []');

    await editor.setValue('{"id":"one"}');
    expect(wrapper.text()).toContain('The editor must contain a JSON array of documents.');
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('Import documents'))
        ?.attributes('disabled'),
    ).toBeDefined();

    wrapper.unmount();
    queryClient.clear();
  });

  it('submits a batch and renders mixed row results', async () => {
    vi.mocked(importDocuments).mockResolvedValue([
      { success: true, id: 'ok' },
      { success: false, id: 'bad', code: 400, error: 'Field title must be a string.' },
    ]);
    const { wrapper, queryClient } = await mountPage();
    const documents = [
      { id: 'ok', title: 'Good' },
      { id: 'bad', title: 1 },
    ];

    await wrapper.get('textarea[aria-label="Document JSON"]').setValue(JSON.stringify(documents));
    const importButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Import documents'));
    expect(importButton).toBeDefined();
    await importButton?.trigger('click');
    await flushPromises();

    expect(importDocuments).toHaveBeenCalledWith('products', documents, 'upsert');
    expect(wrapper.text()).toContain('1 succeeded, 1 failed');
    expect(wrapper.text()).toContain('Imported successfully');
    expect(wrapper.text()).toContain('Field title must be a string.');

    wrapper.unmount();
    queryClient.clear();
  });

  it('loads an edit document from the server by id', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: 'one',
      title: 'Authoritative product',
      tags: ['stored'],
    });
    const { wrapper, queryClient } = await mountPage('/collection/products/document?edit=one');

    expect(getDocument).toHaveBeenCalledWith('products', 'one');
    const value = (
      wrapper.get('textarea[aria-label="Document JSON"]').element as HTMLTextAreaElement
    ).value;
    expect(value).toContain('Authoritative product');
    expect(value).toContain('"tags": [');
    expect(wrapper.text()).toContain('Editing document one.');

    const newBatch = wrapper
      .findAll('button')
      .find((button) => button.text().includes('New batch'));
    await newBatch?.trigger('click');
    await flushPromises();
    const editor = wrapper.get('textarea[aria-label="Document JSON"]');
    await editor.setValue('[{"id":"draft","title":"Keep this draft"}]');
    await queryClient.invalidateQueries({ queryKey: ['collection'] });
    await flushPromises();
    expect((editor.element as HTMLTextAreaElement).value).toContain('Keep this draft');

    wrapper.unmount();
    queryClient.clear();
  });
});
