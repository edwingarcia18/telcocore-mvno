import { ErrorDominio } from './ErrorDominio';

/** Todo el lote es inutilizable (no se puede leer o supera el umbral de rechazos). Rollback total. */
export class LoteCorrupto extends ErrorDominio {
  readonly codigo = 'LOTE_CORRUPTO';

  constructor(readonly motivo: string) {
    super(`Lote corrupto: ${motivo}`, motivo);
  }
}
