import { ErrorDominio } from './ErrorDominio';

/** Se consultó un lote que no existe. La API responde 404. */
export class LoteNoEncontrado extends ErrorDominio {
  readonly codigo = 'LOTE_NO_ENCONTRADO';

  constructor(readonly loteId: number) {
    super(`El lote #${loteId} no existe`);
  }
}
