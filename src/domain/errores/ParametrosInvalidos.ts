import { ErrorDominio } from './ErrorDominio';

/** Los parámetros de un plan no cumplen el esquema de su estrategia. */
export class ParametrosInvalidos extends ErrorDominio {
  readonly codigo = 'PARAMETROS_INVALIDOS';

  constructor(detalle: string) {
    super(`Parámetros de plan inválidos: ${detalle}`, detalle);
  }
}
