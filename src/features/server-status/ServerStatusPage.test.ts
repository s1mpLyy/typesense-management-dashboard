import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchServerStatus } from '@/services/typesense/client';
import type { ConnectionProfile } from '@/services/typesense/types';
import { useConnectionStore } from '@/stores/connection';

import ServerStatusPage from './ServerStatusPage.vue';

vi.mock('@/services/typesense/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/typesense/client')>();
  return { ...original, fetchServerStatus: vi.fn() };
});

const profile: ConnectionProfile = {
  protocol: 'http',
  host: 'localhost',
  port: 8108,
  apiKey: 'test-key',
  connectionTimeoutSeconds: 10,
};

describe('ServerStatusPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(fetchServerStatus).mockResolvedValue({
      health: true,
      version: '30.0',
      collectionCount: 2,
      documentCount: 78,
      diskUsedBytes: 18_400_000,
      diskTotalBytes: 1_000_000_000,
      searchRequestsPerSecond: 4.25,
      writeRequestsPerSecond: 0.5,
      totalRequestsPerSecond: 4.75,
      pendingWriteBatches: 0,
      fetchedAt: new Date('2026-08-10T12:00:00Z'),
      unavailableResources: [],
    });
  });

  it('renders live data for the connected node', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useConnectionStore().$patch({ profile });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = mount(ServerStatusPage, {
      global: {
        plugins: [pinia, [VueQueryPlugin, { queryClient }], PrimeVue],
      },
    });

    await flushPromises();

    expect(wrapper.get('h1').text()).toBe('Server status');
    expect(wrapper.text()).toContain('Healthy');
    expect(wrapper.text()).toContain('30.0');
    expect(wrapper.text()).toContain('78 documents');
    expect(wrapper.text()).toContain('http://localhost:8108');

    wrapper.unmount();
    queryClient.clear();
  });
});
