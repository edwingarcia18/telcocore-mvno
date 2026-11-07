import { ErrorDominio } from './ErrorDominio';

/** Se pidió un tipo de estrategia que no está registrado. */
export class TipoEstrategiaDesconocido extends ErrorDominio {
  readonly codigo = 'TIPO_ESTRATEGIA_DESCONOCIDO';

  constructor(readonly tipo: string) {
    super(`No hay una estrategia registrada con el tipo "${tipo}"`);
  }
}
