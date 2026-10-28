import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const githubRepositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1);
const githubPagesBase = githubRepositoryName ? `/${githubRepositoryName}/` : '/';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || githubPagesBase,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
