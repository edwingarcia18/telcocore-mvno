import { ServicioFacturacion, ServicioIngestaLotes } from './application';
import { crearRegistroPorDefecto } from './domain/estrategias';
import { Dependencias } from './http/dependencias';
import { PrismaClient } from './infrastructure/prisma/generated/client';
import { PrismaUnidadDeTrabajo } from './infrastructure/prisma';

/** Raíz de composición: el único lugar que conoce las implementaciones concretas y las conecta. */
export function crearDependencias(prisma: PrismaClient): Dependencias {
  const registro = crearRegistroPorDefecto();
  const uow = new PrismaUnidadDeTrabajo(prisma);
  return { registro, uow, ingesta: new ServicioIngestaLotes(uow, registro), facturacion: new ServicioFacturacion(uow, registro) };
}
