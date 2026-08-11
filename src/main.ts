import { VueQueryPlugin } from '@tanstack/vue-query';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import App from '@/App.vue';
import { pinia } from '@/app/pinia';
import { router } from '@/app/router';
import { TypesensePreset } from '@/styles/preset';
import '@/styles/tokens.css';
import '@/styles/global.css';

const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(VueQueryPlugin);
app.use(PrimeVue, {
  theme: {
    preset: TypesensePreset,
    options: {
      darkModeSelector: '.app-dark',
      cssLayer: false,
    },
  },
});
app.directive('tooltip', Tooltip);

app.mount('#app');
