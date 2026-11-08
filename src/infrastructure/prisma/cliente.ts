import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/client';

export const URL_POR_DEFECTO = 'postgresql://telcocore:telcocore@localhost:5432/telcocore?schema=public';

/** Cliente o transacción de Prisma: los repositorios aceptan cualquiera de los dos. */
export type Db = Prisma.TransactionClient;

export function crearClientePrisma(url: string = process.env.DATABASE_URL ?? URL_POR_DEFECTO): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
