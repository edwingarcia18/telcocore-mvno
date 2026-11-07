import { ErrorDominio } from './ErrorDominio';

export type CausaCDRInvalido = 'CAMPO_FALTANTE' | 'VALOR_INVALIDO' | 'TIPO_DESCONOCIDO' | 'DUPLICADO';

/** Un registro CDR no cumple las reglas de formato o de valor. Va a cuarentena. */
export class CDRInvalido extends ErrorDominio {
  readonly codigo = 'CDR_INVALIDO';

  constructor(readonly causa: CausaCDRInvalido, detalle: string) {
    super(`CDR inválido (${causa}): ${detalle}`, detalle);
  }
}
