import { Lote, NuevoLote, ResultadoLote } from '../modelo';

export interface LoteRepository {
  crear(lote: NuevoLote): Promise<Lote>;
  /** El lote debe existir antes de insertar sus CDR; sus contadores finales se fijan al terminar. */
  actualizarResultado(id: number, resultado: ResultadoLote): Promise<Lote>;
  buscarPorId(id: number): Promise<Lote | null>;
  buscarPorHash(hashSha256: string): Promise<Lote | null>;
}
