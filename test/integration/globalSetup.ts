import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { NOMBRE_BD_PRUEBA, URL_ADMIN, URL_PRUEBA } from './entorno';

/**
 * Prepara una base de datos de PRUEBA limpia (telcocore_test) aplicando las migraciones reales
 * de prisma/migrations, incluida la restricción CHECK. No toca tu base de desarrollo.
 */
export default async function globalSetup(): Promise<void> {
  const admin = new Client({ connectionString: URL_ADMIN });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(`No se pudo conectar a PostgreSQL (${URL_ADMIN}). ¿Ejecutaste "npm run db:up" y Docker está encendido?`, { cause: e });
  }
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [NOMBRE_BD_PRUEBA]);
  if (existe.rowCount === 0) await admin.query(`CREATE DATABASE "${NOMBRE_BD_PRUEBA}"`);
  await admin.end();

  const db = new Client({ connectionString: URL_PRUEBA });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const raiz = join(process.cwd(), 'prisma', 'migrations');
  for (const carpeta of readdirSync(raiz).filter((d) => /^\d+_/.test(d)).sort()) {
    await db.query(readFileSync(join(raiz, carpeta, 'migration.sql'), 'utf8'));
  }
  await db.end();
}
