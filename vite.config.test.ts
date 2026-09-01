import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfigFromFile } from 'vite';

describe('GitHub Pages base path', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the current GitHub repository name', async () => {
    vi.stubEnv('VITE_BASE_PATH', '');
    vi.stubEnv('GITHUB_REPOSITORY', 's1mpLyy/typesense-management-dashboard');

    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      resolve(process.cwd(), 'vite.config.ts'),
    );

    expect(loaded?.config).toMatchObject({ base: '/typesense-management-dashboard/' });
  });
});
