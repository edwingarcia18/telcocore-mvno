import { ErrorDominio } from './ErrorDominio';

/** El mismo archivo (mismo contenido, hash SHA-256) ya fue procesado. La API responde 409. */
export class LoteDuplicado extends ErrorDominio {
  readonly codigo = 'LOTE_DUPLICADO';

  constructor(readonly loteId: number) {
    super(`Este archivo ya fue procesado (lote #${loteId})`);
  }
}
