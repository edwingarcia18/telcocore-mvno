import { ErrorDominio } from './ErrorDominio';

/** El período de facturación no tiene formato YYYY-MM o está en el futuro. La API responde 400. */
export class PeriodoInvalido extends ErrorDominio {
  readonly codigo = 'PERIODO_INVALIDO';

  constructor(detalle: string) {
    super(`Período inválido: ${detalle}`, detalle);
  }
}
