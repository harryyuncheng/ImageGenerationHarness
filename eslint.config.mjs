import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/cdk.out/**', '**/playwright-report/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      'max-lines': ['error', { max: 425, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'warn',
        { max: 200, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  {
    files: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/test/**/*.{ts,tsx}',
      '**/tests/**/*.{ts,tsx}',
      '**/test-support/**/*.{ts,tsx}',
    ],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'warn',
        { max: 300, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
);
