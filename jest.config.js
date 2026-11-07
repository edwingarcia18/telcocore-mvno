module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  // Jest ejecuta CommonJS: ts-jest compila con su propia configuración (con verificación de tipos activa).
  // El editor y `npm run typecheck` usan tsconfig.json (node16).
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022', module: 'commonjs', moduleResolution: 'node10',
        strict: true, esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true,
        types: ['node', 'jest'],
      },
    }],
  },
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/infrastructure/parsers/**/*.ts'],
  // Se exige al ejecutar `npm run test:cov` (criterio de la rúbrica: >= 80 %)
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
};
