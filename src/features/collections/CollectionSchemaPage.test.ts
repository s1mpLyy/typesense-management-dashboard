import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';

import { getCollection } from '@/services/typesense/client';
import { TypesenseDashboardError } from '@/services/typesense/errors';
import type { ConnectionProfile } from '@/services/typesense/types';
import { useConnectionStore } from '@/stores/connection';

import CollectionSchemaPage from './CollectionSchemaPage.vue';

vi.mock('@/services/typesense/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/typesense/client')>();
  return {
    ...original,
    getCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: vi.fn(),
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
    { name: 'title', type: 'string', index: true, optional: false, sort: true },
    { name: 'category', type: 'string', index: true, optional: true, facet: true },
  ],
  num_documents: 12,
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

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useConnectionStore().$patch({ profile });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/collections', component: { template: '<div />' }, name: 'collections' },
      { path: '/collection/:name/schema', component: CollectionSchemaPage },
    ],
  });
  await router.push('/collection/products/schema');
  await router.isReady();
  const wrapper = mount(CollectionSchemaPage, {
    global: {
      plugins: [pinia, router, [VueQueryPlugin, { queryClient }], PrimeVue],
      directives: { tooltip: { mounted: () => undefined } },
    },
  });
  await flushPromises();
  return { wrapper, queryClient };
}

describe('CollectionSchemaPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders schema metadata and field traits', async () => {
    vi.mocked(getCollection).mockResolvedValue(collection);
    const { wrapper, queryClient } = await mountPage();

    expect(wrapper.get('h1').text()).toBe('products');
    expect(wrapper.text()).toContain('12');
    expect(wrapper.text()).toContain('title');
    expect(wrapper.text()).toContain('Sortable');
    expect(wrapper.text()).toContain('category');
    expect(wrapper.text()).toContain('Facet');

    wrapper.unmount();
    queryClient.clear();
  });

  it('shows a dedicated missing-collection state', async () => {
    vi.mocked(getCollection).mockRejectedValue(
      new TypesenseDashboardError('The requested Typesense endpoint was not found.', 404),
    );
    const { wrapper, queryClient } = await mountPage();

    expect(wrapper.get('h1').text()).toBe('Collection not found');
    expect(wrapper.text()).toContain('No collection named products exists on this node.');

    wrapper.unmount();
    queryClient.clear();
  });
});
