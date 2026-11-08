// Las pruebas siguen la MISMA conexión que usa la aplicación (DATABASE_URL del archivo .env),
// pero apuntan a una base distinta (telcocore_test) para no tocar los datos de desarrollo.
try {
  process.loadEnvFile();
} catch {
  /* sin .env: se usa la URL por defecto */
}

const base = new URL(process.env.DATABASE_URL ?? 'postgresql://telcocore:telcocore@localhost:5432/telcocore');
const conBaseDeDatos = (nombre: string): string => {
  const url = new URL(base.toString());
  url.pathname = `/${nombre}`;
  url.search = ''; // se quita "?schema=public", que solo entiende Prisma
  return url.toString();
};

export const NOMBRE_BD_PRUEBA = process.env.TEST_DB_NAME ?? 'telcocore_test';
export const URL_ADMIN = conBaseDeDatos('postgres');
export const URL_PRUEBA = conBaseDeDatos(NOMBRE_BD_PRUEBA);
