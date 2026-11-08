import { AbstractCDR } from '../../domain/cdr';
import { CDRInvalido } from '../../domain/errores';
import { CdrTarificado, CDRRepository } from '../../domain/repositorios';
import { Db, esViolacionDeUnicidad } from './cliente';
import { aCdr, aFilaCdr, trozos } from './mapeadores';

const TAMANO_TROZO = 1000; // filas por INSERT: evita superar el límite de parámetros de PostgreSQL

export class PrismaCDRRepository implements CDRRepository {
  constructor(private readonly db: Db) {}

  async idsExistentes(idsExternos: string[]): Promise<Set<string>> {
    const existentes = new Set<string>();
    for (const parte of trozos(idsExternos, 5000)) {
      const filas = await this.db.cdr.findMany({ where: { idExterno: { in: parte } }, select: { idExterno: true } });
      filas.forEach((f) => existentes.add(f.idExterno));
    }
    return existentes;
  }

  async guardarVarios(loteId: number, items: CdrTarificado[]): Promise<void> {
    try {
      for (const parte of trozos(items, TAMANO_TROZO)) {
        const creados = await this.db.cdr.createManyAndReturn({
          data: parte.map((i) => aFilaCdr(i, loteId)),
          select: { id: true, idExterno: true },
        });
        const idPorExterno = new Map(creados.map((c) => [c.idExterno, c.id]));
        const lineas = parte.flatMap((i) =>
          i.lineas.map((l) => {
            const cdrId = idPorExterno.get(i.cdr.idExterno);
            if (cdrId === undefined) throw new Error(`No se pudo guardar el CDR ${i.cdr.idExterno}`);
            return { cdrId, concepto: l.concepto, cantidad: l.cantidad.toFixed(), unidad: l.unidad, monto: l.monto.toFixed() };
          }),
        );
        if (lineas.length > 0) await this.db.lineaFactura.createMany({ data: lineas });
      }
    } catch (e) {
      if (esViolacionDeUnicidad(e)) throw new CDRInvalido('DUPLICADO', 'algún id_externo ya existe en la base de datos');
      throw e;
    }
  }

  async listarPorSuscriptorYPeriodo(suscriptorId: number, periodo: string): Promise<AbstractCDR[]> {
    const filas = await this.db.cdr.findMany({
      where: { suscriptorId, periodo },
      include: { suscriptor: { select: { msisdn: true } } },
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    });
    return filas.map(aCdr);
  }
}
