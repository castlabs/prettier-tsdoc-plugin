import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintTypedocPlugin from 'eslint-plugin-tsdoc';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['**/dist/', '**/node_modules/'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      tsdoc: eslintTypedocPlugin,
    },
    rules: {
      'tsdoc/syntax': 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // this is removing rules that conflict with prettier so leave it the bottom
  eslintConfigPrettier,
];
