import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [
  { ignores: ['*.config.js', 'src/infrastructure/prisma/generated/**', 'dist/**', 'web/dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Regla de arquitectura: el dominio no depende de infraestructura ni frameworks
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@prisma/client', 'express', '**/infrastructure/**', '**/http/**', '**/application/**'], message: 'El dominio no puede depender de infraestructura, HTTP ni aplicación.' }] }] },
  },
];
