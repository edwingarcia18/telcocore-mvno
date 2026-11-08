import { Repositorios, OpcionesTransaccion, UnidadDeTrabajo } from '../../domain/repositorios';
import { Db } from './cliente';
import { PrismaClient } from './generated/client';
import { PrismaCDRRepository } from './PrismaCDRRepository';
import { PrismaConsumoRepository } from './PrismaConsumoRepository';
import { PrismaFacturaRepository } from './PrismaFacturaRepository';
import { PrismaLoteRepository } from './PrismaLoteRepository';
import { PrismaPlanRepository } from './PrismaPlanRepository';
import { PrismaRechazoRepository } from './PrismaRechazoRepository';
import { PrismaSuscriptorRepository } from './PrismaSuscriptorRepository';

/** Clave del bloqueo consultivo que serializa las ingestas de lotes. */
const BLOQUEO_INGESTA = 7101;

export function crearRepositorios(db: Db): Repositorios {
  return {
    planes: new PrismaPlanRepository(db),
    suscriptores: new PrismaSuscriptorRepository(db),
    lotes: new PrismaLoteRepository(db),
    cdrs: new PrismaCDRRepository(db),
    consumos: new PrismaConsumoRepository(db),
    rechazos: new PrismaRechazoRepository(db),
    facturas: new PrismaFacturaRepository(db),
  };
}

export class PrismaUnidadDeTrabajo implements UnidadDeTrabajo {
  readonly repos: Repositorios;

  constructor(private readonly prisma: PrismaClient) {
    this.repos = crearRepositorios(prisma);
  }

  ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>, opciones: OpcionesTransaccion = {}): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // Bloqueo de la transacción: se libera solo al terminar (commit o rollback).
        if (opciones.exclusivo) await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${BLOQUEO_INGESTA})`);
        return trabajo(crearRepositorios(tx));
      },
      { timeout: opciones.timeoutMs ?? 120_000, maxWait: 10_000 },
    );
  }
}
