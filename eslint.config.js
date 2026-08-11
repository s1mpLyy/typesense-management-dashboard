import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from '@vue/eslint-config-prettier/skip-formatting';
import tseslint from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**'] },
  eslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...tseslint({ extends: ['recommendedTypeChecked'] }),
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['src/**/*.test.ts'],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
  },
  prettier,
];
