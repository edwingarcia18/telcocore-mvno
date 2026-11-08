// Jest ejecuta CommonJS: ts-jest compila con su propia configuración (verificación de tipos activa).
// El editor y `npm run typecheck` usan tsconfig.json (node16).
const transform = {
  '^.+\\.ts$': ['ts-jest', {
    tsconfig: {
      target: 'ES2022', module: 'commonjs', moduleResolution: 'node10',
      strict: true, esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true,
      types: ['node', 'jest'],
    },
  }],
};

// El cliente de Prisma 7 importa sus archivos con extensión .js aunque el código es .ts (estilo ESM).
const moduleNameMapper = { '^(\\.{1,2}/.*)\\.js$': '$1' };

module.exports = {
  projects: [
    // Unitarias: rápidas y sin base de datos. Es lo que ejecuta `npm test`.
    { displayName: 'unit', testEnvironment: 'node', roots: ['<rootDir>/test/unit'], transform, moduleNameMapper },
    // Integración: usan PostgreSQL real (base telcocore_test). Requieren `npm run db:up`.
    {
      displayName: 'integration', testEnvironment: 'node', roots: ['<rootDir>/test/integration'], transform, moduleNameMapper,
      globalSetup: '<rootDir>/test/integration/globalSetup.ts', testTimeout: 30000,
    },
  ],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/infrastructure/**/*.ts', 'src/http/**/*.ts', 'src/app.ts', 'src/composicion.ts', '!src/infrastructure/prisma/generated/**'],
  // Se exige al ejecutar `npm run test:cov` (criterio de la rúbrica: >= 80 %)
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
};
