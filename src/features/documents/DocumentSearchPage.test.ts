import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import InputNumber from 'primevue/inputnumber';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';

import { HIGHLIGHT_END, HIGHLIGHT_START } from '@/features/documents/documentSearch';
import { deleteDocument, getCollection, searchDocuments } from '@/services/typesense/client';
import type { ConnectionProfile } from '@/services/typesense/types';
import { useConnectionStore } from '@/stores/connection';

import DocumentSearchPage from './DocumentSearchPage.vue';

vi.mock('@/services/typesense/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/typesense/client')>();
  return {
    ...original,
    getCollection: vi.fn(),
    searchDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    exportDocuments: vi.fn(),
  };
});

const profile: ConnectionProfile = {
  protocol: 'http',
  host: 'localhost',
  port: 8130,
  apiKey: 'test-key',
  connectionTimeoutSeconds: 10,
};
const createObjectUrl = vi.fn(() => 'blob:search-response');

const collection: CollectionSchema = {
  name: 'products',
  fields: [
    { name: 'title', type: 'string', index: true, optional: false },
    {
      name: 'category',
      type: 'string',
      index: true,
      optional: true,
      facet: true,
    },
    { name: 'published', type: 'bool', index: true, optional: true, facet: true },
    {
      name: 'rating',
      type: 'float',
      index: true,
      optional: true,
      facet: true,
      sort: true,
    },
  ],
  num_documents: 2,
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

const searchResponse: Awaited<ReturnType<typeof searchDocuments>> = {
  found: 2,
  out_of: 2,
  page: 1,
  request_params: { q: '*', page: 1, per_page: 12 },
  search_time_ms: 2,
  hits: [
    {
      document: { id: 'one', title: 'First product', rating: 4.5 },
      highlight: {
        title: {
          snippet: `${HIGHLIGHT_START}First${HIGHLIGHT_END} product`,
          matched_tokens: ['First'],
        },
      },
      text_match: 0,
    },
    {
      document: { id: 'two', title: 'Second product', rating: 3 },
      highlight: {},
      text_match: 0,
    },
  ],
  facet_counts: [
    {
      field_name: 'category',
      counts: [{ value: 'Books', count: 2, highlighted: 'Books' }],
      sampled: false,
      stats: {},
    },
    {
      field_name: 'published',
      counts: [{ value: 'true', count: 1, highlighted: 'true' }],
      sampled: false,
      stats: {},
    },
    {
      field_name: 'rating',
      counts: [{ value: '4.5', count: 1, highlighted: '4.5' }],
      sampled: false,
      stats: { min: 3, max: 4.5 },
    },
  ],
};

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useConnectionStore().$patch({ profile });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/collection/:name/search', component: DocumentSearchPage },
      {
        path: '/collection/:name/document',
        name: 'collection-documents',
        component: { template: '<div />' },
      },
      { path: '/collections', component: { template: '<div />' } },
    ],
  });
  await router.push('/collection/products/search');
  await router.isReady();
  const wrapper = mount(DocumentSearchPage, {
    global: {
      plugins: [pinia, router, [VueQueryPlugin, { queryClient }], PrimeVue],
      directives: { tooltip: { mounted: () => undefined } },
      stubs: { teleport: true },
    },
  });
  await flushPromises();
  return { wrapper, router, queryClient };
}

describe('DocumentSearchPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    createObjectUrl.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(getCollection).mockResolvedValue(collection);
    vi.mocked(searchDocuments).mockResolvedValue(searchResponse);
    vi.mocked(deleteDocument).mockResolvedValue({ id: 'one', title: 'First product' });
  });

  it('browses documents and opens an authoritative edit route', async () => {
    const { wrapper, router, queryClient } = await mountPage();

    expect(searchDocuments).toHaveBeenCalledWith('products', {
      q: '*',
      query_by: 'title,category',
      facet_by: 'category,published,rating',
      highlight_fields: 'title,category',
      highlight_start_tag: HIGHLIGHT_START,
      highlight_end_tag: HIGHLIGHT_END,
      page: 1,
      per_page: 12,
    });
    expect(wrapper.text()).toContain('First product');
    expect(wrapper.text()).toContain('2 results');
    expect(wrapper.text()).toContain('Filters and sorting');
    expect(wrapper.text()).toContain('rating');

    await wrapper.get('input[aria-label="Search documents"]').setValue('First');
    await wrapper.get('form[role="search"]').trigger('submit');
    await flushPromises();
    expect(searchDocuments).toHaveBeenLastCalledWith(
      'products',
      expect.objectContaining({ q: 'First' }),
    );

    await wrapper.get('button[aria-label="Edit document one"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('collection-documents');
    expect(router.currentRoute.value.query.edit).toBe('one');

    wrapper.unmount();
    queryClient.clear();
  });

  it('requires confirmation before deleting a document', async () => {
    const { wrapper, queryClient } = await mountPage();

    await wrapper.get('button[aria-label="Delete document one"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Delete document one?');
    expect(deleteDocument).not.toHaveBeenCalled();

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Delete document');
    await confirm?.trigger('click');
    await flushPromises();
    expect(deleteDocument).toHaveBeenCalledWith('products', 'one');

    wrapper.unmount();
    queryClient.clear();
  });

  it('applies a numeric range to the search request', async () => {
    const { wrapper, queryClient } = await mountPage();

    const rangeInputs = wrapper.findAllComponents(InputNumber);
    rangeInputs[0]?.vm.$emit('update:modelValue', 4);
    rangeInputs[1]?.vm.$emit('update:modelValue', 5);
    await flushPromises();
    const apply = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Apply filters');
    await apply?.trigger('click');
    await flushPromises();

    expect(searchDocuments).toHaveBeenLastCalledWith(
      'products',
      expect.objectContaining({ filter_by: 'rating:[4..5]' }),
    );

    wrapper.unmount();
    queryClient.clear();
  });

  it('runs a validated raw JSON request and stores collection history', async () => {
    const { wrapper, queryClient } = await mountPage();

    const rawMode = wrapper.findAll('button').find((button) => button.text().trim() === 'Raw JSON');
    await rawMode?.trigger('click');
    await flushPromises();

    const editor = wrapper.get('textarea[aria-label="Raw search request"]');
    await editor.setValue(JSON.stringify({ q: 'Second', query_by: 'title', per_page: 5 }, null, 2));
    const run = wrapper.findAll('button').find((button) => button.text().trim() === 'Run search');
    await run?.trigger('click');
    await flushPromises();

    expect(searchDocuments).toHaveBeenLastCalledWith('products', {
      q: 'Second',
      query_by: 'title',
      per_page: 5,
    });
    expect(wrapper.text()).toContain('History (2)');

    const history = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'History (2)');
    await history?.trigger('click');
    expect(wrapper.text()).toContain('Second in title');
    expect(wrapper.text()).toContain('Raw JSON at');

    wrapper.unmount();
    queryClient.clear();
  });

  it('inspects and downloads the complete search response', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { wrapper, queryClient } = await mountPage();

    const responseView = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Response');
    await responseView?.trigger('click');
    await flushPromises();

    const response = wrapper.get('pre[aria-label="Raw search response"]');
    expect(response.text()).toContain('"found": 2');
    expect(response.text()).toContain('"First product"');

    const download = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Download response');
    await download?.trigger('click');
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();

    click.mockRestore();
    wrapper.unmount();
    queryClient.clear();
  });
});
