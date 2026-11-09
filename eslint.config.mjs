// Lint único para o monorepo. Regras de arquitetura (camadas) ficam em apps/api.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import acessibilidade from './tools/eslint/acessibilidade.mjs';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.expo/**', 'apps/mobile/babel.config.js', 'apps/mobile/metro.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Clean architecture: domínio e aplicação não conhecem infraestrutura.
    files: ['apps/api/src/**/domain/**/*.ts', 'apps/api/src/**/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['node:*', 'pg', '**/adapters/**', '**/infra/**', '**/main/**'], message: 'Domínio e aplicação dependem só de portas (interfaces), nunca de infraestrutura.' },
        ],
      }],
    },
  },
  {
    // Acessibilidade na escrita (ADR 0020): toque, campo e imagem sempre com nome.
    files: ['apps/mobile/src/**/*.tsx'],
    plugins: { acessibilidade },
    rules: {
      'acessibilidade/toque-com-papel': 'error',
      'acessibilidade/toque-com-nome': 'error',
      'acessibilidade/campo-com-rotulo': 'error',
      'acessibilidade/imagem-com-descricao': 'error',
    },
  },
);
