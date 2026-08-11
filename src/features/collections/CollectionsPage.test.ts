import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { listCollections } from '@/services/typesense/client';
import type { ConnectionProfile } from '@/services/typesense/types';
import { useConnectionStore } from '@/stores/connection';

import CollectionsPage from './CollectionsPage.vue';

vi.mock('@/services/typesense/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/typesense/client')>();
  return {
    ...original,
    listCollections: vi.fn(),
    createCollection: vi.fn(),
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

describe('CollectionsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(listCollections).mockResolvedValue([
      {
        name: 'products',
        fields: [{ name: 'title', type: 'string' }],
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
      },
    ]);
  });

  it('renders and filters live collections', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useConnectionStore().$patch({ profile });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/collections', component: CollectionsPage },
        { path: '/collection/:name/search', component: { template: '<div />' } },
        { path: '/collection/:name/schema', component: { template: '<div />' } },
      ],
    });
    await router.push('/collections');
    await router.isReady();
    const wrapper = mount(CollectionsPage, {
      global: {
        plugins: [pinia, router, [VueQueryPlugin, { queryClient }], PrimeVue],
        directives: { tooltip: { mounted: () => undefined } },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('products');
    expect(wrapper.text()).toContain('12');

    await wrapper.get('input[aria-label="Filter collections"]').setValue('missing');
    expect(wrapper.text()).toContain('No matching collections');

    wrapper.unmount();
    queryClient.clear();
  });
});
