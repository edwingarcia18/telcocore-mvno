import { NuevoRechazo, Rechazo } from '../../domain/modelo';
import { PaginaRechazos, RechazoRepository } from '../../domain/repositorios';
import { Db } from './cliente';
import { trozos } from './mapeadores';

export class PrismaRechazoRepository implements RechazoRepository {
  constructor(private readonly db: Db) {}

  async guardarVarios(loteId: number, rechazos: NuevoRechazo[]): Promise<void> {
    for (const parte of trozos(rechazos, 1000)) {
      await this.db.rechazo.createMany({ data: parte.map((r) => ({ ...r, loteId })) });
    }
  }

  async listarPorLote(loteId: number, pagina: number, tamano: number): Promise<PaginaRechazos> {
    const [total, items] = await Promise.all([
      this.db.rechazo.count({ where: { loteId } }),
      this.db.rechazo.findMany({ where: { loteId }, orderBy: { numeroFila: 'asc' }, skip: (pagina - 1) * tamano, take: tamano }),
    ]);
    return { total, items: items as Rechazo[] };
  }
}
