import { AbstractCDR } from '../cdr';
import { LineaTarifada } from '../modelo';

/** Un CDR ya tarificado, listo para guardarse junto con sus líneas de factura. */
export interface CdrTarificado {
  cdr: AbstractCDR;
  suscriptorId: number;
  lineas: LineaTarifada[];
}

export interface CDRRepository {
  /** De los id_externo dados, devuelve los que ya están guardados (para detectar duplicados entre lotes). */
  idsExistentes(idsExternos: string[]): Promise<Set<string>>;
  /** Guarda los CDR con sus líneas. Lanza CDRInvalido(DUPLICADO) si algún id_externo ya existe. */
  guardarVarios(loteId: number, items: CdrTarificado[]): Promise<void>;
  /** Reconstruye las subclases concretas (VoiceCDR, SMSCDR, DataCDR) ordenadas por fecha de inicio. */
  listarPorSuscriptorYPeriodo(suscriptorId: number, periodo: string): Promise<AbstractCDR[]>;
}
