import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    ignores: ['.svelte-kit/**', 'build/**', 'dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        /** Maps JavaScript API (loaded at runtime when `PUBLIC_GOOGLE_MAPS_API_KEY` is set). */
        google: 'readonly',
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    rules: {
      // typescript-eslint can throw on Svelte AST nodes (e.g. reactive $: labels).
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
);

