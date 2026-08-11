<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { Activity, CircleAlert, Database, Gauge, HardDrive, RefreshCw, Server } from '@lucide/vue';
import Button from 'primevue/button';
import { computed } from 'vue';

import { fetchServerStatus } from '@/services/typesense/client';
import { useConnectionStore } from '@/stores/connection';

const connection = useConnectionStore();
const statusQuery = useQuery({
  queryKey: computed(() => ['server-status', connection.sessionId]),
  queryFn: fetchServerStatus,
  refetchInterval: 10_000,
  retry: 1,
});

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Unavailable';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** unitIndex;
  return `${amount.toFixed(amount >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatRate(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Unavailable' : `${value.toFixed(2)}/s`;
}

const diskDetail = computed(() => {
  const status = statusQuery.data.value;
  if (!status || status.diskTotalBytes === null) return 'Metrics permission required';
  return `${formatBytes(status.diskTotalBytes)} total`;
});

const metrics = computed(() => {
  const status = statusQuery.data.value;
  return [
    {
      label: 'Server health',
      value:
        status?.health === true
          ? 'Healthy'
          : status?.health === false
            ? 'Unhealthy'
            : 'Unavailable',
      detail: status?.health === null ? 'Health endpoint unavailable' : 'Live server response',
      icon: Activity,
      tone: status?.health === true ? 'success' : 'neutral',
    },
    {
      label: 'Typesense version',
      value: status?.version ?? 'Unavailable',
      detail: status?.version ? 'Reported by debug endpoint' : 'Debug permission required',
      icon: Server,
      tone: 'neutral',
    },
    {
      label: 'Collections',
      value: String(status?.collectionCount ?? 0),
      detail: `${status?.documentCount ?? 0} documents`,
      icon: Database,
      tone: 'neutral',
    },
    {
      label: 'Disk usage',
      value: formatBytes(status?.diskUsedBytes),
      detail: diskDetail.value,
      icon: HardDrive,
      tone: 'neutral',
    },
  ];
});
</script>

<template>
  <section class="page-section">
    <div class="page-header">
      <div>
        <p class="eyebrow">Overview</p>
        <h1>Server status</h1>
        <p>Health, capacity, and request activity for the connected Typesense node.</p>
      </div>
      <Button
        label="Refresh"
        severity="secondary"
        outlined
        :loading="statusQuery.isFetching.value"
        @click="statusQuery.refetch()"
      >
        <template #icon><RefreshCw :size="17" /></template>
      </Button>
    </div>

    <div v-if="statusQuery.error.value" class="inline-alert inline-alert--error" role="alert">
      <CircleAlert :size="18" />
      <div>
        <strong>Server data could not be loaded</strong>
        <span>{{ statusQuery.error.value.message }}</span>
      </div>
    </div>

    <div
      v-else-if="statusQuery.data.value?.unavailableResources.length"
      class="inline-alert inline-alert--warning"
      role="status"
    >
      <CircleAlert :size="18" />
      <div>
        <strong>Some server details are unavailable</strong>
        <span>
          This key cannot read
          {{ statusQuery.data.value.unavailableResources.join(', ') }}.
        </span>
      </div>
    </div>

    <div v-if="statusQuery.isPending.value" class="status-loading" aria-live="polite">
      Loading server status...
    </div>

    <template v-else-if="statusQuery.data.value">
      <div class="metric-grid" aria-label="Server metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric-card">
          <div class="metric-icon" :class="`metric-icon--${metric.tone}`">
            <component :is="metric.icon" :size="20" aria-hidden="true" />
          </div>
          <div>
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.detail }}</small>
          </div>
        </article>
      </div>

      <div class="status-grid">
        <section class="data-panel">
          <div class="panel-header">
            <div>
              <h2>Node details</h2>
              <p>Active browser connection.</p>
            </div>
            <span class="live-indicator"><span /> Connected</span>
          </div>
          <dl class="detail-list">
            <div>
              <dt>Endpoint</dt>
              <dd>{{ connection.endpoint }}</dd>
            </div>
            <div>
              <dt>Protocol</dt>
              <dd>{{ connection.profile?.protocol.toUpperCase() }}</dd>
            </div>
            <div>
              <dt>Timeout</dt>
              <dd>{{ connection.profile?.connectionTimeoutSeconds }} seconds</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{{ statusQuery.data.value.fetchedAt.toLocaleTimeString() }}</dd>
            </div>
          </dl>
        </section>

        <section class="data-panel">
          <div class="panel-header">
            <div>
              <h2>Request activity</h2>
              <p>Current server throughput.</p>
            </div>
            <Gauge :size="18" aria-hidden="true" />
          </div>
          <dl class="detail-list">
            <div>
              <dt>Search requests</dt>
              <dd>{{ formatRate(statusQuery.data.value.searchRequestsPerSecond) }}</dd>
            </div>
            <div>
              <dt>Write requests</dt>
              <dd>{{ formatRate(statusQuery.data.value.writeRequestsPerSecond) }}</dd>
            </div>
            <div>
              <dt>Total requests</dt>
              <dd>{{ formatRate(statusQuery.data.value.totalRequestsPerSecond) }}</dd>
            </div>
            <div>
              <dt>Pending write batches</dt>
              <dd>{{ statusQuery.data.value.pendingWriteBatches ?? 'Unavailable' }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </section>
</template>
