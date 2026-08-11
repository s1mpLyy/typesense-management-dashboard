import { createRouter, createWebHashHistory } from 'vue-router';

import AppShell from '@/app/AppShell.vue';
import { pinia } from '@/app/pinia';
import LoginPage from '@/features/auth/LoginPage.vue';
import ServerStatusPage from '@/features/server-status/ServerStatusPage.vue';
import NotFoundPage from '@/features/shared/NotFoundPage.vue';
import PlaceholderPage from '@/features/shared/PlaceholderPage.vue';
import { useConnectionStore } from '@/stores/connection';

const placeholderRoutes = [
  ['clusters', 'Cluster'],
  ['collections', 'Collections'],
  ['collection/:name/schema', 'Schema'],
  ['collection/:name/document', 'Documents'],
  ['collection/:name/search', 'Search'],
  ['aliases', 'Aliases'],
  ['apikeys', 'API keys'],
  ['analyticsrules', 'Analytics rules'],
  ['searchpresets', 'Search presets'],
  ['stopwords', 'Stopword sets'],
  ['stemming', 'Stemming dictionaries'],
  ['synonyms', 'Synonym sets'],
  ['curations', 'Curation sets'],
] as const;

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      meta: { requiresConnection: true },
      children: [
        {
          path: '',
          name: 'server-status',
          component: ServerStatusPage,
        },
        ...placeholderRoutes.map(([path, title]) => ({
          path,
          component: PlaceholderPage,
          props: { title },
        })),
      ],
    },
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const connection = useConnectionStore(pinia);
  const requiresConnection = to.matched.some((record) => record.meta.requiresConnection);

  if (requiresConnection && !connection.isConnected) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.name === 'login' && connection.isConnected) {
    return { name: 'server-status' };
  }

  return true;
});
