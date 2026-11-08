import { crearApp } from './app';
import { crearDependencias } from './composicion';
import { crearClientePrisma } from './infrastructure/prisma';

try {
  process.loadEnvFile(); // lee .env (Node 22)
} catch {
  /* sin .env: se usan los valores por defecto */
}

const puerto = Number(process.env.PORT ?? 3000);
const prisma = crearClientePrisma();
const servidor = crearApp(crearDependencias(prisma)).listen(puerto, () => console.log(`API TelcoCore escuchando en http://localhost:${puerto}`));

// Cierre ordenado: deja de aceptar conexiones y libera la base de datos
const apagar = () => {
  servidor.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
