import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile(); // Prisma 7 no lee .env por sí solo
} catch {
  /* sin .env: se usa la URL por defecto (la del docker-compose) */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://telcocore:telcocore@localhost:5432/telcocore?schema=public',
  },
});
