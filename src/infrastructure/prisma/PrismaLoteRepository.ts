import { Lote, NuevoLote, ResultadoLote } from '../../domain/modelo';
import { LoteRepository } from '../../domain/repositorios';
import { Db } from './cliente';

export class PrismaLoteRepository implements LoteRepository {
  constructor(private readonly db: Db) {}

  crear(lote: NuevoLote): Promise<Lote> {
    return this.db.lote.create({ data: lote });
  }

  actualizarResultado(id: number, resultado: ResultadoLote): Promise<Lote> {
    return this.db.lote.update({ where: { id }, data: resultado });
  }

  buscarPorId(id: number): Promise<Lote | null> {
    return this.db.lote.findUnique({ where: { id } });
  }

  buscarPorHash(hashSha256: string): Promise<Lote | null> {
    return this.db.lote.findUnique({ where: { hashSha256 } });
  }

  listar(limite: number): Promise<Lote[]> {
    return this.db.lote.findMany({ orderBy: { id: 'desc' }, take: limite });
  }
}
