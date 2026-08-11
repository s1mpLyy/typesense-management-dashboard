<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ChevronDown, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from '@lucide/vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { navigationGroups } from '@/app/navigation';
import { listCollections } from '@/services/typesense/client';
import { useConnectionStore } from '@/stores/connection';

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const connection = useConnectionStore();
const isSidebarCollapsed = ref(false);
const isMobileNavigationOpen = ref(false);
const isDark = ref(false);
const activeCollection = ref('');
const collectionsQuery = useQuery({
  queryKey: computed(() => ['collections', connection.sessionId]),
  queryFn: listCollections,
  staleTime: 10_000,
});
const collections = computed(() =>
  (collectionsQuery.data.value ?? []).map((collection) => ({
    label: collection.name,
    value: collection.name,
  })),
);

const currentTitle = computed(() => {
  for (const group of navigationGroups) {
    const match = group.items.find((item) => {
      const target = item.to.replace('/current/', `/${String(route.params.name ?? 'current')}/`);
      return target === route.path;
    });
    if (match) return match.label;
  }
  return 'Typesense Dashboard';
});

function resolvePath(path: string, collectionScoped = false): string {
  if (collectionScoped && !activeCollection.value) return '/collections';
  return path.replace('/current/', `/${activeCollection.value}/`);
}

function closeMobileNavigation(): void {
  isMobileNavigationOpen.value = false;
}

function toggleTheme(): void {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('app-dark', isDark.value);
  localStorage.setItem('typesense-dark-mode', String(isDark.value));
}

async function switchCollection(): Promise<void> {
  if (typeof route.params.name !== 'string' || !activeCollection.value) return;
  await router.push({
    path: route.path.replace(
      `/collection/${route.params.name}/`,
      `/collection/${activeCollection.value}/`,
    ),
  });
}

async function disconnect(): Promise<void> {
  queryClient.clear();
  connection.disconnect();
  await router.replace({ name: 'login' });
}

watch(
  [() => route.params.name, collections],
  ([routeCollection, availableCollections]) => {
    if (typeof routeCollection === 'string') {
      activeCollection.value = routeCollection;
      return;
    }
    if (!availableCollections.some((collection) => collection.value === activeCollection.value)) {
      activeCollection.value = availableCollections[0]?.value ?? '';
    }
  },
  { immediate: true },
);

onMounted(() => {
  isDark.value = localStorage.getItem('typesense-dark-mode') === 'true';
  document.documentElement.classList.toggle('app-dark', isDark.value);
});
</script>

<template>
  <div
    class="app-frame"
    :class="{
      'app-frame--collapsed': isSidebarCollapsed,
      'app-frame--mobile-open': isMobileNavigationOpen,
    }"
  >
    <button
      v-if="isMobileNavigationOpen"
      class="navigation-backdrop"
      aria-label="Close navigation"
      @click="closeMobileNavigation"
    />

    <aside class="sidebar" aria-label="Primary navigation">
      <div class="brand-row">
        <div class="brand-mark" aria-hidden="true">T</div>
        <div class="brand-copy">
          <strong>Typesense</strong>
          <span>Dashboard</span>
        </div>
        <Button
          v-tooltip.right="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          class="sidebar-collapse"
          text
          rounded
          :aria-label="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="isSidebarCollapsed = !isSidebarCollapsed"
        >
          <PanelLeftOpen v-if="isSidebarCollapsed" :size="18" />
          <PanelLeftClose v-else :size="18" />
        </Button>
      </div>

      <nav class="navigation">
        <section v-for="group in navigationGroups" :key="group.label" class="navigation-group">
          <h2>{{ group.label }}</h2>
          <RouterLink
            v-for="item in group.items"
            :key="item.label"
            :to="resolvePath(item.to, item.collectionScoped)"
            class="navigation-link"
            :title="isSidebarCollapsed ? item.label : undefined"
            @click="closeMobileNavigation"
          >
            <component :is="item.icon" :size="18" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <div class="connection-summary">
        <span class="status-dot" aria-hidden="true" />
        <div>
          <strong>Connected</strong>
          <span :title="connection.endpoint">{{ connection.endpoint }}</span>
        </div>
      </div>
    </aside>

    <header class="topbar">
      <Button
        class="mobile-menu"
        text
        rounded
        aria-label="Open navigation"
        @click="isMobileNavigationOpen = true"
      >
        <Menu :size="20" />
      </Button>
      <div class="page-identity">
        <span>Workspace</span>
        <strong>{{ currentTitle }}</strong>
      </div>
      <div class="topbar-actions">
        <Select
          v-model="activeCollection"
          :options="collections"
          option-label="label"
          option-value="value"
          aria-label="Active collection"
          class="collection-select"
          :loading="collectionsQuery.isPending.value"
          :disabled="collections.length === 0"
          @change="switchCollection"
        >
          <template #dropdownicon><ChevronDown :size="16" /></template>
        </Select>
        <Button
          v-tooltip.bottom="isDark ? 'Light theme' : 'Dark theme'"
          text
          rounded
          :aria-label="isDark ? 'Use light theme' : 'Use dark theme'"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" :size="19" />
          <Moon v-else :size="19" />
        </Button>
        <Button
          v-tooltip.bottom="'Disconnect'"
          text
          rounded
          aria-label="Disconnect"
          @click="disconnect"
        >
          <LogOut :size="19" />
        </Button>
      </div>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
