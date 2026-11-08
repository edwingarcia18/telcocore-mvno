import { sembrarCatalogo } from '../src/application/sembrarCatalogo';
import { crearRegistroPorDefecto } from '../src/domain/estrategias';
import { PrismaUnidadDeTrabajo, crearClientePrisma } from '../src/infrastructure/prisma';

try {
  process.loadEnvFile();
} catch {
  /* sin .env: se usa la URL por defecto */
}

async function main() {
  const prisma = crearClientePrisma();
  try {
    const resultado = await sembrarCatalogo(new PrismaUnidadDeTrabajo(prisma).repos, crearRegistroPorDefecto());
    console.log(`Seed listo: ${resultado.planes} planes y ${resultado.suscriptores} suscriptores.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Seed falló:', e);
  process.exit(1);
});
